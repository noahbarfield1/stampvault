#!/usr/bin/env node
/* ─── relevance filter checks ─────────────────────────────────────────
 *  The junk titles below are verbatim from a real production lookup for
 *  Scott 814 on 2026-08-02.
 *
 *  Run with: node src/lib/pricing/relevance.check.mjs
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
  `relevance.check.bundle.${process.pid}.${Date.now()}.mjs`
);

await build({
  entryPoints: [path.join(__dirname, 'relevance.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile,
  absWorkingDir: projectRoot,
  tsconfig: path.join(projectRoot, 'tsconfig.json'),
  logLevel: 'silent',
});

let filterRelevantListings;
let classifyListingCondition;
let normalizeQueryCondition;
let splitByCondition;
try {
  ({
    filterRelevantListings,
    classifyListingCondition,
    normalizeQueryCondition,
    splitByCondition,
  } = await import(pathToFileURL(outfile).href));
} finally {
  fs.rmSync(outfile, { force: true });
}

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`FAIL: ${name}\n      ${err.message}`);
    failed++;
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const listing = (title, price = 5) => ({
  platform: 'ebay',
  listingType: 'active',
  price,
  currency: 'USD',
  soldDate: null,
  url: 'https://www.ebay.com/itm/1',
  imageUrl: null,
  title,
});

/* ─── The production failure ──────────────────────────────────────────── */

check('the two junk listings that polluted a real Scott 814 lookup are dropped', () => {
  const input = [
    listing('United States Stamp Scott #814, Mint Lightly Hinged', 1.77),
    listing('+GF+ 159 001 814 / 3-2841-1V CONDUCTIVITY ELECTRODE SEN PVDF/SS', 70),
    listing('Thorogood 814-4200 Men\'s 6" Leather Moc Soft Toe Work Boots', 209.99),
  ];
  const { listings, droppedCount } = filterRelevantListings(input, { scottNumber: '814' });
  assert(listings.length === 1, `kept ${listings.length}, expected 1`);
  assert(droppedCount === 2, `dropped ${droppedCount}, expected 2`);
  assert(listings[0].price === 1.77, 'kept the wrong listing');
});

check('a part number like 814-4200 is not a catalogue-number match', () => {
  const { listings } = filterRelevantListings(
    [listing('Thorogood 814-4200 Work Boots')],
    { scottNumber: '814' }
  );
  assert(listings.length === 0, 'hyphenated part number matched');
});

check('a range or multi-stamp lot is not a single-stamp comparable', () => {
  // A set sells for several times a single stamp; counting one drags the
  // median up. Same guard as the part-number case.
  const { listings } = filterRelevantListings(
    [listing('US Scott 814-816 Prexy set MNH'), listing('Scott 814 / 815 pair')],
    { scottNumber: '814' }
  );
  assert(listings.length === 0, `matched ${listings.length} lot listings`);
});

check('a multi-stamp lot is not offered as proof of one stamp\'s value', () => {
  // Verbatim: this $2.00 listing was chosen as the proof link for Scott 814.
  const { listings } = filterRelevantListings(
    [listing('Scott Catalog #808, 809, 810,813 & 814 MNH', 2)],
    { scottNumber: '814' }
  );
  assert(listings.length === 0, 'a five-stamp lot was priced as one stamp');
});

check('a plate block or pair is still a single collectible, not a lot', () => {
  // Two numbers can appear legitimately; three is where it is unambiguous.
  const titles = [
    'US Scott 814 Mint Never Hinged Very Fine Plate Block Plate 22798',
    'Scott# 814 9c Harrison Used Stamp Pair 1938-43',
  ];
  const { listings } = filterRelevantListings(titles.map((t) => listing(t)), {
    scottNumber: '814',
  });
  assert(listings.length === 2, `over-filtered: kept only ${listings.length}/2`);
});

check('replicas and decor are not comparables for the real stamp', () => {
  // Verbatim from a live C3a lookup. A genuine Inverted Jenny is ~$1.5M;
  // the app reported $34.99 by averaging these.
  const input = [
    listing('US Scott #C3a 1918 24C "Inverted Jenny" Replica Stamp Block', 4.99),
    listing('Stamp Plak - Inverted Jenny - MINI - SCOTT C3A - WITH STAND', 34.99),
    listing('US Scott C3-C3a Inverted Jenny Air Mail Framed Wall Decor', 149.95),
  ];
  const { listings } = filterRelevantListings(input, { scottNumber: 'C3a' });
  assert(listings.length === 0, `priced a rarity from ${listings.length} souvenir(s)`);
});

