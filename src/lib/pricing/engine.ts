/* ─── Central Pricing Engine ─────────────────────────────────────────
 *  Orchestrates all pricing sources (HipStamp, eBay, Delcampe,
 *  StampWorld), aggregates results into a unified PriceData object,
 *  and manages caching/history via Firestore.
 * ──────────────────────────────────────────────────────────────────── */

import type {
  Stamp,
  PriceData,
  PriceSource,
  PriceHistoryEntry,
} from '@/types/stamp';
import { VERIFIED_STAMPS } from './verified-database';
import { searchHipStampListings, getHipValue } from './hipstamp';
import { searchEbaySoldListings, getEbayAveragePrice } from './ebay';
import {
  searchDelcampePrices,
  searchStampWorldPrices,
} from './perplexity-pricing';
import {
  getStamp,
  updateStamp,
  savePriceData,
  savePriceHistory,
  getCachedPriceData,
} from '../firebase/firestore';

/* ─── Constants ──────────────────────────────────────────────────────── */

/** Price cache time-to-live: 24 hours */
const PRICE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Max concurrent batch refreshes */
const BATCH_CONCURRENCY = 3;

/** Source reliability weights for weighted average calculation */
const SOURCE_WEIGHTS: Record<string, number> = {
  ebay: 0.35,      // highest weight — real transactions
  hipstamp: 0.30,  // specialized stamp marketplace
  delcampe: 0.20,  // AI-extracted, lower confidence
  stampworld: 0.15, // catalogue values, often higher than market
};

/* ─── Query Builder ──────────────────────────────────────────────────── */

/**
 * Build a search query string from stamp identification data.
 */
function buildSearchQuery(stamp: Stamp): string {
  const parts: string[] = [];

  if (stamp.identification.scottNumber) {
    parts.push(stamp.identification.scottNumber);
  }

  if (stamp.identification.country) {
    parts.push(stamp.identification.country);
  }

  if (stamp.identification.year) {
    parts.push(String(stamp.identification.year));
  }

  if (stamp.identification.denomination) {
    parts.push(stamp.identification.denomination);
  }

  if (stamp.identification.description) {
    // Take first 50 chars of description for search relevance
    parts.push(stamp.identification.description.slice(0, 50));
  }

  return parts.filter(Boolean).join(' ').trim();
}

/**
 * Build a descriptive string for Perplexity-based searches.
 */
function buildDescriptiveQuery(stamp: Stamp): string {
  const parts: string[] = [];

  if (stamp.identification.country) {
    parts.push(stamp.identification.country);
  }

  if (stamp.identification.year) {
    parts.push(`(${stamp.identification.year})`);
  }

  if (stamp.identification.scottNumber) {
    parts.push(`Scott #${stamp.identification.scottNumber}`);
  }

  if (stamp.identification.description) {
    parts.push(stamp.identification.description);
  }

  if (stamp.identification.denomination) {
    parts.push(stamp.identification.denomination);
  }

  if (stamp.identification.condition && stamp.identification.condition !== 'unknown') {
    parts.push(stamp.identification.condition.replace('_', ' '));
  }

  return parts.filter(Boolean).join(' ').trim();
}

/* ─── Aggregation Logic ──────────────────────────────────────────────── */

interface SourceStats {
  avg: number;
  count: number;
  min?: number;
  max?: number;
}

/**
 * Compute statistics for a set of price sources.
 */
