/* ─── eBay Browse API Integration ────────────────────────────────────
 *  Uses OAuth2 Client Credentials for app-level access.
 *  Browse API for searching completed/sold stamp listings.
 *  Category 260 = Stamps
 * ──────────────────────────────────────────────────────────────────── */

import type { PriceSource, StampCondition } from '@/types/stamp';

const EBAY_BASE_URL = 'https://api.ebay.com';
const EBAY_AUTH_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const STAMPS_CATEGORY_ID = '260';

/* ─── Token Cache ────────────────────────────────────────────────────── */

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let tokenCache: CachedToken | null = null;

/* ─── Helpers ────────────────────────────────────────────────────────── */

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'EBAY_CLIENT_ID and EBAY_CLIENT_SECRET environment variables must be set'
    );
  }

  return { clientId, clientSecret };
}

/**
 * Obtain an eBay OAuth2 access token using client credentials flow.
 * Tokens are cached in memory until 5 minutes before expiry.
 */
async function getEbayToken(): Promise<string> {
  // Return cached token if still valid (with 5-min buffer)
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
    return tokenCache.accessToken;
  }

  const { clientId, clientSecret } = getCredentials();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64'
  );

  try {
    const response = await fetch(EBAY_AUTH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope',
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[eBay] Auth failed ${response.status}: ${errorText}`
      );
      throw new Error(`eBay OAuth failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      token_type: string;
    };

    tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return tokenCache.accessToken;
  } catch (error) {
    console.error('[eBay] Token acquisition failed:', error);
    throw error;
  }
}

/* ─── eBay API Response Types ────────────────────────────────────────── */

interface EbayItemSummary {
  itemId: string;
  title: string;
  price: {
    value: string;
    currency: string;
  };
  condition: string;
  conditionId: string;
  itemWebUrl: string;
  itemEndDate?: string;
  sellingStatus?: string;
  categories?: { categoryId: string; categoryName: string }[];
  image?: { imageUrl: string };
  seller?: { username: string; feedbackPercentage: string };
  buyingOptions?: string[];
}

interface EbaySearchResponse {
  href: string;
  total: number;
  next?: string;
  limit: number;
  offset: number;
  itemSummaries?: EbayItemSummary[];
  warnings?: { errorId: number; message: string }[];
}

/* ─── Condition Mapping ──────────────────────────────────────────────── */

function mapEbayCondition(conditionId: string): StampCondition | null {
  const conditionMap: Record<string, StampCondition> = {
    '1000': 'mint',       // New
    '1500': 'mint_nh',    // New other
    '2000': 'unused',     // Certified refurbished (not stamp-relevant but map to unused)
    '2500': 'unused',     // Seller refurbished
    '3000': 'used',       // Used
    '4000': 'very_fine',  // Very Good
    '5000': 'fine',       // Good
    '6000': 'used',       // Acceptable
    '7000': 'poor',       // For parts / not working
  };

  return conditionMap[conditionId] ?? null;
}

/* ─── Browse API Fetch Helper ────────────────────────────────────────── */

async function ebayBrowseFetch(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<EbaySearchResponse | null> {
  let token: string;
  try {
    token = await getEbayToken();
  } catch {
    return null;
  }

  const url = new URL(`${EBAY_BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    });

    if (response.status === 401) {
      // Token might be expired, clear cache and retry once
      tokenCache = null;
      try {
        const freshToken = await getEbayToken();
        const retryResponse = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${freshToken}`,
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          },
        });
        if (!retryResponse.ok) return null;
        return retryResponse.json() as Promise<EbaySearchResponse>;
      } catch {
        return null;
      }
    }

    if (!response.ok) {
      console.error(
        `[eBay] API error ${response.status}: ${response.statusText} for ${endpoint}`
      );
      return null;
    }

    return response.json() as Promise<EbaySearchResponse>;
  } catch (error) {
    console.error('[eBay] Network error:', error);
    return null;
  }
}

/* ─── Public API ─────────────────────────────────────────────────────── */

/**
 * Build a filter string for the eBay Browse API.
 */
function buildFilterString(condition?: string): string {
  const filters: string[] = [
    `categoryIds:{${STAMPS_CATEGORY_ID}}`,
    'buyingOptions:{FIXED_PRICE|AUCTION}',
  ];

  if (condition) {
    const conditionIdMap: Record<string, string> = {
      mint: '1000',
      mint_nh: '1500',
      unused: '1500',
      used: '3000',
      fine: '5000',
      very_fine: '4000',
    };
    const conditionId = conditionIdMap[condition];
    if (conditionId) {
      filters.push(`conditionIds:{${conditionId}}`);
    }
  }

  return filters.join(',');
}

/**
 * Search eBay for completed/sold stamp listings.
 * Returns PriceSource array with links to actual eBay listings.
 */
export async function searchEbaySoldListings(
  query: string,
  condition?: string
): Promise<PriceSource[]> {
  if (!query.trim()) return [];

  // Browse API search_by_keyword endpoint for sold items
  const data = await ebayBrowseFetch('/buy/browse/v1/item_summary/search', {
    q: `stamp ${query}`,
    filter: buildFilterString(condition),
    sort: '-price',
    limit: '25',
    fieldgroups: 'MATCHING_ITEMS',
  });

  if (!data || !data.itemSummaries) return [];

  const now = new Date().toISOString();

  return data.itemSummaries.map((item): PriceSource => ({
    platform: 'ebay',
    price: parseFloat(item.price.value),
    currency: item.price.currency || 'USD',
    url: item.itemWebUrl,
    title: item.title,
    condition: mapEbayCondition(item.conditionId),
    soldDate: item.itemEndDate || null,
    listingType: item.itemEndDate ? 'sold' : 'active',
    fetchedAt: now,
  }));
}

/**
 * Search eBay for currently active stamp listings.
 */
export async function searchEbayActiveListings(
  query: string,
  condition?: string
): Promise<PriceSource[]> {
  if (!query.trim()) return [];

  const data = await ebayBrowseFetch('/buy/browse/v1/item_summary/search', {
    q: `stamp ${query}`,
    filter: buildFilterString(condition),
    sort: 'price',
    limit: '20',
    fieldgroups: 'MATCHING_ITEMS',
  });

  if (!data || !data.itemSummaries) return [];

  const now = new Date().toISOString();

  return data.itemSummaries.map((item): PriceSource => ({
    platform: 'ebay',
    price: parseFloat(item.price.value),
    currency: item.price.currency || 'USD',
    url: item.itemWebUrl,
    title: item.title,
    condition: mapEbayCondition(item.conditionId),
    soldDate: null,
    listingType: 'active',
    fetchedAt: now,
  }));
}

/**
 * Compute average, min, max price from recent eBay sold listings for a Scott number.
 */
export async function getEbayAveragePrice(
  scottNumber: string
): Promise<{ avg: number; min: number; max: number; count: number } | null> {
  if (!scottNumber.trim()) return null;

  const listings = await searchEbaySoldListings(scottNumber);
  if (listings.length === 0) return null;

  const prices = listings
    .map((l) => l.price)
    .filter((p) => !isNaN(p) && p > 0);

  if (prices.length === 0) return null;

  const sum = prices.reduce((acc, p) => acc + p, 0);

  return {
    avg: Math.round((sum / prices.length) * 100) / 100,
    min: Math.min(...prices),
    max: Math.max(...prices),
    count: prices.length,
  };
}

/**
 * Clear the token cache (useful for testing or rotation).
 */
export function clearTokenCache(): void {
  tokenCache = null;
}
