#!/usr/bin/env node
/* ─── robust statistics ───────────────────────────────────────────────
 *  Cover for the quartile defect described in statistics.ts.
 *
 *  The headline case is 'the maximum is rejectable at n=4'. It FAILS on the
 *  arithmetic this module replaced, which is the point of writing it:
 *
 *    old, nearest rank, [1,2,3,100]
 *      q1 = sorted[floor(4*0.25)] = sorted[1] = 2
 *      q3 = sorted[floor(4*0.75)] = sorted[3] = 100   <- THE MAXIMUM
 *      upper fence = 100 + 1.5*98 = 247  ->  100 survives
 *
 *    new, interpolated (type 7), [1,2,3,100]
 *      q1 = 1 + 0.75*(2-1)   = 1.75
 *      q3 = 3 + 0.25*(100-3) = 27.25
 *      upper fence = 27.25 + 1.5*25.5 = 65.5  ->  100 rejected
 *
 *  Because q3 was always the largest value, the upper fence was always at or
 *  above it, so at n=4 the filter could not reject anything at all.
 *
 *  Run with: node src/lib/pricing/statistics.check.mjs
 * ──────────────────────────────────────────────────────────────────── */

import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const outfile = path.join(os.tmpdir(), `statistics.${process.pid}.${Date.now()}.mjs`);

await build({
  entryPoints: [path.join(__dirname, 'statistics.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile,
  absWorkingDir: projectRoot,
  tsconfig: path.join(projectRoot, 'tsconfig.json'),
  logLevel: 'silent',
});

let quantile, iqrFences, trimmedRange, robustCV, removeOutliersIQR, median;
try {
  ({ quantile, iqrFences, trimmedRange, robustCV, removeOutliersIQR, median } = await import(
    pathToFileURL(outfile).href
  ));
} finally {
  fs.rmSync(outfile, { force: true });
}

let passed = 0;
let failed = 0;

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed++;
  else {
    failed++;
    console.error(
      `  FAIL ${name}\n       expected ${JSON.stringify(expected)}\n       actual   ${JSON.stringify(actual)}`,
    );
  }
};
const near = (name, actual, expected, tol = 1e-9) => {
  if (Math.abs(actual - expected) <= tol) passed++;
  else {
    failed++;
    console.error(`  FAIL ${name}\n       expected ~${expected}\n       actual    ${actual}`);
  }
};

/* ─── THE REGRESSION ──────────────────────────────────────────────────── */

check(
  'the maximum is rejectable at n=4 (was structurally impossible)',
  removeOutliersIQR([1, 2, 3, 100]),
  [1, 2, 3],
);

/* The concrete case from the aggregator's own comment: a block of six listed
 * among single stamps. Four points, so the old code kept it and it set the
 * median. */
check(
  'a wildly-priced block among singles is dropped at n=4',
  removeOutliersIQR([2.5, 3.0, 3.5, 79950]),
  [2.5, 3.0, 3.5],
);

/* q3 must sit strictly inside the data whenever the top values differ. That
 * property is what makes the fence able to reject at all. */
near('q3 at n=4 is below the maximum', iqrFences([1, 2, 3, 100]).q3, 27.25);
near('q1 at n=4 is above the minimum', iqrFences([1, 2, 3, 100]).q1, 1.75);

/* ─── quantile ────────────────────────────────────────────────────────── */

near('the median is the 0.5 quantile (odd n)', quantile([1, 2, 3], 0.5), 2);
near('the median is the 0.5 quantile (even n)', quantile([1, 2, 3, 4], 0.5), 2.5);
near('p=0 is the minimum', quantile([5, 9, 20], 0), 5);
near('p=1 is the maximum', quantile([5, 9, 20], 1), 20);
near('a single point is its own quantile', quantile([7], 0.75), 7);
check('an empty array quantile is 0', quantile([], 0.5), 0);
/* Interpolation, checked against NumPy's default: percentile([1,2,3,4],25) = 1.75 */
near('quartiles interpolate between order statistics', quantile([1, 2, 3, 4], 0.25), 1.75);
/* p outside [0,1] clamps rather than reading past the end of the array. */
near('p is clamped below', quantile([1, 2, 3], -1), 1);
near('p is clamped above', quantile([1, 2, 3], 5), 3);

/* ─── behaviour preserved from the old implementation ─────────────────── */

check('fewer than 4 points are returned untouched', removeOutliersIQR([1, 500]), [1, 500]);
check('exactly 3 points are returned untouched', removeOutliersIQR([1, 2, 900]), [1, 2, 900]);
check('an empty input survives', removeOutliersIQR([]), []);
check('a tight set loses nothing', removeOutliersIQR([10, 11, 12, 13]), [10, 11, 12, 13]);
check('identical values lose nothing', removeOutliersIQR([5, 5, 5, 5]), [5, 5, 5, 5]);
check('output is sorted', removeOutliersIQR([13, 10, 12, 11]), [10, 11, 12, 13]);
check('the input array is not mutated', (() => {
  const input = [13, 10, 12, 11];
  removeOutliersIQR(input);
  return input;
})(), [13, 10, 12, 11]);

check('median of an empty array is 0', median([]), 0);
near('median of an odd-length array', median([3, 1, 2]), 2);
near('median of an even-length array', median([4, 1, 2, 3]), 2.5);

/* ─── trimmedRange — the "range is too wide" fix ──────────────────────── */

/* Twelve comparables clustered near $2 with two junk listings. The old range
 * was min..max of the survivors; the new one is the middle 50%. */
const clustered = [1.9, 1.95, 2.0, 2.0, 2.05, 2.1, 2.15, 2.2];
const clusteredRange = trimmedRange(clustered);
check('a tight sample reports an iqr basis', clusteredRange.basis, 'iqr');
check(
  'the trimmed range is narrower than the full span',
  clusteredRange.max - clusteredRange.min < clustered[clustered.length - 1] - clustered[0],
  true,
);

/* Below 4 points quartiles are meaningless, so say so rather than pretend. */
const sparse = trimmedRange([3, 50]);
check('fewer than 4 points reports a full basis', sparse.basis, 'full');
check('a full basis spans min to max', [sparse.min, sparse.max], [3, 50]);
check('no data reports a none basis', trimmedRange([]).basis, 'none');
check('a none basis is 0 to 0', [trimmedRange([]).min, trimmedRange([]).max], [0, 0]);

/* The invariant the UI depends on: the median cannot fall outside the range
 * it is displayed with. q1 <= median <= q3 holds by construction. */
const invariantSets = [
  [1, 2, 3, 100],
  [0.99, 1.5, 2, 2.5, 79950],
  [10, 10, 10, 10, 10],
  [5, 6],
  [42],
];
for (const set of invariantSets) {
  const r = trimmedRange(set);
  const m = median(set);
  check(`median sits inside the reported range for [${set}]`, r.min <= m && m <= r.max, true);
}

/* ─── robustCV — what makes confidence mean something ─────────────────── */

near('identical comparables disagree by 0', robustCV([2, 2, 2, 2]), 0);
check(
  'a dispersed sample scores strictly higher than a tight one of equal size',
  robustCV([0.99, 5, 500, 79950]) > robustCV([1.9, 2.0, 2.1, 2.2]),
  true,
);
check('fewer than 2 points has no measurable disagreement', robustCV([7]), 0);
check('an empty input has no measurable disagreement', robustCV([]), 0);
/* A non-positive median would divide by zero; free listings exist in scraped
 * data, so this is reachable rather than theoretical. */
check('a zero median does not divide by zero', Number.isFinite(robustCV([0, 0, 0, 5])), true);

console.log(`\nstatistics checks: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
