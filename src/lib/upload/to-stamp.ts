/* ──────────────────────────────────────────────────────────────────────────────
 * Assemble API responses into the app's Stamp shape.
 *
 * Extracted from src/app/upload/page.tsx, where this logic was inline inside a
 * 200-line loop body and used several `as any` casts.
 * ────────────────────────────────────────────────────────────────────────────── */

import type { Stamp } from '@/types/stamp';
import { VERIFIED_STAMPS } from '@/lib/pricing/verified-database';
import type { RawIdentification } from './identify-client';

type Condition = Stamp['identification']['condition'];
type Rarity = Stamp['identification']['rarity'];

/** Free-text condition from the model -> the app's closed condition set. */
const CONDITION_MAP: Record<string, Condition> = {
  superb: 'superb',
  'extremely fine': 'very_fine',
  'very fine': 'very_fine',
  'fine-very fine': 'very_fine',
  fine: 'fine',
  'very good': 'fine',
  good: 'poor',
  average: 'poor',
  poor: 'poor',
  mint: 'mint',
  mint_nh: 'mint_nh',
  unused: 'unused',
  used: 'used',
};

const RARITY_MAP: Record<string, Rarity> = {
  common: 'common',
  uncommon: 'uncommon',
  scarce: 'scarce',
  rare: 'rare',
  very_rare: 'very_rare',
  extremely_rare: 'extremely_rare',
  unique: 'unique',
};

export function mapCondition(value: string | null | undefined): Condition {
  if (!value) return 'unknown';
  return CONDITION_MAP[value.trim().toLowerCase()] ?? 'unknown';
}

export function mapRarity(value: string | null | undefined): Rarity {
  if (!value) return 'common';
  return RARITY_MAP[value.trim().toLowerCase()] ?? 'common';
}

/**
 * Resolve a catalog reference image for the side-by-side comparison.
 *
 * Returns null when there is no genuine match. It must NOT fall back to
 * `/mock/stamps/placeholder.jpg`: that file is a photo of one specific real
 * stamp, so using it as a generic fallback showed the user a photo of a
 * completely different stamp captioned "Catalog Reference".
 */
export function resolveReferenceImage(ident: RawIdentification): string | null {
  const scott = ident.scottNumber?.trim().toLowerCase();
  const country = ident.country?.trim().toLowerCase();

  const matched = VERIFIED_STAMPS.find(
    (s) =>
      (!!scott &&
        !!country &&
        s.scottNumber?.trim().toLowerCase() === scott &&
        s.country?.trim().toLowerCase() === country) ||
      (!!ident.matchedCatalogId && s.id === ident.matchedCatalogId),
  );

  if (matched?.referenceImageUrl) return matched.referenceImageUrl;
  // Only trust a model-supplied path if it is a local asset we control.
  if (ident.referenceImageUrl?.startsWith('/')) return ident.referenceImageUrl;
  return null;
}

export interface BuildStampArgs {
  ident: RawIdentification;
  imageDataUrl: string;
  /** Live pricing, or null when the lookup was skipped or unavailable. */
  pricing: Stamp['pricing'] | null;
  /** Disambiguates two detections that resolve to the same catalog number. */
  index: number;
  /** Stable timestamp for the whole batch. */
  now: string;
}

/**
 * Build the identified-stamp record shown in the review summary.
 *
 * The id is suffixed with `index`: two confirmed detections can identify as the
 * same Scott number (duplicate photos of one stamp), and a bare
 * `stamp-${scottNumber}` id collided and silently overwrote one with the other.
 */
