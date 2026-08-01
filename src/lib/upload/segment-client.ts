/* ──────────────────────────────────────────────────────────────────────────────
 * Client for POST /api/stamps/segment.
 *
 * Returns a discriminated union rather than throwing, so the UI is forced to
 * handle each failure mode explicitly. The previous code caught every error
 * into a single `catch` that substituted fabricated demo boxes — described by
 * matching the FILENAME against the catalog — and logged to console only. On a
 * phone the console is invisible, so a 413, a 500 and a timeout all looked
 * identical to a successful detection of stamps the user does not own.
 * ────────────────────────────────────────────────────────────────────────────── */

import type { BoundingBox } from '@/types/upload';
import { toBoundingBox } from '@/types/upload';
import {
  dataUrlMimeType,
  dataUrlByteLength,
  MAX_UPLOAD_BYTES,
} from './image-pipeline';

export interface SegmentedStamp {
  boundingBox: BoundingBox;
  description: string;
  confidence: number;
}

export type SegmentOutcome =
  /** The model ran and found at least one stamp. */
  | { kind: 'ok'; stamps: SegmentedStamp[]; truncated: boolean }
  /** The model ran, understood the image, and found nothing. A real answer. */
  | { kind: 'no_stamps' }
  /** The payload exceeded the platform body cap before it left the browser. */
  | { kind: 'payload_too_large'; bytes: number }
  /** The model failed: empty response, unparseable output, or upstream error. */
  | { kind: 'ai_unavailable'; message: string }
  /** The request never completed: offline, DNS, aborted. */
  | { kind: 'network'; message: string };

interface SegmentResponse {
  stamps?: {
    boundingBox: { x1: number; y1: number; x2: number; y2: number };
    description: string;
    confidence: number;
  }[];
  count?: number;
  reason?: string;
  truncated?: boolean;
  error?: string;
}

/** Human-readable, actionable text for each failure. Used directly in the UI. */
export function describeSegmentFailure(outcome: SegmentOutcome): string {
  switch (outcome.kind) {
    case 'payload_too_large':
      return `That photo is too large to send (${(outcome.bytes / 1_000_000).toFixed(1)}MB). Try taking it again at a lower resolution.`;
    case 'ai_unavailable':
      return `Stamp detection is unavailable right now. ${outcome.message}`;
    case 'network':
      return `Could not reach stamp detection. Check your connection and try again.`;
    case 'no_stamps':
      return 'No stamps were found in this photo. Try better lighting, a flatter angle, or draw the box yourself.';
    default:
      return '';
  }
}

export async function segmentImage(
  imageDataUrl: string,
  signal?: AbortSignal,
): Promise<SegmentOutcome> {
  const bytes = dataUrlByteLength(imageDataUrl);
  if (bytes > MAX_UPLOAD_BYTES) {
    // Caught here rather than letting the platform return an opaque 413 with
    // no JSON body, which the client could not distinguish from anything else.
    return { kind: 'payload_too_large', bytes };
  }

  let res: Response;
  try {
    res = await fetch('/api/stamps/segment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        imageBase64: imageDataUrl,
        mimeType: dataUrlMimeType(imageDataUrl) ?? undefined,
      }),
      signal,
    });
  } catch (err) {
    return {
      kind: 'network',
      message: err instanceof Error ? err.message : 'Request failed',
    };
  }

  if (res.status === 413) {
    return { kind: 'payload_too_large', bytes };
  }

  let json: SegmentResponse | null = null;
  try {
    json = (await res.json()) as SegmentResponse;
  } catch {
    json = null;
  }

  if (!res.ok || !json) {
    return {
      kind: 'ai_unavailable',
      message: json?.error ?? `Server responded ${res.status}.`,
    };
  }

  const raw = json.stamps ?? [];
  if (raw.length === 0) {
    // The route distinguishes these: a 200 with reason 'no_stamps_detected'
    // means the model looked and found none, which is a real answer and not a
    // failure. Anything else reaching here is a failure wearing a 200.
    return json.reason === 'no_stamps_detected'
      ? { kind: 'no_stamps' }
      : {
          kind: 'ai_unavailable',
          message: json.error ?? 'Detection returned no usable result.',
        };
  }

  return {
    kind: 'ok',
    truncated: json.truncated === true,
    stamps: raw.map((s) => ({
      boundingBox: toBoundingBox(s.boundingBox),
      description: s.description,
      confidence: s.confidence,
    })),
  };
}
