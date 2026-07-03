#!/usr/bin/env node
/* ─── aggregate.ts checks ─────────────────────────────────────────────
 *  No Jest/Vitest is configured in this project (package.json has no
 *  test runner), so this bundles src/lib/pricing/aggregate.ts with the
 *  esbuild devDependency already in the project and runs plain
 *  assertions against the compiled output in Node.
 *
 *  Run with: node src/lib/pricing/aggregate.check.mjs
 * ──────────────────────────────────────────────────────────────────── */

import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const entryPoint = path.join(__dirname, 'aggregate.ts');

const outfile = path.join(
  os.tmpdir(),
  `aggregate.check.bundle.${process.pid}.${Date.now()}.mjs`
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

let aggregateLivePricing;
let median;
let removeOutliersIQR;
let RECENCY_DAYS;

try {
  ({ aggregateLivePricing, median, removeOutliersIQR, RECENCY_DAYS } = await import(
    pathToFileURL(outfile).href
  ));
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

/* ─── Fixtures ─────────────────────────────────────────────────────────── */

const REFERENCE_TIME = new Date('2026-07-03').getTime();
const DAY = 24 * 60 * 60 * 1000;

function daysAgoISO(days) {
  return new Date(REFERENCE_TIME - days * DAY).toISOString();
}

function soldListing(overrides) {
  return {
    platform: 'ebay',
    listingType: 'sold',
    price: 10,
    currency: 'USD',
    soldDate: daysAgoISO(30),
    url: 'https://example.com/sold',
    imageUrl: 'https://example.com/sold.jpg',
    title: 'Sold listing',
    ...overrides,
  };
}

function activeListing(overrides) {
  return {
    platform: 'ebay',
    listingType: 'active',
    price: 10,
    currency: 'USD',
    soldDate: null,
    url: 'https://example.com/active',
    imageUrl: 'https://example.com/active.jpg',
    title: 'Active listing',
    ...overrides,
  };
}

/* ─── 1. Recent sold -> tier 'live_sold', value = median of prices ────── */

check('recent sold -> live_sold tier with median value', () => {
  const sold = [
    soldListing({ price: 10, soldDate: daysAgoISO(10) }),
    soldListing({ price: 20, soldDate: daysAgoISO(20) }),
    soldListing({ price: 30, soldDate: daysAgoISO(5) }),
  ];
  const result = aggregateLivePricing({
    sold,
    active: [],
    referenceTime: REFERENCE_TIME,
  });

  assertEqual(result.priceBasis.tier, 'live_sold', 'tier');
  assertEqual(result.priceBasis.value, median([10, 20, 30]), 'value');
  assertEqual(result.priceBasis.sampleSize, 3, 'sampleSize');
  // proof must be the MOST RECENT recentSold listing (5 days ago -> price 30)
  assertEqual(result.priceBasis.proof.price, 30, 'proof.price');
  assertEqual(result.estimatedValue, result.priceBasis.value, 'estimatedValue');
});

/* ─── 2. Recency boundary: exactly 730d counts, 731d does not ─────────── */

check('recency boundary: 730 days ago counts as live', () => {
  const sold = [soldListing({ price: 42, soldDate: daysAgoISO(RECENCY_DAYS) })];
  const result = aggregateLivePricing({
    sold,
    active: [],
    referenceTime: REFERENCE_TIME,
  });
  assertEqual(result.priceBasis.tier, 'live_sold', 'tier at exactly 730d');
});

check('recency boundary: 731 days ago does NOT count as live', () => {
  const sold = [soldListing({ price: 42, soldDate: daysAgoISO(RECENCY_DAYS + 1) })];
  const result = aggregateLivePricing({
    sold,
    active: [],
    referenceTime: REFERENCE_TIME,
  });
  assertEqual(result.priceBasis.tier, 'last_sold', 'tier at 731d falls to last_sold');
});

/* ─── 3. No recent sold, active present -> tier 'active' ──────────────── */

check('no recent sold but active present -> active tier', () => {
  const active = [
    activeListing({ price: 15 }),
    activeListing({ price: 25 }),
  ];
  const result = aggregateLivePricing({
    sold: [],
    active,
    referenceTime: REFERENCE_TIME,
  });

  assertEqual(result.priceBasis.tier, 'active', 'tier');
  assertEqual(result.priceBasis.sampleSize, 2, 'sampleSize');
  assertEqual(result.priceBasis.asOf, null, 'asOf');
});

/* ─── 4. Only old sold (>730d) -> tier 'last_sold' ────────────────────── */

check('only old sold (>730d) -> last_sold tier', () => {
  const sold = [
    soldListing({ price: 8, soldDate: daysAgoISO(RECENCY_DAYS + 100) }),
    soldListing({ price: 12, soldDate: daysAgoISO(RECENCY_DAYS + 5) }),
  ];
  const result = aggregateLivePricing({
    sold,
    active: [],
    referenceTime: REFERENCE_TIME,
  });

  assertEqual(result.priceBasis.tier, 'last_sold', 'tier');
  // value = most-recent such sold price (fewer days ago -> price 12)
  assertEqual(result.priceBasis.value, 12, 'value');
  assertEqual(result.priceBasis.sampleSize, 1, 'sampleSize');
});

/* ─── 5. Only a catalog value -> tier 'catalog' ───────────────────────── */

check('nothing but a catalog value -> catalog tier', () => {
  const result = aggregateLivePricing({
    sold: [],
    active: [],
    catalog: { value: 99.5, label: 'Scott catalog value' },
    referenceTime: REFERENCE_TIME,
  });

  assertEqual(result.priceBasis.tier, 'catalog', 'tier');
  assertEqual(result.priceBasis.value, 99.5, 'value');
  assertEqual(result.estimatedValue, 99.5, 'estimatedValue');
  assertEqual(result.priceBasis.label, 'Scott catalog value', 'label');
  assertEqual(result.priceBasis.proof, null, 'proof (no url/imageUrl provided)');
});

check('no sold, no active, no catalog -> catalog tier with 0 value', () => {
  const result = aggregateLivePricing({
    sold: [],
    active: [],
    referenceTime: REFERENCE_TIME,
  });

  assertEqual(result.priceBasis.tier, 'catalog', 'tier');
  assertEqual(result.priceBasis.value, 0, 'value');
  assertEqual(result.confidence, 0, 'confidence');
});

/* ─── 6. median() and removeOutliersIQR() correctness ─────────────────── */

check('median() of an odd-length array', () => {
  assertEqual(median([5, 1, 3]), 3, 'median of [5,1,3]');
});

check('median() of an even-length array', () => {
  assertEqual(median([1, 2, 3, 4]), 2.5, 'median of [1,2,3,4]');
});

check('median() of an empty array is 0', () => {
  assertEqual(median([]), 0, 'median of []');
});

check('removeOutliersIQR() returns input unchanged when < 4 items', () => {
  assertEqual(removeOutliersIQR([1, 1000]), [1, 1000], 'small set passthrough');
});

check('removeOutliersIQR() drops points beyond 1.5*IQR', () => {
  // sorted: [1,2,3,4,5,100] -> Q1=2 (idx1), Q3=5 (idx4), IQR=3
  // bounds: [2-4.5, 5+4.5] = [-2.5, 9.5] -> 100 is dropped
  const result = removeOutliersIQR([1, 2, 3, 4, 5, 100]);
  assertEqual(result, [1, 2, 3, 4, 5], 'outlier 100 removed');
});

/* ─── Summary ──────────────────────────────────────────────────────────── */

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
