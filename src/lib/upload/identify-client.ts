/* ──────────────────────────────────────────────────────────────────────────────
 * Clients for POST /api/stamps/identify and POST /api/pricing/lookup.
 *
 * Extracted from src/app/upload/page.tsx. Both accept an AbortSignal so the
 * identification run can be cancelled — previously a 20-stamp batch was an
 * uninterruptible sequence of two AI round-trips each.
 * ────────────────────────────────────────────────────────────────────────────── */

import { dataUrlMimeType } from './image-pipeline';
import { getCacheDurationMs } from '@/lib/settings';
import { pricingEligibility } from '@/lib/pricing/eligibility';

export { pricingEligibility } from '@/lib/pricing/eligibility';

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
 * Delegates to `pricingEligibility` so this screen and the Price Tracker cannot
 * drift apart again — they previously applied different rules, and upload's was
 * the stricter one, silently skipping stamps the Price Tracker would have
 * priced happily. Prefer `pricingEligibility` directly when you need the reason.
 */
export function isIdentified(ident: RawIdentification): boolean {
  return pricingEligibility(ident).eligible;
}

/** Look up live pricing. Returns null when unavailable — never a fabricated value. */
export async function lookupPricing(
  ident: RawIdentification,
  opts: { forceRefresh?: boolean; signal?: AbortSignal } = {},
): Promise<{ pricing: unknown | null; unavailableReason: string | null }> {
  let res: Response;
  try {
    res = await fetch('/api/pricing/lookup', {
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
  } catch (err) {
    // Cancellation is the user's doing — let the caller's loop see it and stop.
    if (opts.signal?.aborted) throw err;
    // Anything else is a transport failure, most often a phone changing
    // networks mid-batch. It must NOT propagate: the caller treats a throw here
    // as "this stamp failed", which would discard a good identification over a
    // dropped pricing request.
    return {
      pricing: null,
      unavailableReason:
        'Price lookup could not reach the network. The stamp is saved — retry from the Price Tracker.',
    };
  }

  // A failed request is not evidence that nothing is for sale. Returning null
  // for both fields here made a 500, a rate-limit and a genuinely unlisted
  // stamp render identically, as a bare em dash.
  if (!res.ok) {
    return {
      pricing: null,
      unavailableReason:
        res.status === 429
          ? 'Price lookups are being rate limited. The stamp is saved — retry from the Price Tracker.'
          : `Price lookup failed (${res.status}). The stamp is saved — retry from the Price Tracker.`,
    };
  }

  const json = await res.json();
  return {
    pricing: json?.pricing ?? null,
    // Set when the lookup failed for an infrastructure reason (out of credits,
    // bad key) rather than genuinely finding nothing. The difference matters:
    // one means "we could not check", the other means "nothing is for sale".
    unavailableReason: (json?.unavailableReason as string | undefined) ?? null,
  };
}
