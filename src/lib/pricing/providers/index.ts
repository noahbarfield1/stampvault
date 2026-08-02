/* ─── Listing Provider Registry ───────────────────────────────────────
 *  Entry point for the pricing listing-provider seam.
 *
 *  Selection order:
 *    1. PRICING_PROVIDER, when it names a provider explicitly.
 *    2. eBay Browse, whenever EBAY_CLIENT_ID / EBAY_CLIENT_SECRET are set.
 *       It is free, structured, and not bot-blocked, so it should win
 *       automatically the moment credentials exist.
 *    3. Firecrawl scraping, as the fallback.
 * ──────────────────────────────────────────────────────────────────── */

import type { ListingProvider } from './types';
import { createFirecrawlProvider } from './firecrawl-provider';
import { createEbayProvider, hasEbayCredentials } from './ebay-provider';

export type { StampQuery, MarketListing, ListingProvider } from './types';

export function getListingProvider(): ListingProvider {
  const selected = process.env.PRICING_PROVIDER;

  if (selected === 'ebay') return createEbayProvider();
  if (selected === 'firecrawl') return createFirecrawlProvider();

  // Unset: prefer eBay when it is usable. It costs nothing per lookup, versus
  // a Firecrawl credit every time.
  return hasEbayCredentials() ? createEbayProvider() : createFirecrawlProvider();
}

/** Which provider will be used, and why — surfaced by /api/settings/status. */
export function describeActiveProvider(): { name: string; free: boolean; reason: string } {
  const selected = process.env.PRICING_PROVIDER;

  if (selected === 'firecrawl') {
    return { name: 'firecrawl', free: false, reason: 'Pinned by PRICING_PROVIDER.' };
  }
  if (selected === 'ebay' || hasEbayCredentials()) {
    return {
      name: 'ebay-browse',
      free: true,
      reason: 'eBay Browse API — free, structured, no scraping credits.',
    };
  }
  return {
    name: 'firecrawl',
    free: false,
    reason: 'No eBay API credentials set, so pricing falls back to scraping.',
  };
}
