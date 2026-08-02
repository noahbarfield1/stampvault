/* ──────────────────────────────────────────────────────────────────────────────
 * eBay Browse API listing provider.
 *
 * Replaces scraping for pricing. Why it is strictly better:
 *
 *   - Free. ~5,000 calls/day on a standard developer account, versus one
 *     Firecrawl credit per lookup.
 *   - Structured JSON, so no markdown parsing and no breakage when eBay
 *     restyles its search page.
 *   - Not bot-blocked. The scraper was being served a sign-in wall for sold
 *     listings and could be throttled on active ones at any time.
 *
 * What it still cannot do: SOLD prices. Completed-sale data lives in eBay's
 * Marketplace Insights API, which is a restricted release requiring per-app
 * approval. Browse returns currently-listed items, so these remain ASKING
 * prices — which the UI says plainly.
 *
 * Auth is OAuth2 client credentials: exchange App ID + Cert ID for an
 * application token, which is cached in-process until shortly before expiry.
 * ────────────────────────────────────────────────────────────────────────────── */

import type { ListingProvider, MarketListing, StampQuery } from './types';

const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const SCOPE = 'https://api.ebay.com/oauth/api_scope';

/** Stamps. Narrows results and keeps unrelated categories out. */
const CATEGORY_STAMPS = '260';

const REQUEST_TIMEOUT_MS = 15_000;
/** Refresh a little early rather than racing an expiry mid-request. */
const TOKEN_SAFETY_WINDOW_MS = 60_000;

export function hasEbayCredentials(): boolean {
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  const usable = (v: string | undefined) => !!v && !v.startsWith('your-');
  return usable(id) && usable(secret);
}

/* ── Token ─────────────────────────────────────────────────────────────── */

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Exposed for tests; also lets a credential change take effect without a redeploy. */
export function resetEbayTokenCache(): void {
  cachedToken = null;
}

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_SAFETY_WINDOW_MS) {
    return cachedToken.value;
  }

  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) return null;

  const basic = Buffer.from(`${id}:${secret}`).toString('base64');

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&scope=${encodeURIComponent(SCOPE)}`,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      // 400/401 here means the App ID / Cert ID are wrong or not yet
      // production-enabled — worth saying out loud rather than returning [].
      console.error(`[ebay-provider] token request failed ${res.status}`);
      return null;
    }

    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;

    cachedToken = {
      value: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 7200) * 1000,
    };
    return cachedToken.value;
  } catch (err) {
    console.error('[ebay-provider] token request error:', err);
    return null;
  }
}

/* ── Query ─────────────────────────────────────────────────────────────── */

/**
 * Build the search phrase.
 *
 * Deliberately tight. The scraper appended the first eight words of the AI's
 * prose description, producing queries like
 * "RW8 United States A United States revenue stamp, commonly" — which matches
 * poorly and wastes the call. Catalogue number plus country is what sellers
 * actually put in their titles.
 */
export function buildEbayQuery(query: StampQuery): string {
  const parts: string[] = [];
  if (query.country) parts.push(query.country);
  if (query.scottNumber) parts.push(`Scott ${query.scottNumber}`);
  // Without a catalogue number, fall back to the physical description.
  if (!query.scottNumber) {
    if (query.year) parts.push(String(query.year));
    if (query.denomination) parts.push(query.denomination);
    parts.push('stamp');
  }
  return parts.join(' ').trim();
}

interface EbayItemSummary {
  title?: string;
  itemWebUrl?: string;
  image?: { imageUrl?: string };
  thumbnailImages?: { imageUrl?: string }[];
  price?: { value?: string; currency?: string };
}

function toListing(item: EbayItemSummary): MarketListing | null {
  const price = Number.parseFloat(item.price?.value ?? '');
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!item.itemWebUrl) return null;

  return {
    platform: 'ebay',
    listingType: 'active',
    price,
    currency: item.price?.currency ?? 'USD',
    // Browse returns live listings, so there is no sale date. Leaving this
    // null is what keeps the aggregator from treating it as a sold price.
    soldDate: null,
    url: item.itemWebUrl,
    imageUrl: item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl ?? null,
    title: item.title ?? 'eBay listing',
  };
}

async function searchActive(query: StampQuery, limit: number): Promise<MarketListing[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const q = buildEbayQuery(query);
  if (!q) return [];

  const url =
    `${SEARCH_URL}?q=${encodeURIComponent(q)}` +
    `&category_ids=${CATEGORY_STAMPS}` +
    `&limit=${Math.min(Math.max(limit, 1), 50)}` +
    `&filter=${encodeURIComponent('buyingOptions:{FIXED_PRICE|AUCTION}')}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        // Required by Browse; scopes results and currency to the US site.
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.status === 401) {
      // Token rejected — drop it so the next call re-authenticates.
      resetEbayTokenCache();
      console.error('[ebay-provider] search unauthorised; token cache cleared');
      return [];
    }
    if (!res.ok) {
      console.error(`[ebay-provider] search failed ${res.status} for "${q}"`);
      return [];
    }

    const json = (await res.json()) as { itemSummaries?: EbayItemSummary[] };
    return (json.itemSummaries ?? [])
      .map(toListing)
      .filter((l): l is MarketListing => l !== null)
      .slice(0, limit);
  } catch (err) {
    console.error('[ebay-provider] search error:', err);
    return [];
  }
}

export function createEbayProvider(): ListingProvider {
  return {
    name: 'ebay-browse',
    /**
     * Browse exposes only live listings. Completed sales require the
     * Marketplace Insights API, which is a restricted release. Returning []
     * without a call keeps the aggregator on its "asking price" tier, which is
     * the honest label for what this provider can see.
     */
    async fetchSold(): Promise<MarketListing[]> {
      return [];
    },
    fetchActive(query: StampQuery, limit: number): Promise<MarketListing[]> {
      return searchActive(query, limit);
    },
  };
}
