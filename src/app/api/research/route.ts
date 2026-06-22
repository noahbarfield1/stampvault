/* ──────────────────────────────────────────────────────────────────────────────
 * POST /api/research
 *
 * Deep research endpoint using Perplexity AI (sonar-pro / sonar-deep-research).
 * Performs thorough multi-step research on stamp-related queries with source
 * citations.
 * ────────────────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface ResearchRequestBody {
  query: string;
  model?: 'sonar-pro' | 'sonar-deep-research';
  systemPrompt?: string;
}

/* ─── Handler ────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ResearchRequestBody;

    if (!body.query || body.query.trim().length === 0) {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 },
      );
    }

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'PERPLEXITY_API_KEY is not configured on the server' },
        { status: 500 },
      );
    }

    const perplexity = new OpenAI({
      apiKey,
      baseURL: 'https://api.perplexity.ai',
    });

    const model = body.model || 'sonar-pro';

    const systemPrompt =
      body.systemPrompt ||
      `You are an expert philatelist researcher with access to the world's stamp catalogs, auction records, and philatelic literature. Provide comprehensive, factual research about postage stamps and philatelic topics.

When researching stamps, cover these aspects as applicable:
1. **Identification**: Full catalog details (Scott, SG, Michel numbers)
2. **History**: Issue date, purpose, design story, designer/engraver
3. **Technical Details**: Printing method, paper type, perforation gauge, watermark, colors, varieties
4. **Varieties & Errors**: Known color varieties, plate flaws, printing errors, overprint varieties
5. **Market Value**: Current catalog value (mint/used), recent auction results, price trends over time
6. **Collecting Notes**: Authentication tips, common forgeries, grading considerations, rarity estimates
7. **Related Issues**: Stamps from the same series, similar designs, or historically connected issues

Always cite your sources. Be precise with catalog numbers, dates, and values. Note any uncertainties or conflicting information across sources.`;

    const completion = await perplexity.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: body.query },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? '';

    // Extract citations from the Perplexity response
    const rawCitations = (
      completion as unknown as Record<string, unknown>
    ).citations;

    let citations: { title: string; url: string; snippet: string }[] = [];
    if (Array.isArray(rawCitations)) {
      citations = rawCitations.map((cite: unknown, i: number) => {
        if (typeof cite === 'string') {
          return { title: `Source ${i + 1}`, url: cite, snippet: '' };
        }
        if (typeof cite === 'object' && cite !== null) {
          const obj = cite as Record<string, unknown>;
          return {
            title:
              typeof obj.title === 'string' ? obj.title : `Source ${i + 1}`,
            url: typeof obj.url === 'string' ? obj.url : '',
            snippet: typeof obj.snippet === 'string' ? obj.snippet : '',
          };
        }
        return { title: `Source ${i + 1}`, url: '', snippet: '' };
      });
    }

    return NextResponse.json({
      content,
      citations,
      model,
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      },
    });
  } catch (error) {
    console.error('[API /research] Error:', error);

    // Handle Perplexity-specific errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded. Please wait a moment and try again.',
          },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: `Perplexity API error: ${error.message}` },
        { status: error.status || 500 },
      );
    }

    const message =
      error instanceof Error ? error.message : 'Research query failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
