/* ─── Live Pricing Aggregation Engine ────────────────────────────────
 *  Turns raw marketplace listings (sold + active), optional
 *  Perplexity-derived supplemental estimates, and a catalog fallback
 *  into a single provenance-backed PriceData object.
 *
 *  Every headline value is backed by a `priceBasis.proof` — a real
 *  listing (link + image + price + date) the user can click through
 *  and verify, chosen via a tiered "best evidence available" ladder:
 *  recent sold sales > active asking prices > stale sold sales >
 *  catalog reference value > nothing found.
 * ──────────────────────────────────────────────────────────────────── */

import type { MarketListing } from './providers/types';
import type {
  PriceData,
  PriceSource,
  PriceBasis,
  PriceSourcePlatform,
} from '@/types/stamp';

/* ─── Constants ──────────────────────────────────────────────────────── */

/** A "sold" listing counts as live pricing evidence within this window. */
export const RECENCY_DAYS = 730;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const KNOWN_SOURCE_PLATFORMS: readonly PriceSourcePlatform[] = [
  'hipstamp',
  'ebay',
  'delcampe',
  'stampworld',
  'colnect',
  'manual',
];

/* ─── Numeric Helpers ────────────────────────────────────────────────── */

/** Round to 2 decimal places (currency precision). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Median of a set of numbers. Returns 0 for an empty input. */
export function median(nums: number[]): number {
  if (nums.length === 0) return 0;

  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Filter out statistical outliers using the IQR method.
 * Returns the input unchanged when there are fewer than 4 points
 * (not enough data to establish a meaningful quartile spread).
 */
export function removeOutliersIQR(nums: number[]): number[] {
  if (nums.length < 4) return nums;

  const sorted = [...nums].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return sorted.filter((n) => n >= lowerBound && n <= upperBound);
}

/* ─── Normalization ──────────────────────────────────────────────────── */

/** Map an arbitrary provider platform string onto the known PriceSource union. */
function normalizePlatform(platform: string): PriceSourcePlatform {
  return (KNOWN_SOURCE_PLATFORMS as readonly string[]).includes(platform)
    ? (platform as PriceSourcePlatform)
    : 'manual';
}

/** Normalize a raw MarketListing (provider seam) into a PriceSource. */
function listingToSource(
  listing: MarketListing,
  referenceTime: number
): PriceSource {
  return {
    platform: normalizePlatform(listing.platform),
    price: listing.price,
    currency: listing.currency,
    url: listing.url,
    title: listing.title,
    condition: null,
    soldDate: listing.soldDate,
    listingType: listing.listingType,
    fetchedAt: new Date(referenceTime).toISOString(),
    imageUrl: listing.imageUrl,
  };
}

/** Age of an ISO date, in days, relative to referenceTime. */
function ageDaysOf(soldDate: string, referenceTime: number): number {
  const soldTime = new Date(soldDate).getTime();
  return (referenceTime - soldTime) / MS_PER_DAY;
}

/** The source with the most recent (largest) soldDate. Assumes non-empty input. */
function mostRecentByDate(sources: PriceSource[]): PriceSource {
  return sources.reduce((best, cur) => {
    const bestTime = best.soldDate ? new Date(best.soldDate).getTime() : -Infinity;
    const curTime = cur.soldDate ? new Date(cur.soldDate).getTime() : -Infinity;
    return curTime > bestTime ? cur : best;
  });
}

/** Format an ISO date as "Mon YYYY"; empty string if null/invalid. */
function formatMonthYear(isoDate: string | null): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Build a PriceBasis proof object from the chosen backing source. */
function toProof(source: PriceSource): NonNullable<PriceBasis['proof']> {
  return {
    platform: source.platform,
    url: source.url,
    imageUrl: source.imageUrl ?? null,
    title: source.title,
    price: source.price,
    soldDate: source.soldDate,
  };
}

/* ─── Source Breakdown ───────────────────────────────────────────────── */

interface BreakdownStats {
  avg: number;
  count: number;
  min: number;
  max: number;
}

/** Per-platform {avg, count, min, max} over a set of sources. Null if none. */
function computeBreakdown(
  sources: PriceSource[],
  platform: PriceSourcePlatform
): BreakdownStats | null {
  const prices = sources
    .filter((s) => s.platform === platform)
    .map((s) => s.price)
    .filter((p) => Number.isFinite(p) && p > 0);

  if (prices.length === 0) return null;

  const sum = prices.reduce((acc, p) => acc + p, 0);

  return {
    avg: round2(sum / prices.length),
    count: prices.length,
    min: round2(Math.min(...prices)),
    max: round2(Math.max(...prices)),
  };
}

/* ─── Public API ─────────────────────────────────────────────────────── */

/**
 * Aggregate raw marketplace listings (+ optional supplemental estimates
 * and catalog fallback) into a single provenance-backed PriceData object.
 */
export function aggregateLivePricing(params: {
  sold: MarketListing[];
  active: MarketListing[];
  /** Perplexity-derived estimates (listingType 'estimate', no proof). */
  supplemental?: PriceSource[];
  catalog?: {
    value: number;
    label?: string;
    url?: string | null;
    imageUrl?: string | null;
  } | null;
  /** Epoch ms; default Date.now(). Injectable for tests. */
  referenceTime?: number;
}): PriceData {
  const referenceTime = params.referenceTime ?? Date.now();
  const lastUpdated = new Date(referenceTime).toISOString();

  const soldSources = params.sold.map((l) => listingToSource(l, referenceTime));
  const activeSources = params.active.map((l) => listingToSource(l, referenceTime));
  const supplemental = params.supplemental ?? [];

  const sources: PriceSource[] = [...soldSources, ...activeSources, ...supplemental];

  // Only USD listings drive the headline value.
  const usdSold = soldSources.filter((s) => s.currency === 'USD');
  const usdActive = activeSources.filter((s) => s.currency === 'USD');

  const recentSold = usdSold.filter(
    (s) => s.soldDate !== null && ageDaysOf(s.soldDate, referenceTime) <= RECENCY_DAYS
  );

  let priceBasis: PriceBasis;
  /** The outlier-filtered USD prices backing the selected tier (for priceRange). */
  let tierPrices: number[];

  if (recentSold.length > 0) {
    // Tier 1: live sold — recent completed sales are the strongest evidence.
    const filtered = removeOutliersIQR(recentSold.map((s) => s.price));
    const value = round2(median(filtered));
    const proofSource = mostRecentByDate(recentSold);
    const count = recentSold.length;

    priceBasis = {
      tier: 'live_sold',
      label: `Live sold · median of ${count} sale${count === 1 ? '' : 's'} (most recent ${formatMonthYear(proofSource.soldDate)})`,
      value,
      currency: 'USD',
      asOf: proofSource.soldDate,
      sampleSize: count,
      proof: toProof(proofSource),
    };
    tierPrices = filtered;
  } else if (usdActive.length > 0) {
    // Tier 2: no recent sales, but current asking prices exist.
    const filtered = removeOutliersIQR(usdActive.map((s) => s.price));
    const value = round2(median(filtered));
    const proofSource = usdActive.reduce((nearest, cur) =>
      Math.abs(cur.price - value) < Math.abs(nearest.price - value) ? cur : nearest
    );

    priceBasis = {
      tier: 'active',
      label: `Currently listed (asking) · ${usdActive.length} active`,
      value,
      currency: 'USD',
      asOf: null,
      sampleSize: usdActive.length,
      proof: toProof(proofSource),
    };
    tierPrices = filtered;
  } else if (usdSold.length > 0) {
    // Tier 3: only stale sold data (outside the recency window) exists.
    const proofSource = mostRecentByDate(usdSold);

    priceBasis = {
      tier: 'last_sold',
      label: `Last sold · ${formatMonthYear(proofSource.soldDate)}`,
      value: proofSource.price,
      currency: 'USD',
      asOf: proofSource.soldDate,
      sampleSize: 1,
      proof: toProof(proofSource),
    };
    tierPrices = removeOutliersIQR(usdSold.map((s) => s.price));
  } else if (params.catalog) {
    // Tier 4: no market evidence at all — fall back to a catalog value.
    const { value, label, url = null, imageUrl = null } = params.catalog;
    const hasProof = Boolean(url || imageUrl);

    priceBasis = {
      tier: 'catalog',
      label: label ?? 'Catalog value — no recent sales found',
      value,
      currency: 'USD',
      asOf: null,
      sampleSize: 0,
      proof: hasProof
        ? {
            platform: 'catalog',
            url: url ?? null,
            imageUrl: imageUrl ?? null,
            title: label ?? 'Catalog value',
            price: value,
            soldDate: null,
          }
        : null,
    };
    tierPrices = [];
  } else {
    // Tier 5: nothing found.
    priceBasis = {
      tier: 'catalog',
      label: 'No pricing found',
      value: 0,
      currency: 'USD',
      asOf: null,
      sampleSize: 0,
      proof: null,
    };
    tierPrices = [];
  }

  const priceRange =
    tierPrices.length > 0
      ? { min: round2(Math.min(...tierPrices)), max: round2(Math.max(...tierPrices)) }
      : { min: 0, max: 0 };

  const hipstamp = computeBreakdown(sources, 'hipstamp');
  const ebay = computeBreakdown(sources, 'ebay');
  const delcampe = computeBreakdown(sources, 'delcampe');
  const stampworld = computeBreakdown(sources, 'stampworld');

  const sourceBreakdown: PriceData['sourceBreakdown'] = {
    hipstamp: hipstamp ? { avg: hipstamp.avg, count: hipstamp.count } : null,
    ebay: ebay ? { avg: ebay.avg, min: ebay.min, max: ebay.max, count: ebay.count } : null,
    delcampe: delcampe ? { avg: delcampe.avg, count: delcampe.count } : null,
    stampworld: stampworld ? { avg: stampworld.avg, count: stampworld.count } : null,
  };

  let confidence = 0;
  switch (priceBasis.tier) {
    case 'live_sold':
      confidence = round2(0.9 * Math.min(priceBasis.sampleSize / 5, 1));
      break;
    case 'active':
      confidence = 0.6;
      break;
    case 'last_sold':
      confidence = 0.5;
      break;
    case 'catalog':
      confidence = priceBasis.value > 0 ? 0.4 : 0;
      break;
  }

  const hipstampPrices = sources
    .filter((s) => s.platform === 'hipstamp')
    .map((s) => s.price)
    .filter((p) => Number.isFinite(p) && p > 0);
  const hipValue = hipstampPrices.length > 0 ? round2(median(hipstampPrices)) : null;

  return {
    estimatedValue: priceBasis.value,
    currency: 'USD',
    confidence,
    sources,
    priceRange,
    lastUpdated,
    hipValue,
    sourceBreakdown,
    priceBasis,
  };
}
