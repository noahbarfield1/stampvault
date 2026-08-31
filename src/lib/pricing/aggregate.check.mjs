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

check('no recent sold but enough active listings -> active tier', () => {
  const active = [
    activeListing({ price: 15 }),
    activeListing({ price: 25 }),
    activeListing({ price: 20 }),
  ];
  const result = aggregateLivePricing({
    sold: [],
    active,
    referenceTime: REFERENCE_TIME,
  });

  assertEqual(result.priceBasis.tier, 'active', 'tier');
  assertEqual(result.priceBasis.sampleSize, 3, 'sampleSize');
  assertEqual(result.priceBasis.asOf, null, 'asOf');
});

/* ─── 3b. Too few active listings is not a market ─────────────────────── */

check('fewer than MIN_ACTIVE_SAMPLE asking prices does NOT set a market price', () => {
  // Scott C3a: after replicas and souvenirs were filtered out, one $43.50
  // listing (an auction catalogue, not the stamp) was reporting the value of
  // a ~$1.5M rarity. One asking price is an anecdote, not a market.
  const result = aggregateLivePricing({
    sold: [],
    active: [activeListing({ price: 43.5 }), activeListing({ price: 23 })],
    catalog: { value: 1500000, label: 'Catalog value' },
    referenceTime: REFERENCE_TIME,
  });

  assertEqual(result.priceBasis.tier, 'catalog', 'tier');
  assertEqual(result.priceBasis.value, 1500000, 'value');
});

check('too few active listings and no catalog -> honest no-data, not a number', () => {
  const result = aggregateLivePricing({
    sold: [],
    active: [activeListing({ price: 43.5 })],
    referenceTime: REFERENCE_TIME,
  });

  if (result.priceBasis.tier === 'active') {
    throw new Error('a single asking price was reported as the market value');
  }
  assertEqual(result.priceBasis.value, 0, 'value');
});

/* ─── 3c. A single completed SALE is still evidence ───────────────────── */

