#!/usr/bin/env node
/* ─── quota-error detection ───────────────────────────────────────────
 *  Until this module existed, `handleSave` caught every throw and told the
 *  user "this device is out of storage space". A corrupt image that broke
 *  makeThumbnail produced the identical message, so the one piece of advice
 *  the app gave — delete some stamps — was frequently wrong.
 *
 *  Both directions matter here. A missed quota error means the user is not
 *  told their phone is full; a false positive means a real bug is reported as
 *  a full disk and never gets fixed. The negatives below are the half that
 *  never existed.
 *
 *  Run with: node src/lib/storage/quota.check.mjs
 * ──────────────────────────────────────────────────────────────────── */

import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const outfile = path.join(os.tmpdir(), `quota.${process.pid}.${Date.now()}.mjs`);

await build({
  entryPoints: [path.join(__dirname, 'quota.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile,
  absWorkingDir: projectRoot,
  tsconfig: path.join(projectRoot, 'tsconfig.json'),
  logLevel: 'silent',
});

let isQuotaError;
try {
  ({ isQuotaError } = await import(pathToFileURL(outfile).href));
} finally {
  fs.rmSync(outfile, { force: true });
}

let passed = 0;
let failed = 0;

const check = (name, actual, expected) => {
  if (actual === expected) passed++;
  else {
    failed++;
    console.error(
      `  FAIL ${name}\n       expected ${JSON.stringify(expected)}\n       actual   ${JSON.stringify(actual)}`,
    );
  }
};

/* ─── Positives: every shape a browser actually throws ────────────────── */

/* The standard. Chrome, and modern Safari/Firefox. */
check(
  'the standard DOMException name is recognised',
  isQuotaError({ name: 'QuotaExceededError', code: 22 }),
  true,
);

/* Firefox legacy — name and code both appear in the wild. */
check(
  'the Firefox legacy name is recognised',
  isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' }),
  true,
);
check('the Firefox legacy code is recognised', isQuotaError({ code: 1014 }), true);

/* WebKit legacy. */
check('the WebKit legacy name is recognised', isQuotaError({ name: 'QUOTA_EXCEEDED_ERR' }), true);
check('the WebKit legacy code is recognised', isQuotaError({ code: 22 }), true);

/* Safari private mode has shipped a plain Error rather than a DOMException,
 * which is exactly why this is a structural check and not an instanceof one. */
const plain = new Error('QuotaExceededError: The quota has been exceeded.');
plain.name = 'QuotaExceededError';
check('a plain Error carrying the quota name is recognised', isQuotaError(plain), true);

/* A real DOMException, where available, must also pass. */
if (typeof DOMException !== 'undefined') {
  check(
    'a real DOMException is recognised',
    isQuotaError(new DOMException('full', 'QuotaExceededError')),
    true,
  );
}

/* ─── Negatives: the half that decides whether a bug gets fixed ───────── */

check('a TypeError is not a quota error', isQuotaError(new TypeError('x is not a function')), false);
check('a bare Error is not a quota error', isQuotaError(new Error('boom')), false);
check('null is not a quota error', isQuotaError(null), false);
check('undefined is not a quota error', isQuotaError(undefined), false);
check('a string is not a quota error', isQuotaError('QuotaExceededError'), false);
check('a number is not a quota error', isQuotaError(22), false);

/* code 0 is the "no legacy code" sentinel on every modern DOMException. If it
 * ever matched, every DOM error in the app would be reported as a full disk. */
check('code 0 is not a quota error', isQuotaError({ code: 0 }), false);

/* Other legacy DOMException codes must not match. 18 is SecurityError, which
 * is what Safari private mode throws for a DIFFERENT reason — blocked storage
 * access, not a full one. Telling the user to delete stamps would not help. */
check('a SecurityError code is not a quota error', isQuotaError({ code: 18 }), false);
check(
  'a SecurityError name is not a quota error',
  isQuotaError({ name: 'SecurityError', code: 18 }),
  false,
);

/* Near-misses on the name. */
check('an empty object is not a quota error', isQuotaError({}), false);
check('a similar-looking name does not match', isQuotaError({ name: 'QuotaExceeded' }), false);

console.log(`\nquota checks: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
