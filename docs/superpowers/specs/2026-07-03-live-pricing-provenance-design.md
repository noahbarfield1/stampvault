# Live Pricing with Provenance — Design Spec

- **Date:** 2026-07-03
- **Status:** Approved (pending spec review)
- **Area:** `src/lib/pricing/**`, `src/app/api/pricing/**`, `src/app/collection/[id]`, `src/types/stamp.ts`
- **Related:** identify-route reliability fix (`eaee59d`), segmentation fix (`004a668`)

## 1. Problem

Today StampVault shows a single `estimatedValue` with no provenance. For stamps in the
seeded `VERIFIED_STAMPS` database (all current test stamps), that number is a hand-authored
catalog value; for everything else the only live source is Perplexity, which cannot deliver
verifiable pricing:

- **No images** — nothing to show as visual proof.
- **No reliable sale dates** — `soldDate` is always `null`, so "sold within N years" is unenforceable.
- **Weak links** — citation URLs are zipped to prices by array index and often do not correspond to the price shown.

The two sources that *do* return real listings with images and dates (eBay, HipStamp) are behind
placeholder API keys.

## 2. Goals

1. Show a **live price** — a real sale within the last **2 years** — whenever one can be found.
2. When no live price exists, fall back through a clearly-labeled ladder to catalog / last-known-sold.
3. **State the basis on the page** with **link proof** (the actual listing URL) and **visual confirmation** (the listing's thumbnail image).
4. List **all** collected sources below the headline.
5. Make the price source **swappable** behind an interface, with written swap instructions.

### Non-goals (this iteration)

- Currency conversion. MVP computes the headline value from **USD** listings only; non-USD listings appear in the "all sources" list labeled with their original currency. Conversion is a follow-up.
- Condition-perfect pricing. We aggregate listings matching the search query; fine-grained condition weighting is a follow-up.
- eBay Marketplace Insights API, real-time push updates, and changes to historical charting.

## 3. Validated assumptions (evidence)

A live Firecrawl scrape of an eBay **sold** search page (`&LH_Sold=1&LH_Complete=1`) on 2026-07-03
returned, in `markdown` format, **HTTP 200 in ~14s for 1 credit**, containing per-listing:

- sold prices (`$20.00`, `$2.50`, …)
- sale dates (`Sold Jun 17, 2026`, …)
- listing URLs (`https://www.ebay.com/itm/318414095829`)
- thumbnail images (`https://i.ebayimg.com/.../s-l500.webp`)

Each listing card co-locates image → item URL → sold date → title → price, so a **plain markdown
parser** yields structured listings — no LLM-extract needed (keeps it at 1 credit/scrape). The raw
sample is captured as the parser test fixture.

## 4. Architecture

```
identify → /api/pricing/lookup (stateless, pre-save)
                    │
                    ▼
        aggregate.ts (shared)
          ├─ query-hash cache (Firestore, 24h TTL)   ← avoids re-scraping
          ├─ ListingProvider (default: Firecrawl)     ← eBay sold+active, Delcampe, HipStamp
          │     └─ markdown parser → MarketListing[]
          ├─ Perplexity supplementary (labeled estimate, no proof)
          ├─ recency filter (≤ 2 yr) + IQR outlier removal
          ├─ tier selection → priceBasis (headline + proof)
          └─ verified-DB catalog fallback (Tier 4 floor)
                    │
                    ▼
        PriceData { estimatedValue, priceBasis, sources[], … }
                    │
   stamp saved → later refreshes go via /api/pricing/refresh (engine.ts, stampId cache)
                    │
                    ▼
   UI: headline value + basis badge + proof (thumbnail+link) + all-sources list
```

### 4.1 `ListingProvider` interface (swappable seam)

`src/lib/pricing/providers/types.ts`

```ts
export interface StampQuery {
  scottNumber?: string | null;
  country?: string | null;
  year?: number | null;
  denomination?: string | null;
  description?: string | null;
  condition?: string | null;
}

export interface MarketListing {
  platform: 'ebay' | 'delcampe' | 'hipstamp' | string;
  listingType: 'sold' | 'active';
  price: number;
  currency: string;        // 'USD', 'EUR', …
  soldDate: string | null; // ISO 8601; null for active listings
  url: string;             // proof link
  imageUrl: string | null; // thumbnail for visual confirmation
  title: string;
}

export interface ListingProvider {
  readonly name: string;
  fetchSold(query: StampQuery, limit: number): Promise<MarketListing[]>;
  fetchActive(query: StampQuery, limit: number): Promise<MarketListing[]>;
}
```

Contract: providers **never throw** — they return `[]` on any failure (network, block, parse). All
scraping happens server-side only.

### 4.2 Firecrawl provider (default)

`src/lib/pricing/providers/firecrawl-provider.ts`

- Builds marketplace search URLs from `StampQuery` (e.g. eBay sold: `.../sch/i.html?_nkw=<query>&LH_Sold=1&LH_Complete=1`; active: same without those params). Delcampe and HipStamp search URLs analogous.
- Calls Firecrawl `POST https://api.firecrawl.dev/v2/scrape` with `{ url, formats: ['markdown'], onlyMainContent: true }` using `FIRECRAWL_API_KEY` (server-only).
- Parses the markdown into `MarketListing[]` via a dedicated, unit-tested parser (`firecrawl-parse.ts`): split into listing cards, extract image URL, item URL, sold date (`Sold Mon D, YYYY` → ISO), title, and price (`$X.XX`).
- Caps results at `limit` (default 10) per source.

Provider selection via factory `getListingProvider()` keyed on `PRICING_PROVIDER` env (default `firecrawl`).

### 4.3 Perplexity supplementary source

Existing `searchStampWorldPrices` / generic search are kept but their outputs are tagged
`listingType: 'estimate'`, `imageUrl: null`, and are **ineligible for the proof tiers (1–3)**. They
contribute to the "all sources" list and can inform the Tier‑4 catalog value when the DB has none.
Clearly labeled in UI as "AI estimate — no listing proof."

### 4.4 Aggregation, recency, and tier selection

`src/lib/pricing/aggregate.ts` (new; absorbs the logic currently duplicated between
`api/pricing/lookup/route.ts` and `engine.ts`).

- **Recency window:** `RECENCY_DAYS = 730`. A sold listing "qualifies as live" when `soldDate >= now - 730d`.
- **Headline statistic:** `HEADLINE_STAT = 'median'` (configurable to `'most_recent'`). Value = median of USD prices in the selected tier after IQR outlier removal. Range = min/max of that filtered set.
- **Tier ladder → `priceBasis`:**

  | Tier | `tier` | Condition | Headline value | Proof exemplar | Badge label |
  |---|---|---|---|---|---|
  | 1 | `live_sold` | ≥1 sold listing within 730d | median of qualifying USD sold | most-recent qualifying sold listing | "Live sold · median of N sales (most recent Mon YYYY)" |
  | 2 | `active` | no recent sold, ≥1 active | median of active USD asking | the active listing whose price is nearest the median | "Currently listed (asking) · N active" |
  | 3 | `last_sold` | no recent sold, no active, ≥1 older sold | most-recent older sold price | that listing | "Last sold · Mon YYYY" |
  | 4 | `catalog` | nothing scraped | verified-DB `estimatedValue` (or StampWorld) | DB reference / StampWorld citation if any | "Catalog value — no recent sales found" |

  The proof exemplar carries its **own** price/date/url/image; the headline value is the aggregate.
  UI shows both honestly (e.g. headline "$18 · based on 6 sales in last 24mo", proof "most recent
  sale $20 on Jun 17 2026 — view").

### 4.5 Data-model changes

`src/types/stamp.ts`:

```ts
// PriceSource gains:
imageUrl?: string | null;

// PriceData gains:
priceBasis: {
  tier: 'live_sold' | 'active' | 'last_sold' | 'catalog';
  label: string;
  value: number;
  currency: string;
  asOf: string | null;          // ISO date of the proof sale/listing
  sampleSize: number;           // listings backing the value
  proof: {
    platform: string;
    url: string | null;
    imageUrl: string | null;
    title: string | null;
    price: number | null;
    soldDate: string | null;
  } | null;
};
```

`estimatedValue` continues to hold the headline number (`= priceBasis.value`) for backward
compatibility with existing aggregations, charts, and dashboard totals.

### 4.6 Caching & performance

- **Query-hash cache** (new Firestore collection `price_cache`, keyed by a hash of the normalized
  `StampQuery`, 24h TTL): the `/lookup` path checks it before scraping, so repeated identifies of the
  same stamp (and verified-DB stamps) don't re-scrape. This is the credit-control mechanism.
- **Scrape timing:** on first identify (cache miss) → scrape once, cache. A "Refresh prices" button
  forces a re-scrape via `/api/pricing/refresh` (existing `engine.ts` stampId cache, 24h TTL). A
  daily auto-refresh job is out of scope for now (trivial add-on later).
- Each scrape run parses at most 10 listings/source; sold + active + supplementary run via
  `Promise.allSettled` so one failure never blocks the rest. Route budgets: `/lookup` `maxDuration=60`,
  `/refresh` `maxDuration=120`.

## 5. API changes

- `POST /api/pricing/lookup` — unchanged request contract; response `pricing` now includes
  `priceBasis` and each `sources[]` entry may include `imageUrl`. Internally delegates to
  `aggregate.ts` (query-hash cache → provider → tier selection).
- `POST /api/pricing/refresh` — unchanged contract; `engine.ts` uses the same `aggregate.ts`.
- Duplicated stats/weight/outlier/confidence helpers removed from both call sites in favor of `aggregate.ts`.

## 6. UI changes

- **Stamp detail (`collection/[id]`):** headline value + **basis badge** (tier + date) + **proof block**
  (thumbnail + "View listing" link). Below: a **"Price sources"** list — each listing rendered with
  thumbnail, platform, sold/active + date, price, and link; Perplexity rows labeled "AI estimate."
- **Collection card:** small basis badge ("Sold 2025" / "Asking" / "Catalog").
- When `tier === 'catalog'`, the badge explicitly states no recent sales were found.

## 7. Error handling & graceful degradation

- Provider failure / zero listings → fall through the tier ladder; Tier 4 (catalog) is always
  available for verified-DB stamps, else `estimatedValue` may be `0` with `tier: 'catalog'` and a
  "no pricing found" label (never a fabricated number).
- Firecrawl 4xx/5xx or timeout → treated as empty (logged), pipeline continues on other sources.
- Missing `FIRECRAWL_API_KEY` → provider returns `[]` and logs once; app runs on Perplexity + catalog.

## 8. Security

- `FIRECRAWL_API_KEY` is server-only (no `NEXT_PUBLIC_` prefix); already added to `.env.local`, which
  is gitignored (`.gitignore:34`). Never returned to the client.
- Scraping executes only in API routes. Note: scraping marketplaces is subject to their ToS; graceful
  fallback covers blocks/layout changes. Provider abstraction allows swapping to official APIs.

## 9. How to swap the pricing source

1. Implement `ListingProvider` in `src/lib/pricing/providers/<name>-provider.ts` (e.g. an eBay Browse
   API provider). Return normalized `MarketListing[]`; never throw.
2. Register it in the `getListingProvider()` factory.
3. Select it via env: `PRICING_PROVIDER=<name>` and set that provider's required keys (e.g.
   `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET`, or `FIRECRAWL_API_URL` for self-hosted Firecrawl).
4. No other code changes: aggregation, tiers, caching, and UI consume the normalized interface.

The dormant `ebay.ts` / `hipstamp.ts` API clients remain and are the natural basis for a future
`ebay-api-provider` once credentials exist.

## 10. Testing

- **Unit — parser:** `firecrawl-parse.ts` against the saved eBay fixture
  (`src/lib/pricing/providers/__fixtures__/ebay-sold-814.md`) → asserts N listings with correct
  price/date/url/image.
- **Unit — recency:** boundary at exactly 730 days and 731 days.
- **Unit — tiers:** sold-recent present → `live_sold`; only active → `active`; only old sold →
  `last_sold`; nothing → `catalog`.
- **Unit — aggregation:** median, IQR outlier removal, USD-only headline, mixed platforms.
- **Live smoke:** script hitting `/api/pricing/lookup` for a real non-DB stamp, gated on
  `FIRECRAWL_API_KEY` presence (skipped in CI without a key).

## 11. Rollout / config

| Env | Purpose | Default |
|---|---|---|
| `FIRECRAWL_API_KEY` | Firecrawl scraping (server-only) | set in `.env.local` |
| `PRICING_PROVIDER` | provider selection | `firecrawl` |
| `FIRECRAWL_API_URL` | self-hosted Firecrawl (optional) | unset (hosted) |

## 12. Open risks

- **Scraper fragility:** eBay markup changes break the parser → covered by fallback + fixture tests; monitor.
- **Credits:** free tier ~500 credits; query-hash + 24h cache keep usage to ~1 credit per unique stamp per day.
- **Condition mismatch:** query-matched listings may mix conditions → acknowledged; refinement later.
```
