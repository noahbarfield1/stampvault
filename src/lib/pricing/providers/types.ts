/* ─── Listing Provider Interface (swappable pricing source seam) ──────
 *  A provider fetches real marketplace listings — each with the four
 *  things "proof" requires: price, sale date, listing URL, and a
 *  thumbnail image. Firecrawl is the default implementation; the eBay
 *  API or a self-hosted scraper can be swapped in behind this interface.
 * ──────────────────────────────────────────────────────────────────── */

export interface StampQuery {
  scottNumber?: string | null;
  country?: string | null;
  year?: number | null;
  denomination?: string | null;
  description?: string | null;
  condition?: string | null;
}

export interface MarketListing {
  platform: 'ebay' | 'delcampe' | 'hipstamp' | string;
  listingType: 'sold' | 'active';
  price: number;
  currency: string; // 'USD', 'EUR', …
  soldDate: string | null; // ISO 8601; null for active listings
  url: string; // proof link
  imageUrl: string | null; // thumbnail for visual confirmation
  title: string;
}

export interface ListingProvider {
  readonly name: string;
  /** Recent completed sales. Must never throw — return [] on any failure. */
  fetchSold(query: StampQuery, limit: number): Promise<MarketListing[]>;
  /** Currently-listed items. Must never throw — return [] on any failure. */
  fetchActive(query: StampQuery, limit: number): Promise<MarketListing[]>;
}
