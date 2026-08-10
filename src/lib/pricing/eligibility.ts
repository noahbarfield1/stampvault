/* ──────────────────────────────────────────────────────────────────────────────
 * Is this identification good enough to price, and if not, why not?
 *
 * ONE source of truth, deliberately. The upload wizard and the Price Tracker
 * used to answer this question differently: upload required
 * `aiConfidence >= 0.5`, the Price Tracker checked only that the country was
 * known. So the same stamp was priceable on one screen and not the other, and
 * upload skipped it in silence — reported 2026-08-09 as "only 1 stamp loaded a
 * price" when every stamp had in fact been identified correctly.
 *
 * The gate itself is worth keeping. Searching the marketplace for a stamp the
 * model could not read still returns confident-looking prices — for a different
 * stamp. What was wrong was WHICH signal it gated on, and that it said nothing.
 *
 * A catalogue number is a precise query, and `filterRelevantListings` discards
 * every result whose title does not carry it. So once a Scott number is in
 * hand, overall identification confidence stops being the limiting factor —
 * that is the one case the old rule got wrong, and the common one, since a
 * heavily cancelled stamp reads as low-confidence while its catalogue number is
 * perfectly legible.
 *
 * Callers must surface `reason` rather than rendering a bare em dash. "We did
 * not check" and "nothing is for sale" are different claims, and only one of
 * them is true when this returns false.
 * ────────────────────────────────────────────────────────────────────────────── */

/** The confidence floor, applied only when no catalogue number is available. */
export const MIN_CONFIDENCE_WITHOUT_CATALOGUE = 0.5;

export interface IdentificationLike {
  country?: string | null;
  scottNumber?: string | null;
  aiConfidence?: number | null;
}

export interface PricingEligibility {
  /** True when a lookup is worth spending a request on. */
  eligible: boolean;
  /** User-facing explanation when `eligible` is false; null when it is true. */
  reason: string | null;
}

/** Countries the identify route emits when it could not read the stamp. */
const UNREADABLE_COUNTRIES = new Set(['Unknown', 'Not a stamp']);

export function pricingEligibility(ident: IdentificationLike): PricingEligibility {
  const country = ident.country?.trim();
  if (!country || UNREADABLE_COUNTRIES.has(country)) {
    return {
      eligible: false,
      reason: 'Not priced — the country could not be identified.',
    };
  }

  // A catalogue number carries the whole query, so confidence is not the
  // binding constraint once we have one.
  const scott = ident.scottNumber?.trim();
  if (scott) return { eligible: true, reason: null };

  const confidence = ident.aiConfidence;
  if (typeof confidence !== 'number' || confidence < MIN_CONFIDENCE_WITHOUT_CATALOGUE) {
    return {
      eligible: false,
      reason:
        'Not priced — no catalogue number was found and identification confidence was too low to search on safely.',
    };
  }

  return { eligible: true, reason: null };
}