check('a souvenir card bearing the catalogue number is not the stamp', () => {
  const { listings } = filterRelevantListings(
    [listing('US Scott #C3a Souvenir Card #SC78 Cat. Value $2.50', 23)],
    { scottNumber: 'C3a' }
  );
  assert(listings.length === 0, 'a souvenir card was priced as the stamp');
});

check('an ordinary stamp listing is not mistaken for a replica', () => {
  const titles = [
    'US Scott C3a Inverted Jenny position 58 certified',
    'Scott 814 9c Harrison MNH original gum',
  ];
  const a = filterRelevantListings([listing(titles[0])], { scottNumber: 'C3a' });
  const b = filterRelevantListings([listing(titles[1])], { scottNumber: '814' });
  assert(a.listings.length === 1 && b.listings.length === 1, 'over-filtered a real listing');
});

check('a range written backwards (C3-C3a) is not a C3a listing', () => {
  const { listings } = filterRelevantListings(
    [listing('US Scott C3-C3a Inverted Jenny Air Mail pair')],
    { scottNumber: 'C3a' }
  );
  assert(listings.length === 0, 'a two-stamp range was priced as one stamp');
});

check('the common "Scott 814 - Mint NH" dash format still matches', () => {
  // The range guard is digit-only precisely so this keeps working.
  const { listings } = filterRelevantListings(
    [listing('US Scott 814 - Mint NH fine centering'), listing('Scott 814 -- used')],
    { scottNumber: '814' }
  );
  assert(listings.length === 2, `over-filtered: kept ${listings.length}/2`);
});

check('a longer number containing the catalogue number is not a match', () => {
  const { listings } = filterRelevantListings(
    [listing('US Scott 8140 something'), listing('Lot of 1814 stamps')],
    { scottNumber: '814' }
  );
  assert(listings.length === 0, `matched ${listings.length} substring hits`);
});

/* ─── Real title shapes sellers use ───────────────────────────────────── */

check('the common seller title formats all match', () => {
  const titles = [
    'United States Stamp Scott #814, Mint Lightly Hinged',
    'US Scott 814 Mint Never Hinged Very Fine Plate Block',
    'Scott #814 9c Harrison Prexy Issue MNH',
    '#814 US 1938 Presidential Series Used',
    'USA 814 mint nh',
  ];
  const { listings } = filterRelevantListings(titles.map((t) => listing(t)), {
    scottNumber: '814',
  });
  assert(listings.length === titles.length, `only ${listings.length}/${titles.length} matched`);
});

check('letter-bearing catalogue numbers work (C3a, RW8)', () => {
  const a = filterRelevantListings(
    [listing('US Scott C3a Inverted Jenny reprint'), listing('US Scott C3 airmail')],
    { scottNumber: 'C3a' }
  );
  assert(a.listings.length === 1, `C3a matched ${a.listings.length}, expected 1`);

  const b = filterRelevantListings(
    [listing('RW8 1941 Federal Duck Stamp'), listing('RW80 duck stamp')],
    { scottNumber: 'RW8' }
  );
  assert(b.listings.length === 1, `RW8 matched ${b.listings.length}, expected 1`);
});

check('matching is case-insensitive', () => {
  const { listings } = filterRelevantListings([listing('us scott c3a jenny')], {
    scottNumber: 'C3A',
  });
  assert(listings.length === 1, 'case-sensitive match');
});

/* ─── Conservative behaviour ──────────────────────────────────────────── */

check('without a catalogue number nothing is filtered', () => {
  const input = [listing('Some stamp'), listing('Work boots')];
  const { listings, filtered, droppedCount } = filterRelevantListings(input, {
    country: 'United States',
  });
  assert(filtered === false, 'claimed to have filtered');
  assert(listings.length === 2, 'dropped listings with no signal to go on');
  assert(droppedCount === 0, 'reported drops it did not make');
});

