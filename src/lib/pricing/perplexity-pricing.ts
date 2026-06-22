/* ─── Perplexity-Powered Pricing for Delcampe & StampWorld ───────────
 *  Uses Perplexity sonar-pro (OpenAI-compatible API) to search
 *  Delcampe and StampWorld since they lack direct REST APIs.
 *  Extracts structured pricing data from AI-generated responses.
 * ──────────────────────────────────────────────────────────────────── */

import type { PriceSource } from '@/types/stamp';

const PERPLEXITY_BASE_URL = 'https://api.perplexity.ai';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function getPerplexityApiKey(): string {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    throw new Error('PERPLEXITY_API_KEY environment variable is not set');
  }
  return key;
}

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityCitation {
  url: string;
  title?: string;
}

interface PerplexityChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: PerplexityChoice[];
  citations?: PerplexityCitation[];
}

/**
 * Call Perplexity's chat completions endpoint (OpenAI-compatible).
 */
async function perplexityChat(
  messages: PerplexityMessage[],
  searchDomainFilter?: string[]
): Promise<{ content: string; citations: PerplexityCitation[] } | null> {
  try {
    const body: Record<string, unknown> = {
      model: 'sonar-pro',
      messages,
      temperature: 0.1,
      max_tokens: 2048,
      return_citations: true,
    };

    if (searchDomainFilter && searchDomainFilter.length > 0) {
      body.search_domain_filter = searchDomainFilter;
    }

    const response = await fetch(`${PERPLEXITY_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getPerplexityApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(
        `[Perplexity] API error ${response.status}: ${response.statusText}`
      );
      return null;
    }

    const data = (await response.json()) as PerplexityResponse;

    if (!data.choices || data.choices.length === 0) return null;

    return {
      content: data.choices[0].message.content,
      citations: data.citations || [],
    };
  } catch (error) {
    console.error('[Perplexity] Network error:', error);
    return null;
  }
}

/* ─── Price Extraction ───────────────────────────────────────────────── */

interface ExtractedPrice {
  price: number;
  currency: string;
  title: string;
  url: string | null;
  soldDate: string | null;
  listingType: 'sold' | 'active' | 'estimate';
}

/**
 * Parse price data from Perplexity's AI response text.
 * Handles formats like: $12.50, €15.00, USD 20, 25 EUR, etc.
 */
function extractPricesFromText(
  text: string,
  citations: PerplexityCitation[]
): ExtractedPrice[] {
  const results: ExtractedPrice[] = [];

  // Match price patterns: $XX.XX, €XX.XX, XX.XX USD/EUR/GBP, USD XX.XX
  const priceRegex =
    /(?:(?:(?:USD|EUR|GBP|CHF)\s*)?([$€£])\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:USD|EUR|GBP|CHF|dollars?|euros?)|(USD|EUR|GBP|CHF)\s*(\d+(?:[.,]\d{1,2})?))/gi;

  // Split into lines/sentences for context
  const segments = text.split(/[.\n]+/).filter((s) => s.trim().length > 10);

  for (const segment of segments) {
    let match: RegExpExecArray | null;
    const segmentPriceRegex = new RegExp(priceRegex.source, 'gi');

    while ((match = segmentPriceRegex.exec(segment)) !== null) {
      let priceValue: number;
      let currency: string;

      if (match[1] && match[2]) {
        // $XX.XX or €XX.XX format
        priceValue = parseFloat(match[2].replace(',', '.'));
        currency = match[1] === '$' ? 'USD' : match[1] === '€' ? 'EUR' : 'GBP';
      } else if (match[3]) {
        // XX.XX USD format
        priceValue = parseFloat(match[3].replace(',', '.'));
        currency = segment.match(/EUR|euros?/i) ? 'EUR' : 'USD';
      } else if (match[4] && match[5]) {
        // USD XX.XX format
        priceValue = parseFloat(match[5].replace(',', '.'));
        currency = match[4].toUpperCase();
      } else {
        continue;
      }

      if (isNaN(priceValue) || priceValue <= 0 || priceValue > 1000000) continue;

      // Determine listing type from context
      const segmentLower = segment.toLowerCase();
      let listingType: 'sold' | 'active' | 'estimate' = 'estimate';
      if (
        segmentLower.includes('sold') ||
        segmentLower.includes('realized') ||
        segmentLower.includes('hammer')
      ) {
        listingType = 'sold';
      } else if (
        segmentLower.includes('listed') ||
        segmentLower.includes('asking') ||
        segmentLower.includes('buy now') ||
        segmentLower.includes('available')
      ) {
        listingType = 'active';
      }

      // Extract a title from context (first 80 chars of the segment)
      const titleClean = segment
        .trim()
        .replace(/\[?\d+\]?/g, '')
        .trim()
        .slice(0, 100);

      results.push({
        price: priceValue,
        currency,
        title: titleClean || 'Stamp listing',
        url: null,
        soldDate: null,
        listingType,
      });
    }
  }

  // Assign citation URLs to extracted prices (best-effort matching)
  for (let i = 0; i < results.length && i < citations.length; i++) {
    results[i].url = citations[i].url;
  }

  // Deduplicate by price (keep first occurrence)
  const seen = new Set<number>();
  return results.filter((r) => {
    const key = Math.round(r.price * 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ─── Delcampe Search ────────────────────────────────────────────────── */

/**
 * Search Delcampe for stamp prices using Perplexity sonar-pro.
 * Delcampe is a major European stamp marketplace without a public API.
 */
export async function searchDelcampePrices(
  stampDescription: string
): Promise<PriceSource[]> {
  if (!stampDescription.trim()) return [];

  const systemPrompt = `You are a philatelic pricing research assistant. Search Delcampe.net for stamp listings matching the user's description. For each listing found, provide:
1. The exact price (with currency)
2. Whether it was sold or is currently listed
3. The listing title
4. Any condition information

Format each finding clearly with the price prominently displayed. Focus on recent sold prices and current active listings. Be precise with numbers.`;

  const userPrompt = `Find stamp prices on Delcampe for: "${stampDescription}"

Search for both sold/realized prices and current active listings. Include the actual prices in USD or EUR. List at least 3-5 results if available.`;

  const result = await perplexityChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    ['delcampe.net']
  );

  if (!result) return [];

  const extracted = extractPricesFromText(result.content, result.citations);
  const now = new Date().toISOString();

  return extracted.map((item): PriceSource => ({
    platform: 'delcampe',
    price: item.price,
    currency: item.currency,
    url: item.url,
    title: item.title,
    condition: null,
    soldDate: item.soldDate,
    listingType: item.listingType,
    fetchedAt: now,
  }));
}

/* ─── StampWorld Search ──────────────────────────────────────────────── */

/**
 * Search StampWorld for stamp catalogue values using Perplexity sonar-pro.
 * StampWorld provides catalogue values and community-sourced pricing.
 */
export async function searchStampWorldPrices(
  stampDescription: string
): Promise<PriceSource[]> {
  if (!stampDescription.trim()) return [];

  const systemPrompt = `You are a philatelic pricing research assistant. Search StampWorld.com for catalogue values and pricing information for the stamp described by the user. For each entry found, provide:
1. The catalogue value or market price (with currency)
2. Whether it's a catalogue value, market price, or recent sale
3. The stamp description/title from StampWorld
4. Any condition or variant information

Format each finding clearly with prices prominently displayed. Be precise with all numbers.`;

  const userPrompt = `Find stamp catalogue values and prices on StampWorld for: "${stampDescription}"

Include catalogue values (mint and used if available), and any market price data. List results with actual prices in USD or EUR.`;

  const result = await perplexityChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    ['stampworld.com']
  );

  if (!result) return [];

  const extracted = extractPricesFromText(result.content, result.citations);
  const now = new Date().toISOString();

  return extracted.map((item): PriceSource => ({
    platform: 'stampworld',
    price: item.price,
    currency: item.currency,
    url: item.url,
    title: item.title,
    condition: null,
    soldDate: item.soldDate,
    listingType: item.listingType === 'sold' ? 'sold' : 'estimate',
    fetchedAt: now,
  }));
}

/**
 * Generic Perplexity stamp search across any domain.
 * Used as a fallback when specific platform searches return no results.
 */
export async function searchGenericStampPrices(
  stampDescription: string
): Promise<PriceSource[]> {
  if (!stampDescription.trim()) return [];

  const systemPrompt = `You are an expert philatelic pricing researcher. Search for current market values and recent sold prices for the described stamp. Provide specific prices from auction results, dealer listings, or catalogue values. Be precise with all numbers and currencies.`;

  const userPrompt = `What is the current market value of this stamp: "${stampDescription}"? Find recent sold prices and current listings with specific dollar amounts.`;

  const result = await perplexityChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  if (!result) return [];

  const extracted = extractPricesFromText(result.content, result.citations);
  const now = new Date().toISOString();

  return extracted.map((item): PriceSource => ({
    platform: 'delcampe', // fallback attribution
    price: item.price,
    currency: item.currency,
    url: item.url,
    title: item.title,
    condition: null,
    soldDate: item.soldDate,
    listingType: item.listingType,
    fetchedAt: now,
  }));
}
