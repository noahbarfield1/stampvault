/* ──────────────────────────────────────────────────────────────────────────────
 * POST /api/stamps/segment
 *
 * Accept an album page image and detect all individual stamps using
 * Gemini 2.5 Flash vision. Returns bounding boxes as percentage
 * coordinates, descriptions, and confidence scores.
 * ────────────────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const SEGMENTATION_PROMPT = `You are an expert philatelist and computer-vision specialist.

Analyze the provided image of an album page or stock page. Detect every individual postage stamp visible in the image.

For EACH stamp found return a JSON object with exactly these fields:
- "boundingBox": { "x1": <number>, "y1": <number>, "x2": <number>, "y2": <number> }
  All coordinates are PERCENTAGES (0-100) of the total image width (x) and height (y).
  x1 < x2 and y1 < y2 must always be true.
- "description": a brief one-line description including country name, denomination, and dominant color
- "confidence": a float between 0 and 1 representing detection confidence

Return a JSON array of these objects. If no stamps are found, return an empty array [].

Critical rules:
1. Coordinates are PERCENTAGES of image dimensions, NOT pixels.
2. Include partially visible stamps but lower their confidence below 0.5.
3. Do NOT include album page borders, page numbers, labels, or non-stamp elements.
4. Do NOT include stamp mounts, hinges, or sleeves as separate items.
5. If multiple stamps overlap, identify each one separately.
6. For blocks or strips of connected stamps, identify the entire block as one item.`;

interface SegmentRequestBody {
  imageBase64: string;
  mimeType?: string;
}

interface RawDetectedStamp {
  boundingBox?: {
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  };
  description?: string;
  confidence?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SegmentRequestBody;

    if (!body.imageBase64) {
      return NextResponse.json(
        { error: 'imageBase64 is required' },
        { status: 400 },
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_API_KEY is not configured on the server' },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Strip data URL prefix if present
    const cleanBase64 = body.imageBase64.replace(
      /^data:image\/\w+;base64,/,
      '',
    );
    const mime = body.mimeType || 'image/jpeg';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mime,
              },
            },
            { text: SEGMENTATION_PROMPT },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const text = response.text ?? '[]';

    let parsed: RawDetectedStamp[];
    try {
      const raw = JSON.parse(text);
      parsed = Array.isArray(raw) ? raw : [];
    } catch {
      // Attempt to extract JSON from a code block if Gemini wraps it
      const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
      if (codeBlockMatch) {
        try {
          const raw = JSON.parse(codeBlockMatch[1].trim());
          parsed = Array.isArray(raw) ? raw : [];
        } catch {
          parsed = [];
        }
      } else {
        parsed = [];
      }
    }

    // Validate and clamp bounding boxes
    const stamps = parsed
      .filter(
        (s): s is Required<RawDetectedStamp> =>
          !!s.boundingBox &&
          typeof s.boundingBox.x1 === 'number' &&
          typeof s.boundingBox.y1 === 'number' &&
          typeof s.boundingBox.x2 === 'number' &&
          typeof s.boundingBox.y2 === 'number' &&
          s.boundingBox.x1 < s.boundingBox.x2 &&
          s.boundingBox.y1 < s.boundingBox.y2 &&
          typeof s.confidence === 'number' &&
          s.confidence > 0,
      )
      .map((s) => ({
        boundingBox: {
          x1: Math.max(0, Math.min(100, s.boundingBox.x1!)),
          y1: Math.max(0, Math.min(100, s.boundingBox.y1!)),
          x2: Math.max(0, Math.min(100, s.boundingBox.x2!)),
          y2: Math.max(0, Math.min(100, s.boundingBox.y2!)),
        },
        description: s.description || 'Unknown stamp',
        confidence: Math.max(0, Math.min(1, s.confidence!)),
      }));

    return NextResponse.json({ stamps, count: stamps.length });
  } catch (error) {
    console.error('[API /stamps/segment] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Stamp segmentation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
