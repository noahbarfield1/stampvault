#!/usr/bin/env node
/* ─── normalize.ts checks ─────────────────────────────────────────────
 *  No Jest/Vitest is configured in this project, so this follows the same
 *  pattern as src/lib/pricing/aggregate.check.mjs: bundle the TS module with
 *  the esbuild devDependency and run plain assertions in Node.
 *
 *  Run with: node src/lib/segmentation/normalize.check.mjs
 * ──────────────────────────────────────────────────────────────────── */

import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const entryPoint = path.join(__dirname, 'normalize.ts');

const outfile = path.join(
  os.tmpdir(),
  `normalize.check.bundle.${process.pid}.${Date.now()}.mjs`
);

await build({
  entryPoints: [entryPoint],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile,
  absWorkingDir: projectRoot,
  tsconfig: path.join(projectRoot, 'tsconfig.json'),
  logLevel: 'silent',
});

let normalizeDetections;
let parseSegmentationText;
let DEFAULT_CONFIDENCE;

try {
  ({ normalizeDetections, parseSegmentationText, DEFAULT_CONFIDENCE } =
    await import(pathToFileURL(outfile).href));
} finally {
  fs.rmSync(outfile, { force: true });
}

/* ─── Tiny assertion harness ──────────────────────────────────────────── */

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`FAIL: ${name}`);
    console.log(`      ${err.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${label ?? 'value'} mismatch — expected ${e}, got ${a}`);
  }
}

const box = (r) => r.boundingBox;

/* ─── The regression this module exists for ───────────────────────────── */

check('box_2d 0-1000 becomes percent (the bug that returned zero stamps)', () => {
  // Before the fix: clamping to 100 ran first, so these collapsed to
  // {100,100,100,100}, had zero width, and were filtered out entirely.
  const r = normalizeDetections([
    { box_2d: [100, 200, 500, 600], label: 'GB Penny Black', confidence: 0.9 },
  ]);
  assertEqual(r.stamps.length, 1, 'detection survives');
  assertEqual(box(r.stamps[0]), { x1: 20, y1: 10, x2: 60, y2: 50 }, 'box_2d mapping');
  assertEqual(r.coordSpace, 'normalized_1000', 'coordSpace');
});

check('box_2d ordering is [ymin, xmin, ymax, xmax], not [x,y,x,y]', () => {
  // Guards against silently transposing every box, which would put stamps in
  // the wrong place on screen while still "working".
  const r = normalizeDetections([{ box_2d: [0, 500, 200, 900] }]);
  assertEqual(box(r.stamps[0]), { x1: 50, y1: 0, x2: 90, y2: 20 }, 'axis order');
});

check('legacy boundingBox already in percent is left alone', () => {
  const r = normalizeDetections([
    { boundingBox: { x1: 10, y1: 15, x2: 30, y2: 40 }, description: 'x', confidence: 0.8 },
  ]);
  assertEqual(box(r.stamps[0]), { x1: 10, y1: 15, x2: 30, y2: 40 }, 'unscaled');
  assertEqual(r.coordSpace, 'percent', 'coordSpace');
});

check('legacy boundingBox that is actually 0-1000 gets scaled', () => {
  const r = normalizeDetections([
    { boundingBox: { x1: 100, y1: 200, x2: 400, y2: 600 }, confidence: 0.7 },
  ]);
  assertEqual(box(r.stamps[0]), { x1: 10, y1: 20, x2: 40, y2: 60 }, 'scaled by 10');
  assertEqual(r.coordSpace, 'normalized_1000', 'coordSpace');
});

check('coordinate space is decided per response, not per box', () => {
  // The second box alone looks like percent. Judged per-box it would stay
  // unscaled and land in the wrong place; per-response it scales with the rest.
  const r = normalizeDetections([
    { boundingBox: { x1: 100, y1: 100, x2: 900, y2: 900 } },
    { boundingBox: { x1: 10, y1: 10, x2: 90, y2: 90 } },
  ]);
  assertEqual(box(r.stamps[0]), { x1: 10, y1: 10, x2: 90, y2: 90 }, 'first');
  assertEqual(box(r.stamps[1]), { x1: 1, y1: 1, x2: 9, y2: 9 }, 'second scaled too');
});

/* ─── Detections that used to be silently deleted ─────────────────────── */

check('reversed coordinates are order-corrected, not dropped', () => {
  // The old filter required x1 < x2 and deleted anything else. Gemini reverses
  // them intermittently, so real stamps were being discarded.
  const r = normalizeDetections([
    { boundingBox: { x1: 60, y1: 50, x2: 20, y2: 10 }, confidence: 0.8 },
  ]);
  assertEqual(r.stamps.length, 1, 'survives');
  assertEqual(box(r.stamps[0]), { x1: 20, y1: 10, x2: 60, y2: 50 }, 'corrected');
});

