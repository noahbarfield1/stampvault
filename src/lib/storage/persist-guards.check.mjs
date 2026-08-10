#!/usr/bin/env node
/* ─── persistence size guards ─────────────────────────────────────────
 *  Regression cover for the 2026-08-09 report: "Could not save your stamps —
 *  The quota has been exceeded." on iOS Safari, with fewer than five stamps.
 *
 *  Measured: a correctly-built record is ~22.8KB, so ~224 fit in Safari's ~5MB
 *  cap. The blowup came from makeThumbnail's `return out ?? dataUrl` — when
 *  canvas allocation fails (routine on iOS under memory pressure) it returned
 *  the ORIGINAL 80-200KB crop, and partialize persists thumbnailUrl verbatim.
 *
 *  Run with: node src/lib/storage/persist-guards.check.mjs
 * ──────────────────────────────────────────────────────────────────── */

import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const outfile = path.join(os.tmpdir(), `persist-guards.${process.pid}.${Date.now()}.mjs`);

await build({
  entryPoints: [path.join(__dirname, 'persist-guards.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile,
  absWorkingDir: projectRoot,
  tsconfig: path.join(projectRoot, 'tsconfig.json'),
  logLevel: 'silent',
});

let safeThumbnail, MAX_PERSISTED_THUMBNAIL_CHARS;
try {
  ({ safeThumbnail, MAX_PERSISTED_THUMBNAIL_CHARS } = await import(pathToFileURL(outfile).href));
} finally {
  fs.rmSync(outfile, { force: true });
}

let passed = 0;
let failed = 0;
/* Values here can be hundreds of KB — that is the whole point of the bug — so
 * summarise rather than dumping them into the test output. */
const brief = (v) => {
  if (typeof v !== 'string') return JSON.stringify(v);
  return v.length > 60 ? `<string, ${v.length} chars, starts "${v.slice(0, 30)}…">` : JSON.stringify(v);
};

const check = (name, actual, expected) => {
  if (actual === expected) passed++;
  else {
    failed++;
    console.error(
      `  FAIL ${name}\n       expected ${brief(expected)}\n       actual   ${brief(actual)}`,
    );
  }
};

/* A real 240px/0.7 JPEG thumbnail measures 12-25KB. The cap must clear that
 * comfortably while still rejecting a full-resolution crop. */
check('the cap sits above a real thumbnail', MAX_PERSISTED_THUMBNAIL_CHARS > 25 * 1024, true);
check('the cap sits below a full crop', MAX_PERSISTED_THUMBNAIL_CHARS < 80 * 1024, true);

const realThumb = 'data:image/jpeg;base64,' + 'A'.repeat(20 * 1024);
check('a real thumbnail passes through untouched', safeThumbnail(realThumb), realThumb);

/* THE BUG: a full-resolution crop arriving disguised as a thumbnail. Persisting
 * it is what exceeded the quota, so it must be dropped rather than stored. */
const fullCrop = 'data:image/jpeg;base64,' + 'A'.repeat(150 * 1024);
check('an oversized image is not persisted', safeThumbnail(fullCrop), '');

/* Static asset paths must survive — handleSave uses one as its placeholder. */
check('a short asset path is kept', safeThumbnail('/mock/stamps/no-image.svg'), '/mock/stamps/no-image.svg');

/* Absent values normalize rather than throwing inside the persist middleware,
 * where an exception takes the whole save down. */
check('null becomes empty', safeThumbnail(null), '');
check('undefined becomes empty', safeThumbnail(undefined), '');
check('empty stays empty', safeThumbnail(''), '');

/* Exactly at the cap is acceptable; one character over is not. */
const exact = 'x'.repeat(MAX_PERSISTED_THUMBNAIL_CHARS);
check('a value exactly at the cap is kept', safeThumbnail(exact), exact);
check('one character over the cap is dropped', safeThumbnail(exact + 'x'), '');

console.log(`\npersist-guard checks: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
