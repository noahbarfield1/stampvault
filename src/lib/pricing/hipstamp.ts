/* ─── HipStamp API Integration ───────────────────────────────────────
 *  HipStamp API docs: https://www.hipstamp.com/api
 *  Rate limits: 10 requests/second, 10,000 requests/day
 *  Auth: X-ApiKey header
 * ──────────────────────────────────────────────────────────────────── */

import type { PriceSource, StampCondition } from '@/types/stamp';

const HIPSTAMP_BASE_URL = 'https://www.hipstamp.com/api';

/* ─── Rate Limiter ───────────────────────────────────────────────────── */

class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxPerSecond: number;

  constructor(maxPerSecond: number) {
    this.maxPerSecond = maxPerSecond;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < 1000);

    if (this.timestamps.length >= this.maxPerSecond) {
      const oldest = this.timestamps[0];
      const waitMs = 1000 - (now - oldest) + 10; // 10ms buffer
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.timestamps.push(Date.now());
  }
}

const rateLimiter = new RateLimiter(10);

/* ─── Helpers ────────────────────────────────────────────────────────── */

function getApiKey(): string {
  const key = process.env.HIPSTAMP_API_KEY;
  if (!key) {
    throw new Error('HIPSTAMP_API_KEY environment variable is not set');
  }
  return key;
}

async function hipstampFetch<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T | null> {
  await rateLimiter.waitForSlot();

  const url = new URL(`${HIPSTAMP_BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-ApiKey': getApiKey(),
        Accept: 'application/json',
      },
      next: { revalidate: 3600 }, // cache for 1 hour in Next.js
    });

    if (response.status === 429) {
      // Rate limited — back off and retry once
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const retryResponse = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-ApiKey': getApiKey(),
          Accept: 'application/json',
        },
      });
      if (!retryResponse.ok) return null;
      return retryResponse.json() as Promise<T>;
    }

    if (!response.ok) {
      console.error(
        `[HipStamp] API error ${response.status}: ${response.statusText} for ${endpoint}`
      );
      return null;
    }

    return response.json() as Promise<T>;
  } catch (error) {
    console.error('[HipStamp] Network error:', error);
    return null;
  }
}

/* ─── HipStamp API Response Types ────────────────────────────────────── */

interface HipStampListing {
  id: number;
  title: string;
  price: number;
  currency: string;
  condition?: string;
  url?: string;
  sold_date?: string;
  status?: string;
  seller?: {
    username: string;
  };
  image_url?: string;
  category?: string;
  scott_number?: string;
}

interface HipStampSearchResponse {
  listings: HipStampListing[];
  total: number;
  page: number;
  per_page: number;
}

interface HipStampValueResponse {
  value: number | null;
  currency: string;
  data_points: number;
  confidence: number;
}

/* ─── Condition Mapping ──────────────────────────────────────────────── */

function mapHipStampCondition(condition?: string): StampCondition | null {
  if (!condition) return null;

  const normalized = condition.toLowerCase().trim();
  const conditionMap: Record<string, StampCondition> = {
    mint: 'mint',
    'mint never hinged': 'mint_nh',
    'mint nh': 'mint_nh',
    mnh: 'mint_nh',
    unused: 'unused',
    used: 'used',
    fine: 'fine',
    'very fine': 'very_fine',
    vf: 'very_fine',
    superb: 'superb',
    poor: 'poor',
  };

  return conditionMap[normalized] ?? null;
}

/* ─── Public API ─────────────────────────────────────────────────────── */

/**
 * Search HipStamp for listings matching the given query.
 * Returns an array of PriceSource objects. On failure, returns [].
 */
export async function searchHipStampListings(
  query: string
): Promise<PriceSource[]> {
  if (!query.trim()) return [];

  const data = await hipstampFetch<HipStampSearchResponse>('/listings', {
    q: query,
    per_page: '20',
    sort: 'relevance',
    status: 'sold',
  });

  if (!data || !data.listings) return [];

  const now = new Date().toISOString();

  return data.listings.map((listing): PriceSource => ({
    platform: 'hipstamp',
    price: listing.price,
    currency: listing.currency || 'USD',
    url: listing.url
      ? `https://www.hipstamp.com${listing.url}`
      : `https://www.hipstamp.com/listing/${listing.id}`,
    title: listing.title,
    condition: mapHipStampCondition(listing.condition),
    soldDate: listing.sold_date || null,
    listingType: listing.status === 'sold' ? 'sold' : 'active',
    fetchedAt: now,
  }));
}

/**
 * Search HipStamp for active (unsold) listings.
 */
export async function searchHipStampActiveListings(
  query: string
): Promise<PriceSource[]> {
  if (!query.trim()) return [];

  const data = await hipstampFetch<HipStampSearchResponse>('/listings', {
    q: query,
    per_page: '20',
    sort: 'price_asc',
    status: 'active',
  });

  if (!data || !data.listings) return [];

  const now = new Date().toISOString();

  return data.listings.map((listing): PriceSource => ({
    platform: 'hipstamp',
    price: listing.price,
    currency: listing.currency || 'USD',
    url: listing.url
      ? `https://www.hipstamp.com${listing.url}`
      : `https://www.hipstamp.com/listing/${listing.id}`,
    title: listing.title,
    condition: mapHipStampCondition(listing.condition),
    soldDate: null,
    listingType: 'active',
    fetchedAt: now,
  }));
}

/**
 * Fetch HipValue metric for a given stamp query.
 * Returns the estimated fair market value or null.
 */
export async function getHipValue(
  stampQuery: string
): Promise<number | null> {
  if (!stampQuery.trim()) return null;

  const data = await hipstampFetch<HipStampValueResponse>('/hipvalue', {
    q: stampQuery,
  });

  if (!data || data.value === null || data.value === undefined) return null;

  return data.value;
}

/**
 * Compute basic statistics from HipStamp sold listings.
 */
export async function getHipStampStats(
  query: string
): Promise<{ avg: number; min: number; max: number; count: number } | null> {
  const listings = await searchHipStampListings(query);

  if (listings.length === 0) return null;

  const prices = listings.map((l) => l.price).filter((p) => p > 0);
  if (prices.length === 0) return null;

  const sum = prices.reduce((acc, p) => acc + p, 0);

  return {
    avg: Math.round((sum / prices.length) * 100) / 100,
    min: Math.min(...prices),
    max: Math.max(...prices),
    count: prices.length,
  };
}
