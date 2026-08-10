#!/usr/bin/env node
/* ─── pricing eligibility checks ──────────────────────────────────────
 *  Regression cover for the 2026-08-09 report: "only 1 stamp loaded a
 *  price", every other stamp identified correctly.
 *
 *  Root cause: the upload path and the Price Tracker disagreed about what
 *  counts as identified. Upload required aiConfidence >= 0.5 and skipped
 *  pricing SILENTLY when it failed; the Price Tracker checked only country,
 *  so the same stamp was priceable on one screen and not the other.
 *
 *  Run with: node src/lib/pricing/eligibility.check.mjs
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
  `eligibility.check.bundle.${process.pid}.${Date.now()}.mjs`,
);

await build({
  entryPoints: [path.join(__dirname, 'eligibility.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile,
  absWorkingDir: projectRoot,
  tsconfig: path.join(projectRoot, 'tsconfig.json'),
  logLevel: 'silent',
});

let pricingEligibility;
try {
  ({ pricingEligibility } = await import(pathToFileURL(outfile).href));
} finally {
  fs.rmSync(outfile, { force: true });
}

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  const ok = actual === expected;
  if (ok) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL ${name}\n       expected ${JSON.stringify(expected)}\n       actual   ${JSON.stringify(actual)}`);
  }
}

function checkMatch(name, actual, re) {
  const ok = typeof actual === 'string' && re.test(actual);
  if (ok) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL ${name}\n       expected match ${re}\n       actual         ${JSON.stringify(actual)}`);
  }
}

/* ── The reported bug ──────────────────────────────────────────────────
 * A stamp the model read correctly — real country, real catalogue number —
 * but scored below the confidence floor. It renders as fully identified, so
 * "no price" reads as "this stamp is worthless" rather than "we skipped it".
 * A catalogue number is a precise query and the relevance filter enforces it,
 * so this IS priceable. */
const lowConfidenceButCatalogued = {
  country: 'United States',
  scottNumber: '814',
  aiConfidence: 0.45,
};
check(
  'catalogued stamp is priceable despite low confidence',
  pricingEligibility(lowConfidenceButCatalogued).eligible,
  true,
);
check(
  'eligible results carry no reason',
  pricingEligibility(lowConfidenceButCatalogued).reason,
  null,
);

/* ── The gate still has to hold where it was earning its keep ───────────
 * Searching the marketplace with no catalogue number and no confidence
 * returns confident-looking prices for an entirely different stamp. */
check(
  'uncatalogued + low confidence stays blocked',
  pricingEligibility({ country: 'United States', scottNumber: null, aiConfidence: 0.4 }).eligible,
  false,
);
checkMatch(
  'blocked-for-confidence states the reason',
  pricingEligibility({ country: 'United States', scottNumber: null, aiConfidence: 0.4 }).reason,
  /confidence/i,
);
check(
  'uncatalogued + good confidence is priceable',
  pricingEligibility({ country: 'United States', scottNumber: null, aiConfidence: 0.9 }).eligible,
  true,
);
check(
  'confidence floor is inclusive at 0.5',
  pricingEligibility({ country: 'United States', scottNumber: null, aiConfidence: 0.5 }).eligible,
  true,
);

/* ── Unreadable stamps ─────────────────────────────────────────────────── */
for (const country of ['Unknown', 'Not a stamp', '', null, undefined]) {
  check(
    `country ${JSON.stringify(country)} is not priceable`,
    pricingEligibility({ country, scottNumber: '814', aiConfidence: 1 }).eligible,
    false,
  );
}
checkMatch(
  'blocked-for-country states the reason',
  pricingEligibility({ country: 'Unknown', scottNumber: null, aiConfidence: 1 }).reason,
  /countr/i,
);

/* ── A missing confidence must not read as a passing one ──────────────── */
check(
  'absent aiConfidence with no catalogue number is blocked',
  pricingEligibility({ country: 'United States', scottNumber: null, aiConfidence: undefined }).eligible,
  false,
);
check(
  'absent aiConfidence is fine when catalogued',
  pricingEligibility({ country: 'United States', scottNumber: '814', aiConfidence: undefined }).eligible,
  true,
);

/* ── Whitespace-only catalogue numbers are not catalogue numbers ───────── */
check(
  'blank scottNumber does not count as catalogued',
  pricingEligibility({ country: 'United States', scottNumber: '   ', aiConfidence: 0.4 }).eligible,
  false,
);

console.log(`\neligibility checks: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