check('missing confidence defaults instead of dropping the detection', () => {
  // The old filter required `typeof confidence === 'number' && > 0`.
  const r = normalizeDetections([{ box_2d: [0, 0, 300, 300], label: 'no confidence' }]);
  assertEqual(r.stamps.length, 1, 'survives');
  assertEqual(r.stamps[0].confidence, DEFAULT_CONFIDENCE, 'default applied');
});

check('confidence is clamped into 0..1', () => {
  const r = normalizeDetections([
    { box_2d: [0, 0, 300, 300], confidence: 4 },
    { box_2d: [0, 0, 300, 300], confidence: -1 },
  ]);
  assertEqual(r.stamps.map((s) => s.confidence), [1, 0], 'clamped');
});

/* ─── Boxes that must survive, and boxes that must not ────────────────── */

check('a full-frame box survives (single stamp filling the photo)', () => {
  const r = normalizeDetections([{ box_2d: [0, 0, 1000, 1000], confidence: 0.95 }]);
  assertEqual(box(r.stamps[0]), { x1: 0, y1: 0, x2: 100, y2: 100 }, 'full frame');
});

check('a full-frame legacy PERCENT box is not mistaken for 0-1000', () => {
  // max coordinate is exactly 100, which is the boundary. Must stay percent.
  const r = normalizeDetections([{ boundingBox: { x1: 0, y1: 0, x2: 100, y2: 100 } }]);
  assertEqual(box(r.stamps[0]), { x1: 0, y1: 0, x2: 100, y2: 100 }, 'boundary');
  assertEqual(r.coordSpace, 'percent', 'coordSpace');
});

check('sub-2% boxes are dropped and counted', () => {
  const r = normalizeDetections([
    { box_2d: [0, 0, 10, 10] },
    { box_2d: [0, 0, 300, 300] },
  ]);
  assertEqual(r.stamps.length, 1, 'one kept');
  assertEqual(r.droppedCount, 1, 'one counted as dropped');
});

check('out-of-range coordinates are clamped after scaling', () => {
  const r = normalizeDetections([{ box_2d: [-50, -50, 1200, 1200] }]);
  assertEqual(box(r.stamps[0]), { x1: 0, y1: 0, x2: 100, y2: 100 }, 'clamped');
});

check('detections are capped at MAX_DETECTIONS', () => {
  const many = Array.from({ length: 80 }, () => ({ box_2d: [0, 0, 300, 300] }));
  assertEqual(normalizeDetections(many).stamps.length, 60, 'capped');
});

/* ─── Malformed input must not throw ──────────────────────────────────── */

check('empty array yields no stamps', () => {
  const r = normalizeDetections([]);
  assertEqual(r.stamps, [], 'empty');
  assertEqual(r.droppedCount, 0, 'nothing dropped');
});

check('non-array input yields no stamps', () => {
  assertEqual(normalizeDetections({ stamps: [] }).stamps, [], 'object');
  assertEqual(normalizeDetections(null).stamps, [], 'null');
  assertEqual(normalizeDetections('nope').stamps, [], 'string');
});

check('entries with no usable box are skipped', () => {
  const r = normalizeDetections([
    { label: 'no box at all' },
    { box_2d: [0, 0, 'x', 300] },
    { boundingBox: { x1: 1 } },
    null,
    { box_2d: [0, 0, 300, 300] },
  ]);
  assertEqual(r.stamps.length, 1, 'only the valid one');
});

check('NaN and Infinity coordinates are rejected', () => {
  const r = normalizeDetections([
    { box_2d: [0, 0, NaN, 300] },
    { boundingBox: { x1: 0, y1: 0, x2: Infinity, y2: 50 } },
  ]);
  assertEqual(r.stamps.length, 0, 'both rejected');
});

check('label and description are both accepted, with a fallback', () => {
  const r = normalizeDetections([
    { box_2d: [0, 0, 300, 300], label: 'from label' },
    { box_2d: [0, 0, 300, 300], description: 'from description' },
    { box_2d: [0, 0, 300, 300] },
    { box_2d: [0, 0, 300, 300], label: '   ' },
  ]);
  assertEqual(
    r.stamps.map((s) => s.description),
    ['from label', 'from description', 'Unidentified stamp', 'Unidentified stamp'],
    'description resolution'
  );
});

/* ─── Text parsing ────────────────────────────────────────────────────── */

check('parseSegmentationText reads plain JSON', () => {
  assertEqual(parseSegmentationText('[{"a":1}]'), { ok: true, value: [{ a: 1 }] }, 'plain');
});

check('parseSegmentationText unwraps a ```json fence', () => {
  const r = parseSegmentationText('```json\n[{"a":1}]\n```');
  assertEqual(r, { ok: true, value: [{ a: 1 }] }, 'fenced');
});

check('parseSegmentationText reports failure instead of collapsing to []', () => {
  // Collapsing prose to [] is what made a hard model failure look identical to
  // "no stamps found in this photo".
  assertEqual(parseSegmentationText("I can't help with that."), { ok: false }, 'prose');
});

/* ─── Summary ──────────────────────────────────────────────────────────── */

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
