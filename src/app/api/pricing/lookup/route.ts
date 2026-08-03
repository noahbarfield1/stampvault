/* ──────────────────────────────────────────────────────────────────────────────
 * POST /api/stamps/pricing/lookup
 *
 * Live stamp pricing with provenance. Scrapes real marketplace listings via the
 * configured ListingProvider (Firecrawl by default), aggregates them through the
 * recency/fallback tier ladder, and returns a PriceData whose `priceBasis` states
 * which source the headline value came from — with link + image proof.
 *
 * Fetch strategy is credit-thrifty: fetch recent SOLD listings first; only fetch
 * ACTIVE listings if no sales are found. Results are cached in-process for 24h so
 * repeated lookups of the same stamp don't re-scrape. (A Firestore-backed cache is
 * the production upgrade; see the design spec.)
 * ────────────────────────────────────────────────────────────────────────────── */
import { takeProviderUnavailableReason } from '@/lib/pricing/providers/firecrawl-provider';

import { NextRequest, NextResponse } from 'next/server';
import type { PriceData } from '@/types/stamp';
import { VERIFIED_STAMPS } from '@/lib/pricing/verified-database';
import { getListingProvider, type StampQuery } from '@/lib/pricing/providers';
import { aggregateLivePricing, MIN_ACTIVE_SAMPLE } from '@/lib/pricing/aggregate';
import { filterRelevantListings, splitByCondition } from '@/lib/pricing/relevance';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface LookupRequestBody {
  stampDescription?: string;
  scottNumber?: string;
  country?: string;
  year?: number;
  condition?: string;
  /** Client's Settings > Price Settings > Cache Duration, in ms. Falls back
   * to DEFAULT_CACHE_TTL_MS for callers that don't send it. */
  cacheDurationMs?: number;
  /** Set by the "Refresh Prices" button to bypass the cache entirely —
   * otherwise a manual refresh could silently return the same cached
   * result it was meant to replace. */
  forceRefresh?: boolean;
}

/* ─── In-process cache keyed by the normalized query ──────────────────── */

const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const priceCache = new Map<string, { at: number; data: PriceData }>();

function getCached(key: string, ttlMs: number): PriceData | null {
  const entry = priceCache.get(key);
  if (entry && Date.now() - entry.at < ttlMs) return entry.data;
  if (entry) priceCache.delete(key);
  return null;
}

function setCached(key: string, data: PriceData): void {
  priceCache.set(key, { at: Date.now(), data });
}

/* ─── Handler ────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LookupRequestBody;

    if (!body.stampDescription && !body.scottNumber && !body.country) {
      return NextResponse.json(
        {
          error:
            'At least one of stampDescription, scottNumber, or country is required',
        },
        { status: 400 },
      );
    }

    const query: StampQuery = {
      scottNumber: body.scottNumber ?? null,
      country: body.country ?? null,
      year: body.year ?? null,
      denomination: null,
      description: body.stampDescription ?? null,
      condition: body.condition ?? null,
    };

    const ttlMs =
      typeof body.cacheDurationMs === 'number' && body.cacheDurationMs > 0
        ? body.cacheDurationMs
        : DEFAULT_CACHE_TTL_MS;

    const cacheKey = JSON.stringify(query);
    const cached = body.forceRefresh ? null : getCached(cacheKey, ttlMs);
    if (cached) {
      return NextResponse.json({ pricing: cached, cached: true });
    }

    // Catalog fallback (Tier 4) from the verified database.
    const scott = body.scottNumber?.toLowerCase()?.trim();
    const country = body.country?.toLowerCase()?.trim();
    const verified =
      scott && country
        ? VERIFIED_STAMPS.find(
            (s) =>
              s.scottNumber.toLowerCase().trim() === scott &&
              s.country.toLowerCase().trim() === country,
          )
        : undefined;
    const catalog = verified
      ? {
          value: verified.estimatedValue,
          label: 'Catalog value — no recent sales found',
          url: null as string | null,
          imageUrl: verified.referenceImageUrl ?? null,
        }
      : null;

    // ONE scrape per lookup. Sold listings sit behind an eBay sign-in wall, so
    // asking for them cost a credit and returned a login page every time — see
    // firecrawl-provider.fetchSold. fetchSold now resolves to [] without a
    // network call, so this is asking for active listings only.
    const provider = getListingProvider();
    // Over-fetch: the relevance filter below discards the wrong stamp, and
    // eBay keyword search returns a majority of those. 12 in, ~5 usable out.
    const soldRaw = await provider.fetchSold(query, 30);
    const activeRaw = soldRaw.length === 0 ? await provider.fetchActive(query, 30) : [];

    // eBay keyword search is fuzzy even inside the Stamps category — a live
    // lookup for Scott 814 measured only 42% of results actually mentioning
    // 814. Averaging the rest prices this stamp from other stamps.
    const soldFiltered = filterRelevantListings(soldRaw, query);
    const activeFiltered = filterRelevantListings(activeRaw, query);

    // Condition drives most of a stamp's value, and was previously collected
    // and discarded — a "used" lookup was priced from mint comparables.
    const soldSplit = splitByCondition(soldFiltered.listings, query.condition, MIN_ACTIVE_SAMPLE);
    const activeSplit = splitByCondition(
      activeFiltered.listings,
      query.condition,
      MIN_ACTIVE_SAMPLE,
    );
    const sold = soldSplit.listings.slice(0, 12);
    const active = activeSplit.listings.slice(0, 12);

    const droppedAsIrrelevant = soldFiltered.droppedCount + activeFiltered.droppedCount;
    if (droppedAsIrrelevant > 0) {
      console.log(
        `[API /pricing/lookup] dropped ${droppedAsIrrelevant} listing(s) not matching catalogue number ${query.scottNumber}`,
      );
    }

    const pricing = aggregateLivePricing({
      sold,
      active,
      catalog,
      conditionLabel: activeSplit.label ?? soldSplit.label,
    });

    // If the provider was unavailable (out of credits, bad key) rather than
    // simply finding nothing, do NOT cache an empty result — otherwise a
    // billing outage gets baked in as "this stamp has no price" for 24 hours.
    const unavailable = takeProviderUnavailableReason();
    if (!unavailable) setCached(cacheKey, pricing);

    return NextResponse.json({
      pricing,
      ...(unavailable ? { unavailableReason: unavailable } : {}),
      provider: provider.name,
      sourcesUsed: {
        sold: sold.length,
        active: active.length,
        catalog: !!catalog,
        droppedAsIrrelevant,
        conditionMatched: activeSplit.matched || soldSplit.matched,
      },
      totalListings: pricing.sources.length,
    });
  } catch (error) {
    console.error('[API /pricing/lookup] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Price lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
