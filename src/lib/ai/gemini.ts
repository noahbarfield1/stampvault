/* ──────────────────────────────────────────────────────────────────────────────
 * StampVault – Gemini AI Integration
 *
 * Uses @google/genai SDK (Gemini 2.5 Flash) for:
 *   1. Page segmentation – detect individual stamps on a scanned album page
 *   2. Stamp identification – return structured philatelic metadata
 *   3. Streaming chat – contextual conversations about stamps / collections
 * ────────────────────────────────────────────────────────────────────────────── */

import { GoogleGenAI, type Content, type Part } from '@google/genai';
import type { DetectedStamp } from '@/types/stamp';
import type { Stamp } from '@/types/stamp';
import type { ChatMessage } from '@/types/chat';
import type { CollectionStats } from '@/types/collection';

// ── Client singleton ────────────────────────────────────────────────────────

function getClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY is not set');
  return new GoogleGenAI({ apiKey });
}

const MODEL = 'gemini-2.5-flash';

// ── System Prompts ──────────────────────────────────────────────────────────

const SEGMENTATION_PROMPT = `You are an expert philatelist and computer vision specialist.
Analyze the provided image of an album page and detect every individual stamp visible.

For each stamp found, return a JSON object with these fields:
- boundingBox: { x1, y1, x2, y2 } — coordinates as PERCENTAGES (0-100) of the total image width/height
- description: brief one-line description (country, denomination, dominant color)
- confidence: float 0-1 representing detection confidence

Return your response as a JSON array, wrapped in a markdown json code block.
If no stamps are found, return an empty array: []

Important rules:
- x1 < x2 and y1 < y2 always
- Coordinates are percentages, NOT pixels
- Include partially visible stamps at reduced confidence
- Do NOT include album page borders, labels, or non-stamp elements`;

const IDENTIFICATION_PROMPT = `You are a world-class philatelist AI assistant with encyclopedic knowledge of postage stamps.
Analyze the provided stamp image and return structured JSON with as many fields as you can confidently determine:

{
  "country": "string — issuing country, use full English name",
  "yearOfIssue": number,
  "era": "classic | semi-modern | modern | contemporary",
  "denomination": "string — face value with currency symbol",
  "scottNumber": "string — Exact Scott catalog number (e.g. 'C3a', '1', '37 var') if identifiable, or null. CRITICAL: Be extremely precise with suffixes.",
  "condition": "Superb | Extremely Fine | Very Fine | Fine | Very Good | Good | Average | Poor",
  "gradeScore": number (0-100),
  "colorVariant": "string — primary color description",
  "perforationGauge": "string — e.g. 'Perf 11' or 'Imperf'",
  "watermark": "string — watermark description or 'None'",
  "printingMethod": "engraved | lithography | gravure | offset | typography | unknown",
  "topicThemes": ["string array of thematic tags"],
  "gumCondition": "NH | LH | HH | OG | NG | N/A",
  "cancellationType": "string — e.g. 'CDS', 'wavy lines', 'pen cancel', 'Mint/unused'",
  "isError": boolean,
  "errorDescription": "string or null",
  "currentPrice": {
    "estimated": number (USD estimate),
    "mint": number or null,
    "used": number or null,
    "sources": []
  },
  "aiConfidence": number (0-1),
  "aiIdentificationNotes": "string — explain reasoning, key identifiers, and any uncertainties"
}

Return ONLY the JSON object, wrapped in a markdown json code block.
Be honest about uncertainty. If you cannot determine a field, provide your best estimate and lower your aiConfidence.`;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Extract JSON from a markdown code-fenced response. */
function extractJson<T>(text: string): T {
  // Try to extract from code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr) as T;
}

/** Convert ChatMessage[] to Gemini Content format. */
function toGeminiContents(messages: ChatMessage[]): Content[] {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: buildParts(m),
    }));
}

function buildParts(msg: ChatMessage): Part[] {
  const parts: Part[] = [{ text: msg.content }];
  if (msg.imageUrl) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: msg.imageUrl.replace(/^data:image\/\w+;base64,/, ''),
      },
    });
  }
  return parts;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Segment a scanned album page into individual stamps.
 * Returns bounding boxes + descriptions for each detected stamp.
 */
export async function segmentStampsFromPage(
  imageBase64: string,
): Promise<DetectedStamp[]> {
  const client = getClient();

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: SEGMENTATION_PROMPT },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
            },
          },
        ],
      },
    ],
  });

  const text = response.text ?? '';
  const stamps = extractJson<DetectedStamp[]>(text);

  // Validate bounding boxes
  return stamps
    .filter(
      (s) =>
        s.boundingBox &&
        s.boundingBox.x1 < s.boundingBox.x2 &&
        s.boundingBox.y1 < s.boundingBox.y2 &&
        s.confidence > 0,
    )
    .map((s) => ({
      ...s,
      boundingBox: {
        x1: Math.max(0, Math.min(100, s.boundingBox.x1)),
        y1: Math.max(0, Math.min(100, s.boundingBox.y1)),
        x2: Math.max(0, Math.min(100, s.boundingBox.x2)),
        y2: Math.max(0, Math.min(100, s.boundingBox.y2)),
      },
      confidence: Math.max(0, Math.min(1, s.confidence)),
    }));
}

