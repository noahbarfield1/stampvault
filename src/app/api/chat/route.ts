/* ──────────────────────────────────────────────────────────────────────────────
 * POST /api/chat
 *
 * Streaming AI chat endpoint using Vercel AI SDK + Gemini 2.5 Flash.
 * Builds context-aware system prompts based on whether the user is
 * discussing a specific stamp, their collection, or general philately.
 * ────────────────────────────────────────────────────────────────────────────── */

import { NextRequest } from 'next/server';
import { streamText, type ModelMessage } from 'ai';
import { google } from '@ai-sdk/google';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/* ─── System Prompt Foundation ───────────────────────────────────────── */

const BASE_SYSTEM_PROMPT = `You are PerdueStampVault AI, a world-class philatelist assistant with deep expertise in postage stamps from every country, era, and specialty.

Your knowledge spans:
• **Identification**: Scott, Stanley Gibbons, Michel, Yvert & Tellier catalog systems
• **Grading**: APS grading standards, centering, gum condition, cancellation quality
• **Valuation**: Current market trends, auction realizations, dealer pricing, investment potential
• **History**: Postal history, issuing authorities, printing methods, paper varieties
• **Varieties**: Color varieties, plate flaws, watermark types, perforation gauges
• **Errors**: Inverted centers, missing colors, imperforate errors, overprint varieties
• **Collecting**: Thematic collecting, topical categories, first day covers, postal stationery

Guidelines:
1. Be precise with catalog numbers, dates, and technical details.
2. When discussing values, always note that prices are estimates and market conditions vary.
3. Use markdown formatting for readability: bold for emphasis, lists for multiple points, headers for sections.
4. If uncertain, say so honestly and suggest how the user can verify.
5. Be enthusiastic about philately while remaining authoritative.
6. When discussing specific stamps, reference relevant catalog numbers and known varieties.
7. Provide actionable advice for collectors at all levels.`;

/* ─── Context Types ──────────────────────────────────────────────────── */

interface ChatRequestBody {
  messages: ModelMessage[];
  context?: {
    type: 'stamp' | 'collection' | 'pricing' | 'identification' | 'general';
    stampData?: Record<string, unknown>;
    collectionStats?: Record<string, unknown>;
    stampId?: string;
  };
}

/* ─── System Prompt Builder ──────────────────────────────────────────── */

function buildSystemPrompt(context?: ChatRequestBody['context']): string {
  let prompt = BASE_SYSTEM_PROMPT;

  if (!context) return prompt;

  switch (context.type) {
    case 'stamp':
      if (context.stampData) {
        prompt += `\n\n## Current Context: Specific Stamp Discussion
You are discussing a specific stamp from the user's collection. Here are the known details:

\`\`\`json
${JSON.stringify(context.stampData, null, 2)}
\`\`\`

Use this information to provide targeted advice. Reference the stamp's specific attributes (catalog number, country, year, condition) in your responses. If asked about value, compare this stamp's condition to typical market examples. Point out any notable varieties or errors that might exist for this issue.`;
      }
      break;

    case 'collection':
      if (context.collectionStats) {
        prompt += `\n\n## Current Context: Collection Analysis
You are advising the user about their stamp collection. Here are their collection statistics:

\`\`\`json
${JSON.stringify(context.collectionStats, null, 2)}
\`\`\`

Provide insights about:
- Collection diversification and gaps
- Value trends and potential appreciation
- Recommended acquisitions to strengthen the collection
- Storage and preservation best practices
- Insurance and documentation recommendations
- Areas where the collection excels or could improve`;
      }
      break;

    case 'pricing':
      prompt += `\n\n## Current Context: Pricing Discussion
The user is asking about stamp values and pricing. Focus on:
- Current market conditions and trends
- Factors that affect stamp value (centering, gum, cancellation, rarity)
- Differences between catalog value and market value
- Where to buy/sell stamps for best value
- Authentication and grading services (PSE, APEX, etc.)
- Investment potential and historical price appreciation`;
      break;

    case 'identification':
      prompt += `\n\n## Current Context: Stamp Identification
The user needs help identifying stamps. Focus on:
- Key identification features (watermarks, perforations, printing methods)
- How to distinguish similar stamps from different printings
- Tools and techniques for identification (perf gauge, watermark detector, UV lamp)
- Catalog lookup strategies
- Common identification pitfalls and frequently confused stamps`;
      break;

    default:
      break;
  }

  return prompt;
}

/* ─── Handler ────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestBody;

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages array is required and must not be empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const googleKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!googleKey || googleKey === 'your-google-api-key') {
      return new Response(
        JSON.stringify({ error: 'Google AI API key is not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = buildSystemPrompt(body.context);

    const result = streamText({
      model: google('gemini-3.5-flash'),
      system: systemPrompt,
      messages: body.messages,
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 4096,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[API /chat] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Chat request failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