export function buildIdentifiedStamp({
  ident,
  imageDataUrl,
  pricing,
  index,
  now,
}: BuildStampArgs): Partial<Stamp> {
  const fallbackValue = ident.estimatedValue?.asIs ?? 0;

  return {
    id: ident.scottNumber
      ? `stamp-${ident.scottNumber.toLowerCase()}-${index}`
      : `stamp-${now}-${index}`,
    imageUrl: imageDataUrl,
    identification: {
      country: ident.country || 'Unknown',
      year: ident.yearOfIssue ?? null,
      denomination: ident.denomination ?? null,
      scottNumber: ident.scottNumber ?? null,
      michelNumber: ident.michelNumber ?? null,
      description: ident.description || 'Identified Stamp',
      condition: mapCondition(ident.condition),
      rarity: mapRarity(ident.rarity),
      color: ident.colorVariant ?? null,
      perforation: ident.perforationGauge ?? null,
      watermark: ident.watermark ?? null,
      series: ident.series ?? null,
      confidence: ident.aiConfidence ?? 0,
      referenceImageUrl: resolveReferenceImage(ident),
      status: 'identified',
      alternatives: (ident.alternatives ?? []) as never[],
    },
    pricing:
      pricing ??
      ({
        estimatedValue: fallbackValue,
        currency: 'USD',
        confidence: ident.estimatedValue?.confidence ?? 0.5,
        sources: [],
        priceRange: {
          min: fallbackValue ? fallbackValue * 0.8 : 0,
          max: fallbackValue ? fallbackValue * 1.2 : 0,
        },
        lastUpdated: now,
        hipValue: null,
        sourceBreakdown: {
          hipstamp: null,
          ebay: null,
          delcampe: null,
          stampworld: null,
        },
      } as Stamp['pricing']),
    priceHistory: [],
    tags: ident.topicThemes ?? [],
    notes: ident.identificationNotes ?? '',
    isFavorite: false,
    purchasePrice: null,
    purchaseDate: null,
    grade: ident.gradeScore ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

/** A record for a stamp whose identification failed. Never invents a result. */
export function buildFailedStamp(args: {
  imageDataUrl: string;
  message: string;
  index: number;
  now: string;
}): Partial<Stamp> {
  return {
    id: `stamp-error-${args.now}-${args.index}`,
    imageUrl: args.imageDataUrl,
    identification: {
      country: 'Unknown',
      year: null,
      denomination: null,
      scottNumber: null,
      michelNumber: null,
      description: 'Could not identify this stamp',
      condition: 'unknown',
      rarity: 'common',
      color: null,
      perforation: null,
      watermark: null,
      series: null,
      confidence: 0,
      status: 'failed',
      referenceImageUrl: null,
    },
    pricing: null,
    priceHistory: [],
    tags: [],
    notes: args.message,
    isFavorite: false,
    purchasePrice: null,
    purchaseDate: null,
    grade: null,
    createdAt: args.now,
    updatedAt: args.now,
  };
}

/** Hydrate a partial identified stamp into a complete collection record. */
export function toFullStamp(
  partial: Partial<Stamp>,
  opts: { userId: string; thumbnailUrl: string; now: string },
): Stamp {
  const { userId, thumbnailUrl, now } = opts;
  return {
    id: partial.id || `stamp-${now}`,
    userId,
    imageUrl: partial.imageUrl || '/mock/stamps/no-image.svg',
    thumbnailUrl,
    identification: {
      country: partial.identification?.country ?? 'Unknown',
      year: partial.identification?.year ?? null,
      denomination: partial.identification?.denomination ?? null,
      scottNumber: partial.identification?.scottNumber ?? null,
      michelNumber: partial.identification?.michelNumber ?? null,
      description: partial.identification?.description ?? 'Stamp',
      condition: partial.identification?.condition ?? 'unknown',
      rarity: partial.identification?.rarity ?? 'common',
      color: partial.identification?.color ?? null,
      perforation: partial.identification?.perforation ?? null,
      watermark: partial.identification?.watermark ?? null,
      series: partial.identification?.series ?? null,
      confidence: partial.identification?.confidence ?? 0,
      // Preserve a failed status rather than laundering it into 'identified'.
      status: partial.identification?.status ?? 'identified',
      referenceImageUrl: partial.identification?.referenceImageUrl ?? null,
    },
    pricing: partial.pricing ?? null,
    priceHistory: partial.priceHistory ?? [],
    notes: partial.notes ?? '',
    tags: partial.tags ?? [],
    isFavorite: partial.isFavorite ?? false,
    purchasePrice: partial.purchasePrice ?? null,
    purchaseDate: partial.purchaseDate ?? null,
    grade: partial.grade ?? null,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  } as Stamp;
}
