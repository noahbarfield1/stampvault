/* ──────────────────────────────────────────────────────────────────────────────
 * Durable price cache — the collection builds its own catalogue.
 *
 * `verified-database.ts` holds 13 hand-authored stamps (8 of them US). For a
 * real album that fallback effectively never fires, and it cannot be grown by
 * hand: Scott catalogue values are Amos Media's copyrighted data and cannot be
 * imported, and Colnect/StampWorld both forbid scraping in their terms.
 *
 * So instead of authoring valuations, we REMEMBER observed ones. Every live
 * lookup that succeeds is written here keyed by catalogue number, and becomes
 * the fallback the next time that stamp is priced — by this collector or any
 * other. The catalogue grows at the rate the app is actually used, from real
 * listings, with the proof links retained.
 *
 * This doubles as the persistent read cache the pricing route's header has
 * always called "the production upgrade": today's cache is an in-process Map
 * that dies on every serverless cold start, so production re-scrapes constantly
 * and spends a Firecrawl credit doing it.
 *
 * Two honesty constraints shape the design:
 *
 *   1. ONLY catalogued stamps are cached. Without a Scott number the eBay query
 *      is fuzzy — "Italy 1930 stamp" matches thousands of unrelated items — and
 *      storing that under a country+year key would serve one stamp's price for
 *      another's.
 *   2. A cached price is presented as a dated observation, never as a live one.
 *      It carries its own tier, its own lower confidence, and the date it was
 *      taken.
 * ────────────────────────────────────────────────────────────────────────────── */

import type { PriceData, PriceBasis } from '@/types/stamp';

/** How long a remembered price stays usable. Stamp prices move slowly. */
export const PRICE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface PriceCacheQuery {
  country?: string | null;
  scottNumber?: string | null;
  condition?: string | null;
}

export interface CachedPriceRecord {
  estimatedValue: number;
  priceRange: { min: number; max: number };
  sampleSize: number;
  /** Epoch ms when the observation was taken. */
  fetchedAt: number | null;
  sources: {
    platform: string;
    price: number;
    /** Proof link. Nullable because aggregated sources are. */
    url: string | null;
    title?: string | null;
    imageUrl?: string | null;
  }[];
}

/** Collapse whitespace, lowercase, and drop anything not id-safe. */
function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');
}

/**
 * Stable Firestore document id for a stamp, or null when the stamp is not
 * precise enough to cache.
 *
 * Returns null rather than throwing: callers treat null as "not cacheable",
 * which is a normal outcome for an uncatalogued stamp, not an error.
 */
export function priceCacheKey(query: PriceCacheQuery): string | null {
  const country = query.country?.trim();
  // A leading # is how sellers and the model both often write it.
  const scott = query.scottNumber?.trim().replace(/^#+/, '').trim();
  if (!country || !scott) return null;

  const countrySlug = slug(country);
  const scottSlug = slug(scott);
  if (!countrySlug || !scottSlug) return null;

  // A missing condition is its own bucket, not a random one — otherwise the
  // same stamp lands in a different document on every lookup.
  const conditionSlug = slug(query.condition?.trim() || 'any') || 'any';

  const key = `${countrySlug}_${scottSlug}_${conditionSlug}`;
  // '.' and '..' are reserved document ids in Firestore.
  return key === '.' || key === '..' ? `id-${key.length}` : key;
}

/**
 * Whether a record is recent enough to serve.
 *
 * A timestamp in the future is treated as stale rather than fresh: it means a
 * clock is wrong somewhere, and the safe reading of "I don't know when this was
 * taken" is to go and look again.
 */
export function isFresh(
  record: { fetchedAt?: unknown } | null | undefined,
  ttlMs: number,
  now: number,
): boolean {
  const at = record?.fetchedAt;
  if (typeof at !== 'number' || !Number.isFinite(at)) return false;
  if (at > now) return false;
  return now - at < ttlMs;
}

function daysAgo(fetchedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - fetchedAt) / (24 * 60 * 60 * 1000)));
}

/**
 * Render a stored record as PriceData.
 *
 * Confidence is capped below what a live active-listing lookup earns (0.6). A
 * remembered price is strictly weaker evidence than one fetched a moment ago,
 * and the gap has to be visible in the number the UI sorts and badges on.
 */
export function toCachedPriceData(record: CachedPriceRecord, now: number): PriceData {
  const fetchedAt = typeof record.fetchedAt === 'number' ? record.fetchedAt : now;
  const age = daysAgo(fetchedAt, now);
  const asOf = new Date(fetchedAt).toISOString();
  const proofSource = record.sources?.[0] ?? null;

  const priceBasis: PriceBasis = {
    tier: 'cached',
    label:
      age === 0
        ? `Last known market price — recorded today from ${record.sampleSize} listing(s)`
        : `Last known market price — recorded ${age} day(s) ago from ${record.sampleSize} listing(s)`,
    value: record.estimatedValue,
    currency: 'USD',
    asOf,
    sampleSize: record.sampleSize,
    proof: proofSource
      ? {
          platform: proofSource.platform,
          url: proofSource.url ?? null,
          imageUrl: proofSource.imageUrl ?? null,
          title: proofSource.title ?? null,
          price: proofSource.price ?? null,
          soldDate: null,
        }
      : null,
  };

  // Decay with age as well as capping: a 29-day-old observation is weaker than
  // a 1-day-old one, and the number should say so.
  const freshnessFactor = 1 - Math.min(age / (PRICE_CACHE_TTL_MS / (24 * 60 * 60 * 1000)), 1);
  const confidence = Math.round(Math.max(0.15, 0.5 * freshnessFactor) * 100) / 100;

  return {
    estimatedValue: record.estimatedValue,
    currency: 'USD',
    confidence,
    priceRange: record.priceRange,
    lastUpdated: asOf,
    priceBasis,
    sources: (record.sources ?? []).map((s) => ({
      platform: s.platform as PriceData['sources'][number]['platform'],
      price: s.price,
      currency: 'USD',
      url: s.url,
      title: s.title ?? '',
      imageUrl: s.imageUrl ?? null,
      condition: 'unknown',
      soldDate: null,
      listingType: 'active',
      fetchedAt: asOf,
    })) as PriceData['sources'],
    hipValue: null,
    sourceBreakdown: {
      hipstamp: null,
      ebay: null,
      delcampe: null,
      stampworld: null,
    },
  } as PriceData;
}
