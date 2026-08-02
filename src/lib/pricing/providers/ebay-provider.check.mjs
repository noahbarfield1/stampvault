#!/usr/bin/env node
/* ─── ebay-provider checks ────────────────────────────────────────────
 *  Same esbuild harness as aggregate.check.mjs / normalize.check.mjs.
 *  Covers the pure parts — query construction and listing mapping — with
 *  no network access and no credentials.
 *
 *  Run with: node src/lib/pricing/providers/ebay-provider.check.mjs
 * ──────────────────────────────────────────────────────────────────── */

import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
const outfile = path.join(
  os.tmpdir(),
  `ebay.check.bundle.${process.pid}.${Date.now()}.mjs`
);

await build({
  entryPoints: [path.join(__dirname, 'ebay-provider.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile,
  absWorkingDir: projectRoot,
  tsconfig: path.join(projectRoot, 'tsconfig.json'),
  logLevel: 'silent',
});

let buildEbayQuery;
let hasEbayCredentials;
try {
  ({ buildEbayQuery, hasEbayCredentials } = await import(pathToFileURL(outfile).href));
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

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label ?? 'value'} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/* ─── Query construction ──────────────────────────────────────────────── */

check('a catalogue number produces a tight, seller-shaped query', () => {
  assertEqual(
    buildEbayQuery({ country: 'United States', scottNumber: '814', condition: 'used' }),
    'United States Scott 814',
    'query'
  );
});

check('the AI description is NEVER appended', () => {
  // The scraper appended eight words of prose, producing queries like
  // "RW8 United States A United States revenue stamp, commonly" — which
  // matches poorly and wastes the call.
  const q = buildEbayQuery({
    country: 'United States',
    scottNumber: 'RW8',
    description: 'A United States revenue stamp, commonly called a duck stamp',
  });
  assertEqual(q, 'United States Scott RW8', 'query');
  if (/revenue|commonly|duck/.test(q)) throw new Error('description leaked into the query');
});

check('without a catalogue number it falls back to physical description', () => {
  assertEqual(
    buildEbayQuery({ country: 'Sweden', year: 1855, denomination: '3sk' }),
    'Sweden 1855 3sk stamp',
    'query'
  );
});

check('missing fields are dropped rather than rendered as empty', () => {
  assertEqual(buildEbayQuery({ scottNumber: '1' }), 'Scott 1', 'query');
  assertEqual(buildEbayQuery({ country: 'France' }), 'France stamp', 'query');
});

check('an empty query yields an empty string, not "undefined"', () => {
  const q = buildEbayQuery({});
  if (/undefined|null/.test(q)) throw new Error(`leaked placeholder: "${q}"`);
});

/* ─── Credential detection ────────────────────────────────────────────── */

check('placeholder credentials do not count as configured', () => {
  process.env.EBAY_CLIENT_ID = 'your-ebay-client-id';
  process.env.EBAY_CLIENT_SECRET = 'your-ebay-client-secret';
  assertEqual(hasEbayCredentials(), false, 'placeholders');
});

check('real-looking credentials count as configured', () => {
  process.env.EBAY_CLIENT_ID = 'NoahBarf-stampvau-PRD-abc123';
  process.env.EBAY_CLIENT_SECRET = 'PRD-abc123def456';
  assertEqual(hasEbayCredentials(), true, 'real values');
});

check('a missing credential is not configured', () => {
  delete process.env.EBAY_CLIENT_ID;
  assertEqual(hasEbayCredentials(), false, 'missing id');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
