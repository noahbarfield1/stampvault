/* ─── Firecrawl Listing Provider ──────────────────────────────────────
 *  Default ListingProvider implementation. Scrapes eBay search-results
 *  pages via Firecrawl's /v2/scrape endpoint and parses the returned
 *  markdown into MarketListing records with parseEbayListings.
 * ──────────────────────────────────────────────────────────────────── */

import type { ListingProvider, MarketListing, StampQuery } from './types';
import { parseEbayListings } from './firecrawl-parse';

const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v2/scrape';
const REQUEST_TIMEOUT_MS = 25_000;
const DESCRIPTION_WORD_LIMIT = 6;

let warnedMissingKey = false;

interface FirecrawlScrapeResponse {
  success?: boolean;
  data?: {
    markdown?: string;
  };
}

/**
 * Builds the eBay `_nkw` search query from a StampQuery: Scott number,
 * country, denomination, and the first few words of the description,
 * space-joined (empty/missing fields are dropped).
 */
function buildSearchQuery(query: StampQuery): string {
  const descriptionWords = query.description
    ? query.description.trim().split(/\s+/).slice(0, DESCRIPTION_WORD_LIMIT).join(' ')
    : null;

  const parts = [query.scottNumber, query.country, query.denomination, descriptionWords].filter(
    (part): part is string => Boolean(part && part.trim().length > 0)
  );

  return parts.join(' ').trim();
}

function buildSearchUrl(query: StampQuery, listingType: 'sold' | 'active'): string {
  const q = encodeURIComponent(buildSearchQuery(query));
  const base = `https://www.ebay.com/sch/i.html?_nkw=${q}&_sacat=0`;
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
      console.error(`[firecrawl-provider] scrape failed ${response.status} for ${url}`);
      return null;
    }

    const json = (await response.json()) as FirecrawlScrapeResponse;
    return json?.data?.markdown ?? null;
  } catch (error) {
    console.error('[firecrawl-provider] scrape request error:', error);
    return null;
  }
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
    fetchSold(query: StampQuery, limit: number): Promise<MarketListing[]> {
      return fetchListings(query, limit, 'sold');
    },
    fetchActive(query: StampQuery, limit: number): Promise<MarketListing[]> {
      return fetchListings(query, limit, 'active');
    },
  };
}
