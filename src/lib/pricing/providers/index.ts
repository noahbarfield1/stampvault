/* ─── Listing Provider Registry ───────────────────────────────────────
 *  Entry point for the pricing listing-provider seam. Selects a
 *  ListingProvider implementation, defaulting to Firecrawl.
 * ──────────────────────────────────────────────────────────────────── */

import type { ListingProvider } from './types';
import { createFirecrawlProvider } from './firecrawl-provider';

export type { StampQuery, MarketListing, ListingProvider } from './types';

/**
 * Resolves the active ListingProvider. Selectable via `PRICING_PROVIDER`
 * (only `'firecrawl'` is implemented today; any other/unset value falls
 * back to Firecrawl).
 */
export function getListingProvider(): ListingProvider {
  const selected = process.env.PRICING_PROVIDER ?? 'firecrawl';

  switch (selected) {
    case 'firecrawl':
    default:
      return createFirecrawlProvider();
  }
}
