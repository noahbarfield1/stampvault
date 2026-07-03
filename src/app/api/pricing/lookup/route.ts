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

import { NextRequest, NextResponse } from 'next/server';
import type { PriceData } from '@/types/stamp';
import { VERIFIED_STAMPS } from '@/lib/pricing/verified-database';
import { getListingProvider, type StampQuery } from '@/lib/pricing/providers';
import { aggregateLivePricing } from '@/lib/pricing/aggregate';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface LookupRequestBody {
  stampDescription?: string;
  scottNumber?: string;
  country?: string;
  year?: number;
  condition?: string;
}

/* ─── In-process 24h cache keyed by the normalized query ─────────────── */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const priceCache = new Map<string, { at: number; data: PriceData }>();

function getCached(key: string): PriceData | null {
  const entry = priceCache.get(key);
  if (entry && Date.now() - entry.at < CACHE_TTL_MS) return entry.data;
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

    const cacheKey = JSON.stringify(query);
    const cached = getCached(cacheKey);
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

    // Live scrape: recent SOLD first; only fetch ACTIVE if no sales found.
    const provider = getListingProvider();
    let sold = await provider.fetchSold(query, 12);
    let active: typeof sold = [];
    if (sold.length === 0) {
      active = await provider.fetchActive(query, 12);
    }

    const pricing = aggregateLivePricing({ sold, active, catalog });
    setCached(cacheKey, pricing);

    return NextResponse.json({
      pricing,
      provider: provider.name,
      sourcesUsed: {
        sold: sold.length,
        active: active.length,
        catalog: !!catalog,
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