check('zero matches yields an empty list, NOT a fallback to the junk', () => {
  // Falling back would price this stamp from listings for other stamps.
  const { listings } = filterRelevantListings(
    [listing('Work boots', 209.99), listing('Electrode', 70)],
    { scottNumber: '814' }
  );
  assert(listings.length === 0, `fell back to ${listings.length} irrelevant listings`);
});

check('a missing title never throws', () => {
  const { listings } = filterRelevantListings(
    [{ platform: 'ebay', price: 5, title: undefined }],
    { scottNumber: '814' }
  );
  assert(listings.length === 0, 'undefined title matched');
});

/* ─── Condition ───────────────────────────────────────────────────────── */

check('"unused" is mint, and does not read as "used"', () => {
  // There is no word boundary between "un" and "used", which is the only
  // reason a \bused\b test is safe here.
  assert(classifyListingCondition('US Scott 814 unused OG') === 'mint', 'unused misread');
  assert(classifyListingCondition('US Scott 814 used') === 'used', 'used misread');
});

check('real seller titles classify the way a collector would read them', () => {
  const cases = [
    ['Scott 814- MNH- 9c William H. Harrison', 'mint'],
    ['United States Stamp Scott #814, Mint Lightly Hinged', 'mint'],
    ['US Scott 814 Mint Never Hinged Very Fine Plate Block', 'mint'],
    ['United States, Scott 814, William H Harrison, 1938, used', 'used'],
    ['Scott# 814 9c Harrison Used Stamp Pair 1938-43', 'used'],
    ['United States Scott 814 Ink address.', 'unknown'],
  ];
  for (const [title, want] of cases) {
    const got = classifyListingCondition(title);
    assert(got === want, `"${title.slice(0, 40)}" -> ${got}, expected ${want}`);
  }
});

check('a title claiming both conditions is unknown, not guessed', () => {
  assert(
    classifyListingCondition('Scott 814 lot: mint and used copies') === 'unknown',
    'guessed a side of an ambiguous title'
  );
});

check('grades are not mint-vs-used and must not be treated as one', () => {
  // 'very_fine' says nothing about which side of the divide a stamp is on.
  for (const grade of ['fine', 'very_fine', 'superb', 'poor', 'unknown', null]) {
    assert(normalizeQueryCondition(grade) === 'unknown', `${grade} was treated as a side`);
  }
  assert(normalizeQueryCondition('mint_nh') === 'mint', 'mint_nh');
  assert(normalizeQueryCondition('unused') === 'mint', 'unused');
  assert(normalizeQueryCondition('used') === 'used', 'used');
});

check('with enough same-condition comparables, only those are priced', () => {
  const input = [
    listing('Scott 814 used', 2),
    listing('Scott 814 used cancel', 2.1),
    listing('Scott 814 postally used', 1.9),
    listing('Scott 814 MNH', 40),
    listing('Scott 814 Mint NH sheet', 39),
  ];
  const split = splitByCondition(input, 'used', 3);
  assert(split.matched === true, 'did not match on condition');
  assert(split.listings.length === 3, `kept ${split.listings.length}, expected 3`);
  assert(split.label === 'used', `label was ${split.label}`);
  assert(!split.listings.some((l) => /MNH|Mint/.test(l.title)), 'a mint listing leaked in');
});

check('too few same-condition comparables falls back, but SAYS so', () => {
  // Better a labelled mixed-condition number than none — but the user has to
  // be told that is what they are looking at.
  const input = [
    listing('Scott 814 used', 2),
    listing('Scott 814 MNH', 40),
    listing('Scott 814 Mint NH sheet', 39),
    listing('Scott 814 mint og', 38),
  ];
  const split = splitByCondition(input, 'used', 3);
  assert(split.matched === false, 'claimed a condition match it did not have');
  assert(split.listings.length === 4, 'dropped listings instead of falling back');
  assert(split.label === 'mixed condition', `label was ${split.label}`);
});

check('an unknown requested condition filters nothing and claims nothing', () => {
  const input = [listing('Scott 814 used', 2), listing('Scott 814 MNH', 40)];
  const split = splitByCondition(input, 'very_fine', 3);
  assert(split.listings.length === 2, 'filtered on a grade');
  assert(split.matched === false && split.label === null, 'labelled a non-comparison');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