/**
 * Identify a single stamp from its cropped image.
 * Returns partial Stamp data with AI-generated metadata.
 */
export async function identifyStamp(
  imageBase64: string,
): Promise<Partial<Stamp>> {
  const client = getClient();

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: IDENTIFICATION_PROMPT },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
            },
          },
        ],
      },
    ],
  });

  const text = response.text ?? '';
  const parsed = extractJson<any>(text);

  const conditionMap: Record<string, any> = {
    'superb': 'superb',
    'extremely fine': 'very_fine',
    'very fine': 'very_fine',
    'fine': 'fine',
    'very good': 'fine',
    'good': 'poor',
    'average': 'poor',
    'poor': 'poor',
  };

  const cond = parsed.condition?.toLowerCase() || 'unknown';
  const mappedCondition = conditionMap[cond] || 'unknown';

  const eraMap: Record<string, any> = {
    'classic': 'classic',
    'semi-modern': 'semi-modern',
    'modern': 'modern',
    'contemporary': 'modern',
  };
  const mappedEra = eraMap[parsed.era?.toLowerCase()] || 'modern';

  const rarityMap: Record<string, any> = {
    'common': 'common',
    'uncommon': 'uncommon',
    'scarce': 'scarce',
    'rare': 'rare',
    'very_rare': 'very_rare',
    'extremely_rare': 'extremely_rare',
    'unique': 'unique',
  };
  const mappedRarity = rarityMap[parsed.rarity?.toLowerCase()] || 'common';

  // Ensure defaults for critical fields mapping to nested Stamp
  return {
    identification: {
      country: parsed.country ?? 'Unknown',
      year: parsed.yearOfIssue ?? null,
      denomination: parsed.denomination ?? 'Unknown',
      scottNumber: parsed.scottNumber ?? null,
      michelNumber: null,
      description: parsed.description ?? 'Stamp analyzed by AI',
      condition: mappedCondition,
      rarity: mappedRarity,
      color: parsed.colorVariant ?? null,
      perforation: parsed.perforationGauge ?? null,
      watermark: parsed.watermark ?? null,
      series: null,
      confidence: parsed.aiConfidence ?? 0.5,
      status: 'identified',
    },
    pricing: parsed.currentPrice ? {
      estimatedValue: parsed.currentPrice.estimated ?? 0,
      currency: 'USD',
      confidence: parsed.aiConfidence ?? 0.5,
      sources: parsed.currentPrice.sources ?? [],
      priceRange: {
        min: parsed.currentPrice.mint ?? 0,
        max: parsed.currentPrice.used ?? 0,
      },
      lastUpdated: new Date().toISOString(),
      hipValue: null,
      sourceBreakdown: {
        hipstamp: null,
        ebay: null,
        delcampe: null,
        stampworld: null,
      },
    } : null,
    notes: parsed.aiIdentificationNotes ?? '',
    tags: parsed.topicThemes ?? [],
    grade: parsed.gradeScore ?? null,
    isFavorite: false,
    purchasePrice: null,
    purchaseDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Streaming chat about a specific stamp.
 * Returns a ReadableStream of text chunks.
 */
export function chatAboutStamp(
  messages: ChatMessage[],
  stampContext?: Partial<Stamp>,
): ReadableStream<string> {
  const systemInstruction = stampContext
    ? `You are StampVault AI, an expert philatelist assistant. You are discussing a specific stamp with the following known details:\n\n${JSON.stringify(stampContext, null, 2)}\n\nProvide detailed, knowledgeable responses. If asked about pricing, note that values are estimates. Be precise about catalog numbers, varieties, and historical context. Format responses with markdown when helpful.`
    : `You are StampVault AI, an expert philatelist assistant. Help users identify, evaluate, and learn about postage stamps. Be precise, knowledgeable, and enthusiastic about philately.`;

  return createChatStream(messages, systemInstruction);
}

/**
 * Streaming chat about the user's entire collection.
 * Returns a ReadableStream of text chunks.
 */
export function chatAboutCollection(
  messages: ChatMessage[],
  collectionStats: Partial<CollectionStats>,
): ReadableStream<string> {
  const systemInstruction = `You are StampVault AI, an expert philatelist and collection advisor. You have access to the user's collection statistics:\n\n${JSON.stringify(collectionStats, null, 2)}\n\nProvide insights about collection value, diversification, gaps, and recommendations. Suggest areas to expand, stamps that might appreciate, and collection management strategies. Format responses with markdown when helpful.`;

  return createChatStream(messages, systemInstruction);
}

/**
 * Internal: create a ReadableStream that pipes Gemini's streaming response.
 */
function createChatStream(
  messages: ChatMessage[],
  systemInstruction: string,
): ReadableStream<string> {
  const client = getClient();
  const contents = toGeminiContents(messages);

  return new ReadableStream<string>({
    async start(controller) {
      try {
        const response = await client.models.generateContentStream({
          model: MODEL,
          config: {
            systemInstruction,
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 4096,
          },
          contents,
        });

        for await (const chunk of response) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(text);
          }
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
