/* ──────────────────────────────────────────────────────────────────────────────
 * StampVault – Perplexity API Integration
 *
 * Uses the OpenAI-compatible Perplexity API for:
 *   1. Deep stamp research with source citations
 *   2. Live market price discovery
 *   3. Knowledge base construction
 *   4. Catalog lookups
 *
 * Models:
 *   - sonar-pro          → fast queries (prices, catalog lookups)
 *   - sonar-deep-research → multi-step research with extensive citations
 * ────────────────────────────────────────────────────────────────────────────── */

import OpenAI from 'openai';
import type { Citation } from '@/types/chat';

// ── Client ──────────────────────────────────────────────────────────────────

function getPerplexity(): OpenAI {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY is not set');
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.perplexity.ai',
  });
}

const QUICK_MODEL = 'sonar-pro';
const DEEP_MODEL = 'sonar-deep-research';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ResearchResult {
  content: string;
  citations: Citation[];
  model: string;
}

export interface MarketPriceResult {
  prices: {
    source: string;
    price: number;
    condition: string;
    url: string;
    date: string;
  }[];
  summary: string;
  citations: Citation[];
}

export interface KnowledgeBaseResult {
  topic: string;
  content: string;
  sections: { heading: string; body: string }[];
  citations: Citation[];
}

export interface CatalogSearchResult {
  results: {
    catalogNumber: string;
    description: string;
    estimatedValue: string;
    source: string;
  }[];
  rawContent: string;
  citations: Citation[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract citations from a Perplexity response.
 * Perplexity returns citations in the response metadata under `citations`.
 */
function extractCitations(
  response: OpenAI.Chat.Completions.ChatCompletion,
): Citation[] {
  const raw = (response as unknown as Record<string, unknown>).citations;
  if (!Array.isArray(raw)) return [];
  return raw.map((url: string, i: number) => ({
    title: `Source ${i + 1}`,
    url: typeof url === 'string' ? url : '',
    snippet: '',
  }));
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Deep research on a specific stamp.
 * Uses sonar-deep-research for thorough, multi-step investigation.
 */
export async function deepResearchStamp(
  scottNumber: string | undefined,
  country: string,
  year: number,
): Promise<ResearchResult> {
  const client = getPerplexity();
  const identifier = scottNumber
    ? `Scott catalog number ${scottNumber}`
    : `${country} ${year} stamp`;

  const response = await client.chat.completions.create({
    model: DEEP_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are an expert philatelist researcher. Provide comprehensive, factual research about postage stamps. Include historical context, printing details, known varieties, errors, and current market valuation. Always cite your sources.`,
      },
      {
        role: 'user',
        content: `Research this postage stamp thoroughly: ${identifier}

Please cover:
1. **Identification**: Full catalog details (Scott, SG, Michel numbers if known)
2. **History**: When and why it was issued, the design story, the designer/engraver
3. **Technical Details**: Printing method, paper type, perforation gauge, watermark, colors
4. **Varieties & Errors**: Known color varieties, plate flaws, printing errors
5. **Market Value**: Current catalog value (mint/used), recent auction results, price trends
6. **Collecting Notes**: Tips for authentication, common forgeries, grading considerations
7. **Rarity**: Print run, survival estimate, census data if available`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? '';
  const citations = extractCitations(response);

  return {
    content,
    citations,
    model: DEEP_MODEL,
  };
}

/**
 * Search for current market prices across stamp marketplaces.
 * Uses sonar-pro for fast, real-time results.
 */
export async function getLiveMarketPrices(
  stampDescription: string,
): Promise<MarketPriceResult> {
  const client = getPerplexity();

  const response = await client.chat.completions.create({
    model: QUICK_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a stamp market price researcher. Search for current listings and recent sales of postage stamps across online marketplaces including eBay, HipStamp, Delcampe, and StampWorld.

Return your findings as a JSON object with this structure:
{
  "prices": [
    {
      "source": "marketplace name",
      "price": numeric_price_usd,
      "condition": "mint/used/etc",
      "url": "listing URL if available",
      "date": "YYYY-MM-DD"
    }
  ],
  "summary": "brief price analysis paragraph"
}

Wrap the JSON in a markdown code block. Be precise about prices and conditions. Convert all prices to USD.`,
      },
      {
        role: 'user',
        content: `Find current market prices for this stamp: ${stampDescription}

Search eBay sold listings, HipStamp, Delcampe, and any other stamp marketplace with active listings. Include both mint and used prices where available.`,
      },
    ],
  });

  const rawContent = response.choices[0]?.message?.content ?? '';
  const citations = extractCitations(response);

  // Parse structured data
  let prices: MarketPriceResult['prices'] = [];
  let summary = rawContent;

  try {
    const codeBlockMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      const parsed = JSON.parse(codeBlockMatch[1].trim()) as {
        prices?: MarketPriceResult['prices'];
        summary?: string;
      };
      prices = parsed.prices ?? [];
      summary = parsed.summary ?? rawContent;
    }
  } catch {
    // If JSON parsing fails, return raw content as summary
    summary = rawContent;
  }

