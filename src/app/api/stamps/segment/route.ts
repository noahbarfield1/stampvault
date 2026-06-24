/* ──────────────────────────────────────────────────────────────────────────────
 * POST /api/stamps/segment
 *
 * Accept an album page image and detect all individual stamps using
 * Gemini 2.5 Flash vision. Returns bounding boxes as percentage
 * coordinates, descriptions, and confidence scores.
 * ────────────────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';
import { VERIFIED_STAMPS } from '@/lib/pricing/verified-database';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const SEGMENTATION_PROMPT = `You are an expert philatelist and computer-vision specialist.

Analyze the provided image and detect every individual postage stamp visible.

For EACH stamp found return a JSON object with exactly these fields:
- "boundingBox": { "x1": <number>, "y1": <number>, "x2": <number>, "y2": <number> }
  All coordinates are PERCENTAGES (0-100) of the total image width (x) and height (y).
  x1 < x2 and y1 < y2 must always be true.
- "description": a brief one-line description including country name, denomination, and dominant color
- "confidence": a float between 0 and 1 representing detection confidence

Return a JSON array of these objects. If no stamps are found, return an empty array [].

If the image shows a SINGLE stamp (not an album page), return a single detection covering the entire visible stamp area.

Critical rules:
1. Coordinates are PERCENTAGES of image dimensions, NOT pixels.
2. Include partially visible stamps but lower their confidence below 0.5.
3. Do NOT include album page borders, page numbers, labels, or non-stamp elements.
4. Do NOT include stamp mounts, hinges, or sleeves as separate items.
5. If multiple stamps overlap, identify each one separately.
6. For blocks or strips of connected stamps, identify the entire block as one item.
7. Each bounding box must have width >= 3% and height >= 3% of the image dimensions.
8. If the image is NOT a stamp or album page (e.g., a regular photo), return an empty array.`;

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

/**
 * Generate rotating mock segmentation instead of always returning Inverted Jenny.
 */
function generateRotatingMockSegmentation(imageBase64: string) {
  let hash = 0;
  const sample = imageBase64.slice(0, 200);
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) - hash + sample.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % VERIFIED_STAMPS.length;
  const stamp = VERIFIED_STAMPS[idx];

  return {
    stamps: [
      {
        boundingBox: { x1: 5, y1: 5, x2: 95, y2: 95 },
        description: stamp.description,
        confidence: 0.85,
      },
    ],
    count: 1,
    _mockMode: true,
  };
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

    const projectId = process.env.VERTEX_AI_PROJECT_ID;
    const location = process.env.VERTEX_AI_LOCATION || 'us-central1';
    const apiKey = process.env.GOOGLE_API_KEY;

    let ai: GoogleGenAI;
    if (projectId) {
      // Use ADC to obtain an OAuth2 access token for Vertex AI
      const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
      const token = await auth.getAccessToken();
      ai = new GoogleGenAI({
        vertexai: true,
        project: projectId,
        location: location,
        httpOptions: {
          headers: { Authorization: `Bearer ${token}` },
        },
      } as any);
    } else if (apiKey && apiKey !== 'your-google-api-key') {
      ai = new GoogleGenAI({ apiKey });
    } else {
      console.warn('[API /stamps/segment] Missing AI credentials. Using rotating mock.');
      return NextResponse.json(generateRotatingMockSegmentation(body.imageBase64));
    }

    // Strip data URL prefix if present
    const cleanBase64 = body.imageBase64.replace(
      /^data:image\/\w+;base64,/,
      '',
    );
    const mime = body.mimeType || 'image/jpeg';

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
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

    // Validate and clamp bounding boxes with stricter rules
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
      }))
      .filter((s) => {
        // Reject impossibly small or impossibly large detections
        const width = s.boundingBox.x2 - s.boundingBox.x1;
        const height = s.boundingBox.y2 - s.boundingBox.y1;
        return width >= 2 && height >= 2 && width <= 98 && height <= 98;
      });

    return NextResponse.json({ stamps, count: stamps.length });
  } catch (error) {
    console.error('[API /stamps/segment] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Stamp segmentation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
