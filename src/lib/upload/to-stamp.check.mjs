#!/usr/bin/env node
/* ─── stamp record assembly checks ────────────────────────────────────
 *  Regression cover for the id collision found 2026-08-09.
 *
 *  Ids were `stamp-${scott}-${index}`. `index` disambiguates two detections
 *  WITHIN one batch, but nothing disambiguates across batches — so
 *  photographing Scott 814 first in two separate uploads produced
 *  `stamp-814-0` both times, and addStamp's upsert-by-id silently REPLACED the
 *  first stamp with the second. A stamp the user had saved simply vanished.
 *
 *  Run with: node src/lib/upload/to-stamp.check.mjs
 * ──────────────────────────────────────────────────────────────────── */

import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const outfile = path.join(os.tmpdir(), `to-stamp.check.${process.pid}.${Date.now()}.mjs`);

await build({
  entryPoints: [path.join(__dirname, 'to-stamp.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile,
  absWorkingDir: projectRoot,
  tsconfig: path.join(projectRoot, 'tsconfig.json'),
  logLevel: 'silent',
});

let buildIdentifiedStamp;
try {
  ({ buildIdentifiedStamp } = await import(pathToFileURL(outfile).href));
} finally {
  fs.rmSync(outfile, { force: true });
}

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`FAIL: ${name}\n      ${err.message}`);
    failed++;
  }
};
const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

const ident = (over = {}) => ({
  country: 'United States',
  scottNumber: '814',
  yearOfIssue: 1938,
  description: 'A used 9c Harrison',
  aiConfidence: 1,
  ...over,
});

const BATCH_A = '2026-08-09T16:00:00.000Z';
const BATCH_B = '2026-08-09T17:30:00.000Z';

const idFor = (over, index, now) =>
  buildIdentifiedStamp({
    ident: ident(over),
    imageDataUrl: 'data:image/jpeg;base64,AAAA',
    pricing: null,
    index,
    now,
  }).id;

/* ── THE BUG ───────────────────────────────────────────────────────────
 * The same stamp, first in frame, in two separate uploads. */
check('the same stamp in two separate batches gets distinct ids', () => {
  const a = idFor({}, 0, BATCH_A);
  const b = idFor({}, 0, BATCH_B);
  assert(a !== b, `both batches produced ${a} — the second would overwrite the first`);
});

check('an uncatalogued stamp also survives a second batch', () => {
  const a = idFor({ scottNumber: null }, 0, BATCH_A);
  const b = idFor({ scottNumber: null }, 0, BATCH_B);
  assert(a !== b, `both batches produced ${a}`);
});

/* ── …without breaking what index was already doing ────────────────────── */
check('two detections within ONE batch still get distinct ids', () => {
  const a = idFor({}, 0, BATCH_A);
  const b = idFor({}, 1, BATCH_A);
  assert(a !== b, `duplicate photos in one batch collided on ${a}`);
});

check('different catalogue numbers never collide', () => {
  assert(idFor({}, 0, BATCH_A) !== idFor({ scottNumber: '245' }, 0, BATCH_A), 'collided');
});

/* ── Ids must stay usable as Firestore document ids and React keys ─────── */
check('ids are safe as document ids', () => {
  for (const id of [idFor({}, 0, BATCH_A), idFor({ scottNumber: null }, 2, BATCH_B)]) {
    assert(!id.includes('/'), `${id} contains a slash, which would nest a subcollection`);
    assert(id !== '.' && id !== '..', `${id} is a reserved document id`);
    assert(id.length > 0 && id.length < 1500, `${id} is not a usable length`);
  }
});

check('the same batch and index is deterministic', () => {
  assert(idFor({}, 0, BATCH_A) === idFor({}, 0, BATCH_A), 'id generation is not deterministic');
});

/* ── Regression: the identification still lands intact ─────────────────── */
check('a catalogued stamp keeps its identification', () => {
  const stamp = buildIdentifiedStamp({
    ident: ident(),
    imageDataUrl: 'data:image/jpeg;base64,AAAA',
    pricing: null,
    notPricedReason: 'Not priced — testing.',
    index: 0,
    now: BATCH_A,
  });
  assert(stamp.identification.scottNumber === '814', 'scott number lost');
  assert(stamp.identification.country === 'United States', 'country lost');
  assert(stamp.notPricedReason === 'Not priced — testing.', 'reason lost');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
