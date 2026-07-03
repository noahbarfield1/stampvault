#!/usr/bin/env node
/* ─── firecrawl-parse check ───────────────────────────────────────────
 *  Standalone check for parseEbayListings run against the real captured
 *  eBay sold-search fixture (__fixtures__/ebay-sold-814.md).
 *
 *  No test runner (jest/vitest/etc.) is configured in this project's
 *  package.json, so this script compiles firecrawl-parse.ts with esbuild
 *  (already a devDependency) into a temp ESM file, imports it, and
 *  asserts against the parsed output directly.
 *
 *  Run:  node src/lib/pricing/providers/firecrawl-parse.check.mjs
 * ──────────────────────────────────────────────────────────────────── */

import { build } from 'esbuild';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), 'firecrawl-parse-check-'));
  const outfile = join(tempDir, 'firecrawl-parse.mjs');

  try {
    await build({
      entryPoints: [join(__dirname, 'firecrawl-parse.ts')],
      outfile,
      bundle: false,
      format: 'esm',
      platform: 'node',
      target: 'node18',
      logLevel: 'silent',
    });

    const { parseEbayListings } = await import(pathToFileURL(outfile).href);

    const fixturePath = join(__dirname, '__fixtures__', 'ebay-sold-814.md');
    const markdown = await readFile(fixturePath, 'utf8');

    const listings = parseEbayListings(markdown, 'sold');

    const failures = [];

    if (listings.length < 10) {
      failures.push(`Expected at least ~10 listings, got ${listings.length}`);
    }

    listings.forEach((listing, i) => {
      if (!(typeof listing.price === 'number' && listing.price > 0)) {
        failures.push(`listing[${i}] price is not a positive number: ${JSON.stringify(listing.price)}`);
      }
      if (!(typeof listing.url === 'string' && /ebay\.com\/itm\/\d+/.test(listing.url))) {
        failures.push(`listing[${i}] url does not match /ebay\\.com\\/itm\\/\\d+/: ${listing.url}`);
      }
      if (!(typeof listing.imageUrl === 'string' && /i\.ebayimg\.com/.test(listing.imageUrl))) {
        failures.push(`listing[${i}] imageUrl missing/invalid: ${JSON.stringify(listing.imageUrl)}`);
      }
      if (!(typeof listing.soldDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(listing.soldDate))) {
        failures.push(`listing[${i}] soldDate is not YYYY-MM-DD: ${JSON.stringify(listing.soldDate)}`);
      }
    });

    console.log(`Parsed ${listings.length} listings from fixture.`);
    console.log('\nFirst 3 parsed listings:');
    console.log(JSON.stringify(listings.slice(0, 3), null, 2));

    if (failures.length > 0) {
      console.log(`\nFAIL — ${failures.length} issue(s):`);
      for (const f of failures) console.log(` - ${f}`);
      process.exitCode = 1;
    } else {
      console.log('\nPASS — all assertions succeeded.');
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('[firecrawl-parse.check] unexpected error:', err);
  process.exitCode = 1;
});
