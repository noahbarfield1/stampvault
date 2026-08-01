/* ──────────────────────────────────────────────────────────────────────────────
 * POST /api/stamps/segment
 *
 * Accept an album page image and detect every individual stamp using
 * Gemini 2.5 Flash vision. Returns bounding boxes in percentage coordinates.
 *
 * The coordinate handling lives in @/lib/segmentation/normalize so it can be
 * unit-tested without a Vertex credential — see normalize.check.mjs. Read the
 * header comment there before changing anything about coordinates.
 * ────────────────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { VERTEX_PROJECT, VERTEX_LOCATION, getVertexAuthOptions } from '@/lib/ai/vertex';
import {
  normalizeDetections,
  parseSegmentationText,
  MAX_DETECTIONS,
} from '@/lib/segmentation/normalize';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Asks for Gemini's own documented detection format rather than inventing one.
 * The previous prompt demanded percentages; the model emitted normalized 0-1000
 * regardless, which the route then destroyed. Meeting the model where it is
 * removes a whole class of failure.
 */
const SEGMENTATION_PROMPT = `Detect every individual postage stamp in this image.

Return a JSON array. For each stamp, one object:
{"box_2d": [ymin, xmin, ymax, xmax], "label": "<country, denomination, dominant colour>", "confidence": <0-1>}

box_2d uses integers 0-1000 normalized to the image height (y) and width (x),
in the order ymin, xmin, ymax, xmax. ymin < ymax and xmin < xmax.

Rules:
- If the image shows one stamp filling most of the frame, return one box around it.
- Include partially visible stamps, with confidence below 0.5.
- Exclude album borders, page numbers, handwriting, mounts, hinges and sleeves.
- A connected block or strip of stamps is ONE box.
- If the image contains no postage stamps, return [].`;

/** Structured output. With this set, the model cannot wrap the array in prose. */
const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      box_2d: {
        type: Type.ARRAY,
        items: { type: Type.INTEGER },
        minItems: '4',
        maxItems: '4',
      },
      label: { type: Type.STRING },
      confidence: { type: Type.NUMBER },
    },
    required: ['box_2d', 'label', 'confidence'],
  },
} as const;

interface SegmentRequestBody {
  imageBase64: string;
  mimeType?: string;
}

/** Total wall-clock budget, leaving headroom under the 60s maxDuration. */
const TOTAL_BUDGET_MS = 50_000;
const MAX_ATTEMPT_MS = 25_000;
const MIN_ATTEMPT_MS = 8_000;

const DATA_URL_RE = /^data:(image\/[\w+.-]+);base64,/;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SegmentRequestBody;

    if (!body.imageBase64) {
      return NextResponse.json(
        { error: 'imageBase64 is required', reason: 'bad_request' },
        { status: 400 },
      );
    }

    // Derive the real mime type from the data URL. The client does not always
    // send one, and resizeImageForUpload returns the ORIGINAL data URL
    // untouched when no downscale is needed — so a PNG could reach the model
    // declared as image/jpeg.
    const match = DATA_URL_RE.exec(body.imageBase64);
    const mime = body.mimeType ?? match?.[1] ?? 'image/jpeg';
    const cleanBase64 = body.imageBase64.replace(DATA_URL_RE, '');

    const segmentAuthOptions = getVertexAuthOptions();
    const ai = new GoogleGenAI({
      vertexai: true,
      project: VERTEX_PROJECT,
      location: VERTEX_LOCATION,
      ...(segmentAuthOptions ? { googleAuthOptions: segmentAuthOptions } : {}),
    });

    // Bound each attempt against a shared wall clock. Previously this route had
    // no abortSignal at all, so a hung Vertex call consumed the full 60s and
    // Vercel returned a bare 504 with no JSON body — indistinguishable, to the
    // client, from any other failure.
    const deadline = Date.now() + TOTAL_BUDGET_MS;
    let text = '';
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const budget = Math.min(MAX_ATTEMPT_MS, deadline - Date.now());
      if (budget < MIN_ATTEMPT_MS) break;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { data: cleanBase64, mimeType: mime } },
                { text: SEGMENTATION_PROMPT },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0,
            // Segmentation is perception, not reasoning. 2.5-flash thinks by
            // default, and that budget can be exhausted before any text is
            // emitted — producing an empty response that used to be silently
            // read as "no stamps found".
            thinkingConfig: { thinkingBudget: 0 },
            maxOutputTokens: 4096,
            abortSignal: AbortSignal.timeout(budget),
          },
        });

        if (response.text && response.text.trim()) {
          text = response.text;
          break;
        }
        lastError = new Error('AI returned an empty response');
        console.warn(`[API /stamps/segment] Empty response (attempt ${attempt}/2)`);
      } catch (err) {
        lastError = err;
        console.warn(
          `[API /stamps/segment] Attempt ${attempt}/2 failed:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (!text) {
      console.error('[API /stamps/segment] No usable response:', lastError);
      return NextResponse.json(
        {
          error:
            lastError instanceof Error
              ? lastError.message
              : 'Stamp detection returned no response',
          reason: 'model_empty_response',
        },
        { status: 502 },
      );
    }

    const parsed = parseSegmentationText(text);
    if (!parsed.ok) {
      console.error('[API /stamps/segment] Unparseable response:', text.slice(0, 400));
      return NextResponse.json(
        {
          error: 'Stamp detection returned a malformed response',
          reason: 'parse_failed',
          ...(process.env.NODE_ENV !== 'production'
            ? { rawTextSample: text.slice(0, 400) }
            : {}),
        },
        { status: 502 },
      );
    }

    const { stamps, coordSpace, droppedCount } = normalizeDetections(parsed.value);

    if (droppedCount > 0) {
      console.warn(
        `[API /stamps/segment] Dropped ${droppedCount} detection(s) below the minimum size`,
      );
    }

    // A 200 with zero stamps means "the model looked and found none" — a real,
    // reportable outcome. It must be distinguishable from a failure, or the
    // client cannot decide between showing an empty state and showing an error.
    return NextResponse.json({
      stamps,
      count: stamps.length,
      reason: stamps.length > 0 ? 'ok' : 'no_stamps_detected',
      coordSpace,
      droppedCount,
      truncated: stamps.length >= MAX_DETECTIONS,
    });
  } catch (error) {
    console.error('[API /stamps/segment] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Stamp segmentation failed';
    return NextResponse.json(
      { error: message, reason: 'server_error' },
      { status: 500 },
    );
  }
}
