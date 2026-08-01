/* ──────────────────────────────────────────────────────────────────────────────
 * Clients for POST /api/stamps/identify and POST /api/pricing/lookup.
 *
 * Extracted from src/app/upload/page.tsx. Both accept an AbortSignal so the
 * identification run can be cancelled — previously a 20-stamp batch was an
 * uninterruptible sequence of two AI round-trips each.
 * ────────────────────────────────────────────────────────────────────────────── */

import { dataUrlMimeType } from './image-pipeline';
import { getCacheDurationMs } from '@/lib/settings';

/** The identification payload as returned by the route. */
export interface RawIdentification {
  country?: string | null;
  yearOfIssue?: number | null;
  denomination?: string | null;
  scottNumber?: string | null;
  michelNumber?: string | null;
  description?: string | null;
  condition?: string | null;
  rarity?: string | null;
  colorVariant?: string | null;
  perforationGauge?: string | null;
  watermark?: string | null;
  series?: string | null;
  aiConfidence?: number | null;
  gradeScore?: number | null;
  topicThemes?: string[];
  identificationNotes?: string | null;
  matchedCatalogId?: string | null;
  referenceImageUrl?: string | null;
  alternatives?: unknown[];
  estimatedValue?: { asIs?: number; confidence?: number } | null;
}

export async function identifyStamp(
  imageDataUrl: string,
  signal?: AbortSignal,
): Promise<RawIdentification> {
  const res = await fetch('/api/stamps/identify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      imageBase64: imageDataUrl,
      mimeType: dataUrlMimeType(imageDataUrl) ?? undefined,
    }),
    signal,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) detail = body.error;
    } catch {
      /* keep statusText */
    }
    throw new Error(detail || `Identification failed (${res.status})`);
  }

  const data = await res.json();
  if (!data?.identification) {
    throw new Error('Identification returned no result');
  }
  return data.identification as RawIdentification;
}

/**
 * Whether an identification is confident enough to justify a pricing lookup.
 *
 * Searching the marketplace for "Unknown, no Scott number" still returns a
 * confident-looking price with cited listings — for a stamp the AI itself said
 * it could not read. Matches the identify prompt's own MEDIUM-confidence floor.
 */
export function isIdentified(ident: RawIdentification): boolean {
  return (
    typeof ident.aiConfidence === 'number' &&
    ident.aiConfidence >= 0.5 &&
    !!ident.country &&
    ident.country !== 'Unknown' &&
    ident.country !== 'Not a stamp'
  );
}

/** Look up live pricing. Returns null when unavailable — never a fabricated value. */
export async function lookupPricing(
  ident: RawIdentification,
  opts: { forceRefresh?: boolean; signal?: AbortSignal } = {},
): Promise<unknown | null> {
  const res = await fetch('/api/pricing/lookup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      stampDescription: ident.description,
      scottNumber: ident.scottNumber || undefined,
      country: ident.country || undefined,
      year: ident.yearOfIssue || undefined,
      condition: ident.condition || undefined,
      cacheDurationMs: getCacheDurationMs(),
      ...(opts.forceRefresh ? { forceRefresh: true } : {}),
    }),
    signal: opts.signal,
  });

  if (!res.ok) return null;
  const json = await res.json();
  return json?.pricing ?? null;
}
