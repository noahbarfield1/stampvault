# Pricing relevance — end-to-end verification, 2026-08-02

A full E2E pass (unit → production build → Playwright × 4 device profiles →
live Vertex AI → live Firecrawl against production) surfaced five defects in
the pricing path. All five are fixed and re-verified against live data.

The app's stated design goal is that nothing on screen is invented. Pricing was
violating it — not by fabricating numbers, but by computing real medians over
listings for the wrong object.

---

## What was wrong

### 1. The eBay search was not scoped to stamps

`buildSearchUrl` used `_sacat=0` — the entire site. A bare catalogue number
matched manufacturer part numbers. A production lookup for **Scott 814**
returned, as priced comparables:

| Price | Title |
|---|---|
| $70.00 | `+GF+ 159 001 814 / 3-2841-1V CONDUCTIVITY ELECTRODE SEN PVDF/SS` |
| $209.99 | `Thorogood 814-4200 Men's 6" Leather Moc Soft Toe Work Boots Brown` |

Fixed: `_sacat=260` (eBay's Stamps category).

### 2. The AI description bled into the query

The scraper appended six words of Gemini's prose, producing
`RW8 United States A United States revenue stamp, commonly`. The eBay API
provider had already been written to avoid exactly this; the scraper had its
own builder that did not. Both now share `buildEbayQuery`.

**Measured effect of 1 + 2 together**, same stamp, live scrape:

| Query | Listings | Actually mentioning 814 |
|---|---|---|
| old (`_sacat=0`, description bleed) | 134 | 6 — **4%** |
| new (`_sacat=260`, `United States Scott 814`) | 137 | 57 — **42%** |

### 3. Scraper noise glued onto every title

eBay's accessibility text was concatenated with no separator:
`...1938, usedOpens in a new window or tab`. Two consequences — it was
displayed to the user on every price-proof, and it destroyed the trailing word
boundary, so `REPRODUCTION` became `REPRODUCTIONOpens` and slipped past a
`\b`-anchored filter. Stripped in `firecrawl-parse.ts`.

### 4. No relevance filter (`src/lib/pricing/relevance.ts`, new)

42% relevance still means the median is computed over a majority of the wrong
stamp. Listings are now kept only when the title carries the catalogue number,
rejecting:

- part numbers and ranges — `814-4200`, `814 / 3-2841`, `Scott 814-816 set`
- reversed ranges — `C3-C3a` is a two-stamp listing, not a C3a one
- enumerated lots — `Scott Catalog #808, 809, 810,813 & 814 MNH` was being
  offered as the **proof link** for one stamp
- replicas and decor — see below

Plate blocks and pairs are deliberately kept; they are single collectibles.
When nothing matches, the result is an empty list, never a fallback to the
unfiltered set.

### 5. A $1.5M rarity priced at $43.50

Scott **C3a**, the Inverted Jenny. Genuine examples sell for roughly $1.5M and
essentially never appear on eBay, so every "comparable" was a souvenir:

| Price | Title |
|---|---|
| $4.99 | `US Scott #C3a 1918 24C "Inverted Jenny" Replica Stamp Block` |
| $34.99 | `Stamp Plak - Inverted Jenny - MINI - SCOTT C3A - WITH STAND` |
| $149.95 | `US Scott C3-C3a Inverted Jenny Air Mail Framed Wall Decor` |

Keyword filtering alone did not converge — each round left a new artefact
(letter opener, souvenir card, then a Siegel auction *catalogue* at $43.50).
The structural fix is `MIN_ACTIVE_SAMPLE = 3` in `aggregate.ts`: **asking
prices only count as a market when there are at least three of them.** One
asking price is an anecdote — nobody has agreed to pay it. Below the threshold
the ladder falls through to catalogue value or an honest "no market data".

Completed **sales** are exempt: one real sale means somebody actually paid.

---

## Result — live lookups after the fix

| Stamp | Before | After | Tier | Dropped |
|---|---|---|---|---|
| Scott 814 | $5.00 (from boots + electrode) | **$1.99** | 12 active | 6 |
| Scott 804 | — | **$1.75** | 12 active | 7 |
| Scott C3a | $34.99 → $43.50 (souvenirs) | **$350,000** | *Catalog value — no recent sales found* | 29 |
| Scott RW8 | — | **$23.47** | 12 active | 3 |

Every surviving comparable in all four is genuinely the stamp in question.

---

## Also fixed: `npm test` was spending money

`playwright.config.ts` intends `live-ai` to be opt-in, but the project-level
`testIgnore: []` (needed for `--project=live-ai` to select anything) overrode
the top-level `**/live/**` ignore. A bare `playwright test` — i.e. `npm test` —
ran **12 real Vertex AI calls every time**. The project is now only *defined*
when explicitly requested, so it fails loudly instead of silently billing.

Verified: default run selects 116 tests across 4 device profiles;
`--project=live-ai` still selects 12.

---

## Evidence

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `npm run test:unit` | **67 passed, 0 failed** (was 41), plus the uncounted firecrawl-parse suite |
| `npm run build` | compiled, 15 routes |
| Playwright × narrow-360 / pixel-5 / iphone-se / desktop | **114 passed, 2 skipped, 0 failed** |
| Live Vertex AI identification (12 calls) | **12/12 correct** — 814, 814, 804, C3a at 98–100% |
| `eslint src` on touched files | 0 findings |
| Firecrawl cost | unchanged — the 12→30 over-fetch parses more of one existing scrape |

The 2 skips are the touch-target tests correctly skipping on the desktop
profile.

---

## Round 2 — accuracy, not just provenance

The above established that every comparable is genuinely the right stamp. It did
not establish that the resulting number is right. Two further defects:

### 6. Condition was collected and thrown away

`condition` reached the query object and was used by nothing — not the search
phrase, not the filter, not the aggregator. A lookup for a **used** stamp was
priced from mint comparables.

This hides on cheap stamps. Scott 814 asked as `used`: mint comparables median
$1.76, used $1.99 — indistinguishable, because a common Prexie is ~$2 either
way. It does not hide on anything scarce.

`splitByCondition` now prefers same-condition comparables, falling back to all
conditions only when there are fewer than `MIN_ACTIVE_SAMPLE`, and labelling
that fallback `mixed condition` so the number cannot pose as condition-matched.
Grades (`fine`, `very_fine`, `superb`, `poor`) are treated as `unknown` — they
say nothing about which side of the mint/used divide a stamp sits on.

**Verified on stamps where the two actually diverge:**

| Stamp | asked `mint` | asked `used` | |
|---|---|---|---|
| Scott 285 — 1898 Trans-Miss 1c | **$28.68** (10, mint) | **$5.97** (12, used) | **4.8× apart** |
| Scott 230 — 1893 Columbian 1c | $12.99 (12, mint) | $12.49 (12, *mixed condition*) | fallback, labelled |
| Scott 814 — 1938 Prexie 9c | $1.76 (11, mint) | $1.99 (4, used) | control: genuinely close |

Zero condition leakage in any direction across all three. Before this change,
both columns returned the same number by construction.

### 7. A language model's guess was being stored as a price

When live pricing was skipped or failed, `to-stamp.ts` stored
`ident.estimatedValue.asIs` — Gemini's guess from the photo — as
`estimatedValue`, with a `priceRange` of exactly ±20% around it. That range had
no basis of any kind.

With no `priceBasis`, `PricingPanel` renders such a value under a plain
"Estimated Value" heading with no badge and no sources: visually identical to a
researched market price. And `dashboard/page.tsx` sums `estimatedValue` across
the collection into the headline **collection value**, so a model's guess about
a photograph silently inflated the user's portfolio total.

Now dropped. An unpriced stamp renders as "Not priced" with an em dash until a
real lookup runs. A model guessing dollars from an image is not evidence.

## Known, not fixed

- **Sold prices are unavailable.** eBay gates completed listings behind a
  sign-in wall and the Browse API returns live listings only; completed sales
  need Marketplace Insights, a restricted release. Tier 1 (`live_sold`) is
  therefore unreachable today and every price is labelled as an asking price.
- `.env.local` still sets `GOOGLE_API_KEY` / `GEMINI_API_KEY`. They are unused
  — every call site passes `vertexai: true` — but they make `@google/genai`
  print `Using GOOGLE_API_KEY` on startup, which reads as if the app were on
  API-key auth rather than ADC.
