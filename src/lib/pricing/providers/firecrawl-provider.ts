/* ─── Firecrawl Listing Provider ──────────────────────────────────────
 *  Default ListingProvider implementation. Scrapes eBay search-results
 *  pages via Firecrawl's /v2/scrape endpoint and parses the returned
 *  markdown into MarketListing records with parseEbayListings.
 * ──────────────────────────────────────────────────────────────────── */

import type { ListingProvider, MarketListing, StampQuery } from './types';
import { parseEbayListings } from './firecrawl-parse';
import { buildEbayQuery } from './ebay-provider';

const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v2/scrape';
const REQUEST_TIMEOUT_MS = 25_000;

/** eBay's Stamps category. Without it, `_sacat=0` searches the whole site and a
 *  bare catalogue number matches manufacturer part numbers — a live lookup for
 *  Scott 814 returned a conductivity electrode and a pair of work boots. */
const EBAY_CATEGORY_STAMPS = '260';

let warnedMissingKey = false;

interface FirecrawlScrapeResponse {
  success?: boolean;
  data?: {
    markdown?: string;
  };
}

/**
 * Builds the eBay `_nkw` search query.
 *
 * Shares `buildEbayQuery` with the API provider deliberately, so both sources
 * search for the same thing. The old local builder appended six words of the
 * AI's prose description, producing queries like
 * "RW8 United States A United States revenue stamp, commonly" — which matches
 * poorly and spends a credit doing it.
 */
export function buildSearchUrl(query: StampQuery, listingType: 'sold' | 'active'): string {
  const q = encodeURIComponent(buildEbayQuery(query));
  const base = `https://www.ebay.com/sch/i.html?_nkw=${q}&_sacat=${EBAY_CATEGORY_STAMPS}`;
  return listingType === 'sold' ? `${base}&LH_Sold=1&LH_Complete=1` : base;
}

/** Scrapes a URL via Firecrawl, returning the page markdown or null on any failure. */
async function scrapeMarkdown(url: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch(FIRECRAWL_SCRAPE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      // 402 means the Firecrawl account is out of credits — a billing problem,
      // not "this stamp has no listings". Distinguish it so the UI can say so
      // instead of implying the stamp is unsellable.
      if (response.status === 402) {
        providerUnavailableReason =
          'Price lookups are paused — the marketplace search service is out of credits.';
        console.error('[firecrawl-provider] OUT OF CREDITS (402). Pricing is disabled until topped up.');
      } else if (response.status === 401 || response.status === 403) {
        providerUnavailableReason = 'Price lookups are not authorised — check the Firecrawl API key.';
        console.error(`[firecrawl-provider] auth failure ${response.status}`);
      } else {
        console.error(`[firecrawl-provider] scrape failed ${response.status} for ${url}`);
      }
      return null;
    }

    const json = (await response.json()) as FirecrawlScrapeResponse;
    return json?.data?.markdown ?? null;
  } catch (error) {
    console.error('[firecrawl-provider] scrape request error:', error);
    return null;
  }
}

/**
 * Set when the provider fails for a reason the user needs to hear about —
 * out of credits, bad key — as opposed to simply finding no listings.
 * Read once per request by the pricing route.
 */
let providerUnavailableReason: string | null = null;

export function takeProviderUnavailableReason(): string | null {
  const reason = providerUnavailableReason;
  providerUnavailableReason = null;
  return reason;
}

async function fetchListings(
  query: StampQuery,
  limit: number,
  listingType: 'sold' | 'active'
): Promise<MarketListing[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    if (!warnedMissingKey) {
      console.warn('[firecrawl-provider] FIRECRAWL_API_KEY not set — returning empty listings.');
      warnedMissingKey = true;
    }
    return [];
  }

  try {
    const url = buildSearchUrl(query, listingType);
    const markdown = await scrapeMarkdown(url, apiKey);
    if (!markdown) return [];

    return parseEbayListings(markdown, listingType).slice(0, limit);
  } catch (error) {
    console.error('[firecrawl-provider] fetchListings failed:', error);
    return [];
  }
}

/** Creates the Firecrawl-backed ListingProvider (never throws — fetchSold/fetchActive resolve to [] on any failure). */
export function createFirecrawlProvider(): ListingProvider {
  return {
    name: 'firecrawl',
    /**
     * eBay gates sold/completed listings behind a sign-in wall, so an
     * anonymous scrape of `LH_Sold=1&LH_Complete=1` returns a login page, not
     * results. Measured 2026-08-02 for the same query:
     *
     *   sold   -> 1,662 chars,   0 prices, "Sign in to your account"
     *   active -> 133,994 chars, 109 prices
     *
     * Attempting it burned one Firecrawl credit per lookup on a login page —
     * half of all spend — and could never succeed. Skipped entirely rather
     * than left to fail, since a failed scrape costs exactly as much as a
     * successful one.
     *
     * Re-enable only alongside an authenticated fetch path (a signed-in
     * session, or the official eBay Marketplace Insights API).
     */
    async fetchSold(): Promise<MarketListing[]> {
      return [];
    },
    fetchActive(query: StampQuery, limit: number): Promise<MarketListing[]> {
      return fetchListings(query, limit, 'active');
    },
  };
}