  return { prices, summary, citations };
}

/**
 * Build a comprehensive knowledge base entry on a philatelic topic.
 * Uses sonar-deep-research for thorough content generation.
 */
export async function buildKnowledgeBase(
  topic: string,
): Promise<KnowledgeBaseResult> {
  const client = getPerplexity();

  const response = await client.chat.completions.create({
    model: DEEP_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a philatelic encyclopedia writer. Create comprehensive, well-organized reference material about stamp collecting topics. Structure your response with clear headings and detailed content suitable for a knowledge base.

Format your response as a JSON object:
{
  "topic": "topic title",
  "content": "full article in markdown",
  "sections": [
    { "heading": "section heading", "body": "section content in markdown" }
  ]
}

Wrap the JSON in a markdown code block.`,
      },
      {
        role: 'user',
        content: `Create a comprehensive knowledge base article about: ${topic}

Include historical context, technical details, identification tips, market insights, and collecting advice. Make it authoritative and useful for both beginning and advanced collectors.`,
      },
    ],
  });

  const rawContent = response.choices[0]?.message?.content ?? '';
  const citations = extractCitations(response);

  let result: KnowledgeBaseResult = {
    topic,
    content: rawContent,
    sections: [],
    citations,
  };

  try {
    const codeBlockMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      const parsed = JSON.parse(codeBlockMatch[1].trim()) as Partial<KnowledgeBaseResult>;
      result = {
        topic: parsed.topic ?? topic,
        content: parsed.content ?? rawContent,
        sections: parsed.sections ?? [],
        citations,
      };
    }
  } catch {
    // Fallback: parse markdown headings into sections
    const sectionRegex = /##\s+(.+?)\n([\s\S]*?)(?=##\s|$)/g;
    const sections: KnowledgeBaseResult['sections'] = [];
    let match: RegExpExecArray | null;
    while ((match = sectionRegex.exec(rawContent)) !== null) {
      sections.push({ heading: match[1].trim(), body: match[2].trim() });
    }
    result.sections = sections;
  }

  return result;
}

/**
 * Search stamp catalogs for a specific query.
 * Uses sonar-pro for quick catalog lookups.
 */
export async function searchStampCatalogs(
  searchQuery: string,
): Promise<CatalogSearchResult> {
  const client = getPerplexity();

  const response = await client.chat.completions.create({
    model: QUICK_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a stamp catalog search specialist. Search online stamp catalogs (Scott, Stanley Gibbons, Michel, Yvert) for the requested stamp information.

Return your findings as a JSON object:
{
  "results": [
    {
      "catalogNumber": "catalog number",
      "description": "stamp description",
      "estimatedValue": "price range string",
      "source": "catalog name"
    }
  ]
}

Wrap the JSON in a markdown code block. Provide accurate catalog numbers and current catalog values.`,
      },
      {
        role: 'user',
        content: `Search stamp catalogs for: ${searchQuery}

Provide catalog numbers from Scott, SG, and Michel where available, along with descriptions and estimated values.`,
      },
    ],
  });

  const rawContent = response.choices[0]?.message?.content ?? '';
  const citations = extractCitations(response);

  let results: CatalogSearchResult['results'] = [];

  try {
    const codeBlockMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      const parsed = JSON.parse(codeBlockMatch[1].trim()) as {
        results?: CatalogSearchResult['results'];
      };
      results = parsed.results ?? [];
    }
  } catch {
    // Return raw content if parsing fails
  }

  return { results, rawContent, citations };
}
