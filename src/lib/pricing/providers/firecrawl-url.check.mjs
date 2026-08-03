#!/usr/bin/env node
/* ─── firecrawl search-URL checks ─────────────────────────────────────
 *  Guards the two defects a live production lookup exposed on 2026-08-02:
 *  an unscoped category and the AI description bleeding into the query.
 *
 *  Scott 814 returned, as priced "proof":
 *    "+GF+ 159 001 814 / 3-2841-1V CONDUCTIVITY ELECTRODE"   $70.00
 *    "Thorogood 814-4200 Men's 6" Leather Work Boots"        $209.99
 *
 *  Run with: node src/lib/pricing/providers/firecrawl-url.check.mjs
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
  `firecrawl-url.check.bundle.${process.pid}.${Date.now()}.mjs`
);

await build({
  entryPoints: [path.join(__dirname, 'firecrawl-provider.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile,
  absWorkingDir: projectRoot,
  tsconfig: path.join(projectRoot, 'tsconfig.json'),
  logLevel: 'silent',
});

let buildSearchUrl;
try {
  ({ buildSearchUrl } = await import(pathToFileURL(outfile).href));
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

const SAMPLE = {
  country: 'United States',
  scottNumber: '814',
  condition: 'used',
  description: 'A United States revenue stamp, commonly called a duck stamp',
};

/* ─── Category scoping ────────────────────────────────────────────────── */

check('the search is scoped to eBay\'s Stamps category, not the whole site', () => {
  const url = buildSearchUrl(SAMPLE, 'active');
  assert(url.includes('_sacat=260'), `expected _sacat=260, got: ${url}`);
  assert(!url.includes('_sacat=0'), 'category is still unscoped (_sacat=0)');
});

check('category scoping applies to sold searches too', () => {
  const url = buildSearchUrl(SAMPLE, 'sold');
  assert(url.includes('_sacat=260'), `expected _sacat=260, got: ${url}`);
  assert(url.includes('LH_Sold=1') && url.includes('LH_Complete=1'), 'lost the sold filters');
});

/* ─── Query construction ──────────────────────────────────────────────── */

check('the AI description never reaches the query string', () => {
  const url = buildSearchUrl(SAMPLE, 'active');
  assert(
    !/revenue|commonly|duck/i.test(decodeURIComponent(url)),
    `description leaked: ${decodeURIComponent(url)}`
  );
});

check('the catalogue number is qualified with "Scott", not left bare', () => {
  // A bare "814" is what matched a work boot's part number.
  const decoded = decodeURIComponent(buildSearchUrl(SAMPLE, 'active'));
  assert(/Scott 814/.test(decoded), `expected "Scott 814" in: ${decoded}`);
});

check('both providers search for the same phrase', () => {
  const decoded = decodeURIComponent(buildSearchUrl(SAMPLE, 'active'));
  const nkw = decodeURIComponent(new URL(decoded).searchParams.get('_nkw'));
  assert(nkw === 'United States Scott 814', `query drifted: "${nkw}"`);
});

check('an empty query still produces a well-formed URL', () => {
  const url = buildSearchUrl({}, 'active');
  assert(!/undefined|null/.test(url), `leaked placeholder: ${url}`);
  assert(url.startsWith('https://www.ebay.com/sch/'), `malformed: ${url}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