check('one recent sold listing still prices the stamp', () => {
  // The threshold applies to asking prices only: a completed sale means
  // somebody actually paid that.
  const result = aggregateLivePricing({
    sold: [soldListing({ price: 12, soldDate: daysAgoISO(30) })],
    active: [],
    referenceTime: REFERENCE_TIME,
  });

  assertEqual(result.priceBasis.tier, 'live_sold', 'tier');
  assertEqual(result.priceBasis.value, 12, 'value');
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

/* ─── Condition label ──────────────────────────────────────────────────── */

check('the tier label states which condition was compared', () => {
  const active = [
    activeListing({ price: 2 }),
    activeListing({ price: 2.1 }),
    activeListing({ price: 1.9 }),
  ];

  const matched = aggregateLivePricing({
    sold: [], active, conditionLabel: 'used', referenceTime: REFERENCE_TIME,
  });
  if (!matched.priceBasis.label.includes('used')) {
    throw new Error(`label omitted the condition: "${matched.priceBasis.label}"`);
  }

  // "12 active" and "12 active · mixed condition" are very different claims;
  // the second must not be able to pose as the first.
  const mixed = aggregateLivePricing({
    sold: [], active, conditionLabel: 'mixed condition', referenceTime: REFERENCE_TIME,
  });
  if (!mixed.priceBasis.label.includes('mixed condition')) {
    throw new Error(`label hid the fallback: "${mixed.priceBasis.label}"`);
  }

  const none = aggregateLivePricing({ sold: [], active, referenceTime: REFERENCE_TIME });
  if (/condition|used|mint/i.test(none.priceBasis.label)) {
    throw new Error(`invented a condition claim: "${none.priceBasis.label}"`);
  }
});

/* ─── Range and confidence ─────────────────────────────────────────────
 *  Added 2026-08-23 with the statistics rewrite. The complaint these answer
 *  is "the prices are not accurate and the range is very large".
 * ────────────────────────────────────────────────────────────────────── */

const prices = (xs) => xs.map((price) => activeListing({ price }));

check('the headline value never falls outside the range it is shown with', () => {
  // The one invariant the UI depends on. Asserted across every tier and
  // every sample size, including the degenerate ones.
  const cases = [
    { label: 'tight active', args: { sold: [], active: prices([1.9, 2.0, 2.1, 2.2, 2.3]) } },
    { label: 'dispersed active', args: { sold: [], active: prices([0.99, 2, 5, 500, 79950]) } },
    { label: 'n=1 sold', args: { sold: [soldListing({ price: 12 })], active: [] } },
    {
      label: 'n=4 sold',
      args: { sold: [12, 13, 14, 900].map((price) => soldListing({ price })), active: [] },
    },
    { label: 'catalog only', args: { sold: [], active: [], catalog: { value: 40 } } },
    { label: 'nothing at all', args: { sold: [], active: [] } },
  ];

  for (const { label, args } of cases) {
    const r = aggregateLivePricing({ ...args, referenceTime: REFERENCE_TIME });
    const { min, max } = r.priceRange;
    if (max < min) throw new Error(`${label}: range is inverted (${min}..${max})`);
    // The catalog/none tiers carry no comparables, so their range is 0-0 and
    // the value legitimately sits outside it.
    if (r.priceBasis.sampleSize === 0) continue;
    if (r.estimatedValue < min || r.estimatedValue > max) {
      throw new Error(
        `${label}: value ${r.estimatedValue} outside range ${min}..${max}`,
      );
    }
  }
});

check('the range is labelled with what it actually spans', () => {
  const many = aggregateLivePricing({
    sold: [], active: prices([1, 2, 3, 4, 5]), referenceTime: REFERENCE_TIME,
  });
  assertEqual(many.priceBasis.priceRangeBasis, 'iqr', 'basis with 5 comparables');

  // Below 4 there are no meaningful quartiles. Saying 'iqr' anyway would be
  // a claim about a middle 50% that was never computed.
  const few = aggregateLivePricing({
    sold: [soldListing({ price: 10 }), soldListing({ price: 40 })],
    active: [],
    referenceTime: REFERENCE_TIME,
  });
  assertEqual(few.priceBasis.priceRangeBasis, 'full', 'basis with 2 comparables');

  const none = aggregateLivePricing({
    sold: [], active: [], catalog: { value: 5 }, referenceTime: REFERENCE_TIME,
  });
  assertEqual(none.priceBasis.priceRangeBasis, 'none', 'basis with no comparables');
});

check('a wildly-priced comparable no longer widens the range at n=4', () => {
  // THE REGRESSION, at the aggregator level. Four singles around $3 plus a
  // block of six at $79,950. The median is resistant so the VALUE was always
  // roughly right — but the old range was min..max of the survivors, and the
  // old outlier filter could not reject a maximum at n=4, so the app showed
  // "$3.25, range $2.50 - $79,950". That is the reported complaint.
  const r = aggregateLivePricing({
    sold: [], active: prices([2.5, 3.0, 3.5, 79950]), referenceTime: REFERENCE_TIME,
  });
  if (r.priceRange.max > 100) {
    throw new Error(`the outlier still drives the range: max ${r.priceRange.max}`);
  }
});

check('confidence responds to whether the comparables agree', () => {
  // Same tier, same sample size — only the spread differs. Both reported a
  // flat 0.6 before this.
  const tight = aggregateLivePricing({
    sold: [], active: prices([1.9, 1.95, 2.0, 2.05, 2.1]), referenceTime: REFERENCE_TIME,
  });
  const loose = aggregateLivePricing({
    sold: [], active: prices([0.99, 2, 20, 500, 79950]), referenceTime: REFERENCE_TIME,
  });

  assertEqual(tight.priceBasis.tier, 'active', 'tight tier');
  assertEqual(loose.priceBasis.tier, 'active', 'loose tier');
  if (!(tight.confidence > loose.confidence)) {
    throw new Error(
      `agreement did not raise confidence: tight ${tight.confidence} vs loose ${loose.confidence}`,
    );
  }
  // Still bounded by the tier weight, whatever the spread.
  if (tight.confidence > 0.6) {
    throw new Error(`active confidence exceeded its tier weight: ${tight.confidence}`);
  }
  if (loose.confidence < 0) throw new Error(`negative confidence: ${loose.confidence}`);
});

check('more comparables raise confidence at equal agreement', () => {
  const few = aggregateLivePricing({
    sold: [], active: prices([2, 2, 2]), referenceTime: REFERENCE_TIME,
  });
  const many = aggregateLivePricing({
    sold: [], active: prices([2, 2, 2, 2, 2]), referenceTime: REFERENCE_TIME,
  });
  if (!(many.confidence > few.confidence)) {
    throw new Error(`sample size ignored: ${few.confidence} -> ${many.confidence}`);
  }
});

/* ─── Summary ──────────────────────────────────────────────────────────── */

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
