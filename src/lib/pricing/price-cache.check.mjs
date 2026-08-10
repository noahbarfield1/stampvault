#!/usr/bin/env node
/* ─── durable price cache checks ──────────────────────────────────────
 *  The 13-entry verified database effectively never fires for a real
 *  collection. Rather than hand-authoring more entries — Scott values are
 *  copyrighted and cannot be imported — successful live lookups persist and
 *  become the fallback for the next collector who owns the same stamp.
 *
 *  These cover the pure logic only: key normalization, freshness, and the
 *  record shape. The Firestore round-trip is a thin adapter over them.
 *
 *  Run with: node src/lib/pricing/price-cache.check.mjs
 * ──────────────────────────────────────────────────────────────────── */

import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const outfile = path.join(
  os.tmpdir(),
  `price-cache.check.bundle.${process.pid}.${Date.now()}.mjs`,
);

await build({
  entryPoints: [path.join(__dirname, 'price-cache.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile,
  absWorkingDir: projectRoot,
  tsconfig: path.join(projectRoot, 'tsconfig.json'),
  logLevel: 'silent',
});

let priceCacheKey, isFresh, toCachedPriceData;
try {
  ({ priceCacheKey, isFresh, toCachedPriceData } = await import(pathToFileURL(outfile).href));
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
const checkMatch = (name, actual, re) => {
  if (typeof actual === 'string' && re.test(actual)) passed++;
  else {
    failed++;
    console.error(`  FAIL ${name}\n       expected match ${re}\n       actual ${JSON.stringify(actual)}`);
  }
};

/* ── Only catalogued stamps may be cached ──────────────────────────────
 * Without a catalogue number the eBay query is fuzzy — "Italy 1930 stamp"
 * matches thousands of unrelated items. Caching that under a country+year key
 * would serve one stamp's price for another's, which is exactly the class of
 * fabrication this codebase keeps removing. */
check(
  'no catalogue number means no cache entry',
  priceCacheKey({ country: 'Italy', scottNumber: null, condition: 'used' }),
  null,
);
check(
  'blank catalogue number means no cache entry',
  priceCacheKey({ country: 'Italy', scottNumber: '   ', condition: 'used' }),
  null,
);
check(
  'a country is required too',
  priceCacheKey({ country: null, scottNumber: '814', condition: 'used' }),
  null,
);

/* ── Normalization: the same stamp must hit the same key ───────────────── */
const canonical = priceCacheKey({
  country: 'United States',
  scottNumber: '814',
  condition: 'used',
});
check(
  'case and surrounding whitespace are normalized',
  priceCacheKey({ country: '  united states ', scottNumber: ' 814 ', condition: 'USED' }),
  canonical,
);
check(
  'a leading # on the catalogue number is stripped',
  priceCacheKey({ country: 'United States', scottNumber: '#814', condition: 'used' }),
  canonical,
);
check(
  'internal whitespace in the country is collapsed',
  priceCacheKey({ country: 'United   States', scottNumber: '814', condition: 'used' }),
  canonical,
);

/* ── …and different stamps must NOT collide ────────────────────────────── */
const differs = (label, q) => check(label, priceCacheKey(q) === canonical, false);
differs('condition changes the key', { country: 'United States', scottNumber: '814', condition: 'mint' });
differs('country changes the key', { country: 'Canada', scottNumber: '814', condition: 'used' });
differs('catalogue number changes the key', { country: 'United States', scottNumber: '814a', condition: 'used' });
check(
  'a missing condition is stable rather than random',
  priceCacheKey({ country: 'United States', scottNumber: '814', condition: null }),
  priceCacheKey({ country: 'United States', scottNumber: '814', condition: undefined }),
);

/* ── Firestore document-id safety ──────────────────────────────────────
 * A '/' would silently create a subcollection path; '.' and '..' are reserved. */
check('key contains no slash', canonical.includes('/'), false);
check('key is not a reserved dot name', canonical === '.' || canonical === '..', false);
check('key stays well under the 1500-byte id limit', canonical.length < 200, true);
checkMatch('key uses a safe character set', canonical, /^[a-z0-9._-]+$/);

/* ── Freshness ─────────────────────────────────────────────────────────── */
const DAY = 24 * 60 * 60 * 1000;
const now = 1_000 * DAY;
check('a just-written record is fresh', isFresh({ fetchedAt: now - 1000 }, 30 * DAY, now), true);
check('a record past the ttl is stale', isFresh({ fetchedAt: now - 31 * DAY }, 30 * DAY, now), false);
check('a record with no timestamp is stale', isFresh({ fetchedAt: null }, 30 * DAY, now), false);
check('a malformed timestamp is stale', isFresh({ fetchedAt: 'yesterday' }, 30 * DAY, now), false);
check('a future timestamp is not trusted', isFresh({ fetchedAt: now + 5 * DAY }, 30 * DAY, now), false);

/* ── The record must present itself honestly ───────────────────────────
 * This is a remembered market observation, not a catalogue valuation, and the
 * UI must not render it as a live price. */
const cached = toCachedPriceData(
  {
    estimatedValue: 2.25,
    priceRange: { min: 1.2, max: 3.5 },
    sampleSize: 4,
    fetchedAt: now - 10 * DAY,
    sources: [{ platform: 'ebay', price: 2.25, url: 'https://ebay.com/itm/1', title: 'Scott 814' }],
  },
  now,
);
check('cached value is carried through', cached.estimatedValue, 2.25);
checkMatch('the basis says it is a remembered price', cached.priceBasis.tier, /cache/i);
checkMatch('the label dates the observation', cached.priceBasis.label, /\d/);
check('cached confidence is below a live lookup', cached.confidence < 0.6, true);
check('the proof listings survive', cached.sources.length, 1);

console.log(`\nprice-cache checks: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
