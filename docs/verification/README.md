# Verification archive

Preserved evidence from the pre-Playwright test era. `e2e-reports/` is gitignored
(it is regenerated output), so the runs worth keeping were copied here.

## `2026-06-22-e2e-runs/`

Three reports from `tests/e2e-visual-test.js`, all from one afternoon:

| Report | Result |
|---|---|
| `...T16-26-31-408Z` | 13% (4/32) |
| `...T16-42-17-087Z` | 94% (30/32) |
| `...T17-03-19-364Z` | **100% (32/32)** |

The 100% run identified Harrison #814, Washington #804, Van Buren #813 and
Inverted Jenny C3/C3a at 0.95–1.00 confidence. **This is the only green run on
record**, and it predates the July commits and the Vertex AI migration.

Caveat: at the time, `src/app/api/stamps/identify/route.ts` short-circuited on a
1×1 PNG fixture and returned a hardcoded Inverted Jenny, and `tests/run-e2e.js`
sent exactly that PNG — so some contemporaneous "passing" API tests were
fabricated end to end. That bypass is removed as part of this overhaul, which is
why a fresh recorded run is required before identification can be called working.

## `identification-failures/`

26 bug files auto-filed by the same runner.

- **2 files, 2026-06-22** — "No stamps detected in inverted-jenny.jpg"; the
  segment route returned `{"stamps":[],"count":0}`.
- **24 files, 2026-07-03 03:59–04:08 UTC** — all "Stamp misidentified", every
  payload showing `country: "Unknown"`, `scottNumber: null`, `aiConfidence: 0.5`,
  `verificationStatus: "unverified"`.

**No report file was ever written for the July 3 run** — it was aborted or its
summary was discarded. Commit `eaee59d` ("stop intermittent 'Unknown'
identifications from runaway model thinking") landed later that same day and was
never re-verified with a recorded run.

The likely root cause is documented in the overhaul plan: the segment route
demanded 0–100 percentage coordinates while Gemini 2.5 emits 0–1000 natively, and
the clamp ran *before* normalization — flattening every box to `{100,100,100,100}`,
which then failed the minimum-size filter and yielded zero detections with an
HTTP 200.

These files are kept as the honest record of what was broken and when.

## Why the old runners are gone

`tests/run-e2e.js` and `tests/e2e-visual-test.js` were deleted in the
mobile-overhaul work. Three of `run-e2e.js`'s sixty assertions were
`checkFileContains(...)` checks requiring that `generateMockIdentifiedStamps`,
`lowerName` (the filename-matching fallback) and `'jenny'` still appeared in
`src/app/upload/page.tsx` — i.e. the suite was a ratchet holding the fabricated
data in place, and would have failed the moment that data was removed.

Roughly forty more were source-text tautologies asserting that a CSS file
contains the string `@media`. They proved nothing and broke on any refactor.
Its pricing assertions expected exact values of 350000 and 2300000 from
`/api/pricing/lookup`, which now performs a real eBay scrape — they would either
fail or silently assert the catalog fallback while looking like a live-price
test.

Current verification is `npm test` (typecheck + unit + lint). The unit layer
uses the existing esbuild `.check.mjs` pattern:

- `src/lib/segmentation/normalize.check.mjs` — 21 coordinate tests
- `src/lib/pricing/aggregate.check.mjs` — 12 pricing-ladder tests
- `src/lib/pricing/providers/firecrawl-parse.check.mjs`

A browser harness (Playwright, device projects, axe) is still outstanding.

## `2026-08-02-identification/`

The first honest identification evidence since 2026-06-22, produced by
`npm run test:live` (tests/live/identify.live.spec.ts) against a production
build with real Vertex AI calls.

**12 of 12 correct, 3 rounds per fixture, zero variance between rounds.**

| Fixture | Scott returned | Correct? |
|---|---|---|
| IMG_4184.jpg | 814 | ✅ US 1938 9¢ Harrison Prexie |
| stamp-4.png | 814 | ✅ same stamp, same answer |
| stamp-2.png | 804 | ✅ US 1938 1¢ Washington Prexie |
| inverted-jenny.jpg | C3a | ✅ the *inverted* variety, not plain C3 |

Confidence 98–100%, 12–15s per stamp.

Compare the previous run of record, 2026-07-03: 24 bug reports, every payload
`country: "Unknown"`, `scottNumber: null`, `aiConfidence: 0.5`. The difference
is the segmentation coordinate fix — Gemini emits 0-1000 box coordinates and the
route was clamping them to 100 *before* normalising, collapsing every box to
zero width.

This run cannot pass fraudulently: the 1×1-PNG mock bypass in
`identify/route.ts` that made the old suite green has been deleted.