function computeSourceStats(sources: PriceSource[]): SourceStats | null {
  if (sources.length === 0) return null;

  const prices = sources
    .map((s) => s.price)
    .filter((p) => !isNaN(p) && Number.isFinite(p) && p > 0);

  if (prices.length === 0) return null;

  const sum = prices.reduce((acc, p) => acc + p, 0);

  return {
    avg: Math.round((sum / prices.length) * 100) / 100,
    count: prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

/**
 * Filter out statistical outliers using IQR method.
 * Removes prices that are more than 1.5 × IQR beyond Q1/Q3.
 */
function removeOutliers(prices: number[]): number[] {
  if (prices.length < 4) return prices;

  const sorted = [...prices].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return sorted.filter((p) => p >= lowerBound && p <= upperBound);
}

/**
 * Compute a weighted average price from multiple sources.
 */
function computeWeightedAverage(
  sourceBreakdown: PriceData['sourceBreakdown']
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  const entries: [string, SourceStats | null][] = [
    ['ebay', sourceBreakdown.ebay],
    ['hipstamp', sourceBreakdown.hipstamp],
    ['delcampe', sourceBreakdown.delcampe],
    ['stampworld', sourceBreakdown.stampworld],
  ];

  for (const [source, stats] of entries) {
    if (!stats || stats.count === 0) continue;

    const weight = SOURCE_WEIGHTS[source] ?? 0.1;
    // Scale weight by number of data points (more data = more reliable)
    const confidenceMultiplier = Math.min(stats.count / 5, 1);
    const adjustedWeight = weight * (0.5 + 0.5 * confidenceMultiplier);

    weightedSum += stats.avg * adjustedWeight;
    totalWeight += adjustedWeight;
  }

  if (totalWeight === 0) return 0;

  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

/**
 * Compute confidence score (0–1) based on source coverage and agreement.
 */
function computeConfidence(
  allSources: PriceSource[],
  sourceBreakdown: PriceData['sourceBreakdown']
): number {
  if (allSources.length === 0) return 0;

  let score = 0;

  // Factor 1: Number of sources with data (0–0.3)
  const activeSources = [
    sourceBreakdown.ebay,
    sourceBreakdown.hipstamp,
    sourceBreakdown.delcampe,
    sourceBreakdown.stampworld,
  ].filter((s) => s !== null && s.count > 0).length;
  score += (activeSources / 4) * 0.3;

  // Factor 2: Total number of data points (0–0.3)
  const totalPoints = allSources.length;
  score += Math.min(totalPoints / 20, 1) * 0.3;

  // Factor 3: Price agreement between sources (0–0.4)
  const averages = [
    sourceBreakdown.ebay?.avg,
    sourceBreakdown.hipstamp?.avg,
    sourceBreakdown.delcampe?.avg,
    sourceBreakdown.stampworld?.avg,
  ].filter((a): a is number => a !== undefined && a !== null && a > 0);

  if (averages.length >= 2) {
    const mean = averages.reduce((a, b) => a + b, 0) / averages.length;
    const variance =
      averages.reduce((acc, a) => acc + Math.pow(a - mean, 2), 0) /
      averages.length;
    const coeffOfVariation = Math.sqrt(variance) / mean;

    // Lower coefficient of variation = higher agreement = higher confidence
    const agreement = Math.max(0, 1 - coeffOfVariation);
    score += agreement * 0.4;
  } else if (averages.length === 1) {
    score += 0.15; // Single source — moderate confidence penalty
  }

  return Math.round(score * 100) / 100;
}

/* ─── Public API ─────────────────────────────────────────────────────── */

/**
 * Fetch prices from all 4 sources in parallel and aggregate results.
 * Uses Promise.allSettled so one source failing doesn't block the rest.
 */
export async function fetchAllPrices(stamp: Stamp): Promise<PriceData> {
  const scott = stamp.identification.scottNumber?.toLowerCase()?.trim();
  const country = stamp.identification.country?.toLowerCase()?.trim();

  if (scott && country) {
    const verified = VERIFIED_STAMPS.find(
      (s) =>
        s.scottNumber.toLowerCase().trim() === scott &&
        s.country.toLowerCase().trim() === country
    );

    if (verified) {
      return {
        estimatedValue: verified.estimatedValue,
        currency: 'USD',
        confidence: 0.99,
        sources: verified.sources.map((s) => ({
          ...s,
          fetchedAt: new Date().toISOString(),
        })),
        priceRange: verified.priceRange,
        lastUpdated: new Date().toISOString(),
        hipValue: verified.hipValue,
        sourceBreakdown: verified.sourceBreakdown,
      };
    }
  }

  const searchQuery = buildSearchQuery(stamp);
  const descriptiveQuery = buildDescriptiveQuery(stamp);
  const scottNumber = stamp.identification.scottNumber;
  const conditionStr =
    stamp.identification.condition !== 'unknown'
      ? stamp.identification.condition
      : undefined;

  // Launch all searches in parallel
  const [hipstampResult, ebayResult, delcampeResult, stampworldResult, hipValueResult] =
    await Promise.allSettled([
      searchHipStampListings(searchQuery),
      searchEbaySoldListings(searchQuery, conditionStr),
      searchDelcampePrices(descriptiveQuery),
      searchStampWorldPrices(descriptiveQuery),
      getHipValue(searchQuery),
    ]);

  // Extract results, defaulting to empty arrays on rejection
  const hipstampSources =
    hipstampResult.status === 'fulfilled' ? hipstampResult.value : [];
  const ebaySources =
    ebayResult.status === 'fulfilled' ? ebayResult.value : [];
  const delcampeSources =
    delcampeResult.status === 'fulfilled' ? delcampeResult.value : [];
  const stampworldSources =
    stampworldResult.status === 'fulfilled' ? stampworldResult.value : [];
  const hipValue =
    hipValueResult.status === 'fulfilled' ? hipValueResult.value : null;

  // Combine all sources
  const allSources: PriceSource[] = [
    ...hipstampSources,
    ...ebaySources,
    ...delcampeSources,
    ...stampworldSources,
  ];

  // Compute per-source breakdowns
  const sourceBreakdown: PriceData['sourceBreakdown'] = {
    hipstamp: computeSourceStats(hipstampSources),
    ebay: computeSourceStats(ebaySources) as {
      avg: number;
      min: number;
      max: number;
      count: number;
    } | null,
    delcampe: computeSourceStats(delcampeSources),
    stampworld: computeSourceStats(stampworldSources),
  };

  // Compute aggregated estimated value
  let estimatedValue = computeWeightedAverage(sourceBreakdown);

  // If we have a HipValue and no other data, use it as the estimate
  if (estimatedValue === 0 && hipValue !== null) {
    estimatedValue = hipValue;
  }

  // Compute price range from all sources (with outlier removal)
  const allPrices = allSources
    .map((s) => s.price)
    .filter((p) => !isNaN(p) && Number.isFinite(p) && p > 0);
  const filteredPrices =
    allPrices.length > 0 ? removeOutliers(allPrices) : [];

  const priceRange = {
    min:
      filteredPrices.length > 0
        ? Math.round(Math.min(...filteredPrices) * 100) / 100
        : 0,
    max:
      filteredPrices.length > 0
        ? Math.round(Math.max(...filteredPrices) * 100) / 100
        : 0,
  };

  // Compute confidence
  const confidence = computeConfidence(allSources, sourceBreakdown);

  return {
    estimatedValue,
    currency: 'USD',
    confidence,
    sources: allSources,
    priceRange,
    lastUpdated: new Date().toISOString(),
    hipValue,
    sourceBreakdown,
  };
}

/**
 * Get cached price data from Firestore if within 24h TTL.
 */
export async function getCachedPrice(
  stampId: string
): Promise<PriceData | null> {
  return getCachedPriceData(stampId, PRICE_CACHE_TTL_MS);
}

/**
 * Force re-fetch prices for a stamp, update Firestore cache, and save history.
 */
export async function refreshPrice(stampId: string): Promise<PriceData> {
  // Get the stamp data
  const stamp = await getStamp(stampId);
  if (!stamp) {
    throw new Error(`Stamp not found: ${stampId}`);
  }

  // Fetch fresh prices from all sources
  const priceData = await fetchAllPrices(stamp);

  // Persist to Firestore
  await savePriceData(stampId, priceData);

  // Save price history entry
  const historyEntry: PriceHistoryEntry = {
    date: new Date().toISOString(),
    value: priceData.estimatedValue,
    sources: priceData.sources.length,
  };
  await savePriceHistory(stampId, historyEntry);

  return priceData;
}

/**
 * Get price for a stamp: return cached if fresh, otherwise fetch.
 */
export async function getPrice(stampId: string): Promise<PriceData> {
  const cached = await getCachedPrice(stampId);
  if (cached) return cached;

  return refreshPrice(stampId);
}

/**
 * Batch refresh prices for multiple stamps with rate limiting.
 * Processes BATCH_CONCURRENCY stamps at a time.
 */
export async function refreshAllPrices(
  stampIds: string[]
): Promise<Map<string, PriceData>> {
  const results = new Map<string, PriceData>();

  // Process in chunks of BATCH_CONCURRENCY
  for (let i = 0; i < stampIds.length; i += BATCH_CONCURRENCY) {
    const chunk = stampIds.slice(i, i + BATCH_CONCURRENCY);

    const chunkResults = await Promise.allSettled(
      chunk.map(async (stampId) => {
        const priceData = await refreshPrice(stampId);
        return { stampId, priceData };
      })
    );

    for (const result of chunkResults) {
      if (result.status === 'fulfilled') {
        results.set(result.value.stampId, result.value.priceData);
      } else {
        console.error('[PricingEngine] Batch refresh failed for a stamp:', result.reason);
      }
    }

    // Add a small delay between chunks to respect rate limits
    if (i + BATCH_CONCURRENCY < stampIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Quick estimate using only the fastest sources (HipStamp + eBay).
 * Useful for bulk operations where speed matters more than accuracy.
 */
export async function getQuickEstimate(
  stamp: Stamp
): Promise<{ value: number; confidence: number } | null> {
  const query = buildSearchQuery(stamp);
  if (!query) return null;

  const [hipstampResult, ebayResult] = await Promise.allSettled([
    searchHipStampListings(query),
    searchEbaySoldListings(query),
  ]);

  const hipstampSources =
    hipstampResult.status === 'fulfilled' ? hipstampResult.value : [];
  const ebaySources =
    ebayResult.status === 'fulfilled' ? ebayResult.value : [];

  const allPrices = [...hipstampSources, ...ebaySources]
    .map((s) => s.price)
    .filter((p) => !isNaN(p) && Number.isFinite(p) && p > 0);

  if (allPrices.length === 0) return null;

  const cleaned = removeOutliers(allPrices);
  const avg =
    cleaned.reduce((acc, p) => acc + p, 0) / cleaned.length;

  return {
    value: Math.round(avg * 100) / 100,
    confidence: Math.min(cleaned.length / 10, 0.7), // quick estimate caps at 0.7 confidence
  };
}
