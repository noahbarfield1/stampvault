/* ──────────────────────────────────────────────────────────────────────────────
 * POST /api/pricing/lookup
 *
 * Look up stamp prices from all available sources in parallel.
 * Gracefully skips sources whose API keys are not configured.
 * Returns aggregated PriceData with source breakdown.
 * ────────────────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';
import type { PriceSource, PriceData } from '@/types/stamp';
import { VERIFIED_STAMPS } from '@/lib/pricing/verified-database';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/* ─── Source Weights ─────────────────────────────────────────────────── */

const SOURCE_WEIGHTS: Record<string, number> = {
  ebay: 0.35,
  hipstamp: 0.3,
  delcampe: 0.2,
  stampworld: 0.15,
};

/* ─── Request Body ───────────────────────────────────────────────────── */

interface LookupRequestBody {
  stampDescription: string;
  scottNumber?: string;
  country?: string;
  year?: number;
  condition?: string;
}

/* ─── Stats Helpers ──────────────────────────────────────────────────── */

interface SourceStats {
  avg: number;
  count: number;
  min?: number;
  max?: number;
}

function computeStats(sources: PriceSource[]): SourceStats | null {
  const prices = sources.map((s) => s.price).filter((p) => !isNaN(p) && p > 0);
  if (prices.length === 0) return null;

  const sum = prices.reduce((a, b) => a + b, 0);
  return {
    avg: Math.round((sum / prices.length) * 100) / 100,
    count: prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

function removeOutliers(prices: number[]): number[] {
  if (prices.length < 4) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return sorted.filter((p) => p >= q1 - 1.5 * iqr && p <= q3 + 1.5 * iqr);
}

function computeWeightedAverage(
  breakdown: PriceData['sourceBreakdown'],
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  const entries: [string, SourceStats | null][] = [
    ['ebay', breakdown.ebay],
    ['hipstamp', breakdown.hipstamp],
    ['delcampe', breakdown.delcampe],
    ['stampworld', breakdown.stampworld],
  ];

  for (const [source, stats] of entries) {
    if (!stats || stats.count === 0) continue;
    const weight = SOURCE_WEIGHTS[source] ?? 0.1;
    const confidenceMultiplier = Math.min(stats.count / 5, 1);
    const adjustedWeight = weight * (0.5 + 0.5 * confidenceMultiplier);
    weightedSum += stats.avg * adjustedWeight;
    totalWeight += adjustedWeight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

function computeConfidence(
  allSources: PriceSource[],
  breakdown: PriceData['sourceBreakdown'],
): number {
  if (allSources.length === 0) return 0;
  let score = 0;

  const activeSources = [
    breakdown.ebay,
    breakdown.hipstamp,
    breakdown.delcampe,
    breakdown.stampworld,
  ].filter((s) => s !== null && s.count > 0).length;
  score += (activeSources / 4) * 0.3;

  score += Math.min(allSources.length / 20, 1) * 0.3;

  const averages = [
    breakdown.ebay?.avg,
    breakdown.hipstamp?.avg,
    breakdown.delcampe?.avg,
    breakdown.stampworld?.avg,
  ].filter((a): a is number => a !== undefined && a !== null && a > 0);

  if (averages.length >= 2) {
    const mean = averages.reduce((a, b) => a + b, 0) / averages.length;
    const variance =
      averages.reduce((acc, a) => acc + Math.pow(a - mean, 2), 0) /
      averages.length;
    const cv = Math.sqrt(variance) / mean;
    score += Math.max(0, 1 - cv) * 0.4;
  } else if (averages.length === 1) {
    score += 0.15;
  }

  return Math.round(score * 100) / 100;
}

/* ─── Source Fetchers ─────────────────────────────────────────────────── */

async function fetchEbayPrices(
  query: string,
  condition?: string,
): Promise<PriceSource[]> {
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    return [];
  }
  const { searchEbaySoldListings } = await import('@/lib/pricing/ebay');
  return searchEbaySoldListings(query, condition);
}

async function fetchHipStampPrices(query: string): Promise<PriceSource[]> {
  if (!process.env.HIPSTAMP_API_KEY) {
    return [];
  }
  const { searchHipStampListings } = await import('@/lib/pricing/hipstamp');
  return searchHipStampListings(query);
}

async function fetchDelcampePrices(
  description: string,
): Promise<PriceSource[]> {
  if (!process.env.PERPLEXITY_API_KEY) {
    return [];
  }
  const { searchDelcampePrices } = await import(
    '@/lib/pricing/perplexity-pricing'
  );
  return searchDelcampePrices(description);
}

async function fetchStampWorldPrices(
  description: string,
): Promise<PriceSource[]> {
  if (!process.env.PERPLEXITY_API_KEY) {
    return [];
  }
  const { searchStampWorldPrices } = await import(
    '@/lib/pricing/perplexity-pricing'
  );
  return searchStampWorldPrices(description);
}

async function fetchHipValue(query: string): Promise<number | null> {
  if (!process.env.HIPSTAMP_API_KEY) {
    return null;
  }
  const { getHipValue } = await import('@/lib/pricing/hipstamp');
  return getHipValue(query);
}

/* ─── Build Query ────────────────────────────────────────────────────── */

function buildQuery(body: LookupRequestBody): string {
  const parts: string[] = [];
  if (body.scottNumber) parts.push(body.scottNumber);
  if (body.country) parts.push(body.country);
  if (body.year) parts.push(String(body.year));
  if (body.stampDescription) parts.push(body.stampDescription.slice(0, 80));
  return parts.filter(Boolean).join(' ').trim();
}

function buildDescriptiveQuery(body: LookupRequestBody): string {
  const parts: string[] = [];
  if (body.country) parts.push(body.country);
  if (body.year) parts.push(`(${body.year})`);
  if (body.scottNumber) parts.push(`Scott #${body.scottNumber}`);
  if (body.stampDescription) parts.push(body.stampDescription);
  if (body.condition) parts.push(body.condition);
  return parts.filter(Boolean).join(' ').trim();
}

/* ─── Handler ────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LookupRequestBody;

    if (!body.stampDescription && !body.scottNumber && !body.country) {
      return NextResponse.json(
        {
          error:
            'At least one of stampDescription, scottNumber, or country is required',
        },
        { status: 400 },
      );
    }

    const scott = body.scottNumber?.toLowerCase()?.trim();
    const country = body.country?.toLowerCase()?.trim();

    if (scott && country) {
      const verified = VERIFIED_STAMPS.find(
        (s) =>
          s.scottNumber.toLowerCase().trim() === scott &&
          s.country.toLowerCase().trim() === country
      );

      if (verified) {
        const priceData: PriceData = {
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

        return NextResponse.json({
          pricing: priceData,
          sourcesUsed: { ebay: true, hipstamp: true, delcampe: false, stampworld: false },
          sourcesSkipped: [],
          totalListings: verified.sources.length,
        });
      }
    }

    const searchQuery = buildQuery(body);
    const descriptiveQuery = buildDescriptiveQuery(body);

    // Launch all pricing sources in parallel
    const [ebayResult, hipstampResult, delcampeResult, stampworldResult, hipValueResult] =
      await Promise.allSettled([
        fetchEbayPrices(searchQuery, body.condition),
        fetchHipStampPrices(searchQuery),
        fetchDelcampePrices(descriptiveQuery),
        fetchStampWorldPrices(descriptiveQuery),
        fetchHipValue(searchQuery),
      ]);

    const ebaySources =
      ebayResult.status === 'fulfilled' ? ebayResult.value : [];
    const hipstampSources =
      hipstampResult.status === 'fulfilled' ? hipstampResult.value : [];
    const delcampeSources =
      delcampeResult.status === 'fulfilled' ? delcampeResult.value : [];
    const stampworldSources =
      stampworldResult.status === 'fulfilled' ? stampworldResult.value : [];
    const hipValue =
      hipValueResult.status === 'fulfilled' ? hipValueResult.value : null;

    const allSources: PriceSource[] = [
      ...ebaySources,
      ...hipstampSources,
      ...delcampeSources,
      ...stampworldSources,
    ];

    const sourceBreakdown: PriceData['sourceBreakdown'] = {
      ebay: computeStats(ebaySources) as {
        avg: number;
        min: number;
        max: number;
        count: number;
      } | null,
      hipstamp: computeStats(hipstampSources),
      delcampe: computeStats(delcampeSources),
      stampworld: computeStats(stampworldSources),
    };

    let estimatedValue = computeWeightedAverage(sourceBreakdown);
    if (estimatedValue === 0 && hipValue !== null) {
      estimatedValue = hipValue;
    }

    const allPrices = allSources
      .map((s) => s.price)
      .filter((p) => !isNaN(p) && p > 0);
    const filtered = allPrices.length > 0 ? removeOutliers(allPrices) : [];

    const priceData: PriceData = {
      estimatedValue,
      currency: 'USD',
      confidence: computeConfidence(allSources, sourceBreakdown),
      sources: allSources,
      priceRange: {
        min:
          filtered.length > 0
            ? Math.round(Math.min(...filtered) * 100) / 100
            : 0,
        max:
          filtered.length > 0
            ? Math.round(Math.max(...filtered) * 100) / 100
            : 0,
      },
      lastUpdated: new Date().toISOString(),
      hipValue,
      sourceBreakdown,
    };

    // Report which sources were used vs skipped
    const sourcesUsed = {
      ebay: ebaySources.length > 0,
      hipstamp: hipstampSources.length > 0,
      delcampe: delcampeSources.length > 0,
      stampworld: stampworldSources.length > 0,
    };

    const sourcesSkipped: string[] = [];
    if (!process.env.EBAY_CLIENT_ID) sourcesSkipped.push('ebay (no API key)');
    if (!process.env.HIPSTAMP_API_KEY)
      sourcesSkipped.push('hipstamp (no API key)');
    if (!process.env.PERPLEXITY_API_KEY)
      sourcesSkipped.push('delcampe (no Perplexity key)', 'stampworld (no Perplexity key)');

    return NextResponse.json({
      pricing: priceData,
      sourcesUsed,
      sourcesSkipped,
      totalListings: allSources.length,
    });
  } catch (error) {
    console.error('[API /pricing/lookup] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Price lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
