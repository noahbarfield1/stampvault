/* ─── StampVault Core Domain Types ────────────────────────────────────── */

/** ISO-8601 date string */
export type ISODateString = string;

/** Stamp condition grading scale */
export type StampCondition =
  | 'mint'
  | 'mint_nh'
  | 'unused'
  | 'used'
  | 'fine'
  | 'very_fine'
  | 'superb'
  | 'poor'
  | 'unknown';

/** Stamp rarity tier */
export type RarityTier =
  | 'common'
  | 'uncommon'
  | 'scarce'
  | 'rare'
  | 'very_rare'
  | 'extremely_rare'
  | 'unique';

/** Where a price data point came from */
export type PriceSourcePlatform =
  | 'hipstamp'
  | 'ebay'
  | 'delcampe'
  | 'stampworld'
  | 'colnect'
  | 'manual';

/** Status of AI identification */
export type IdentificationStatus =
  | 'pending'
  | 'identified'
  | 'partial'
  | 'failed'
  | 'manual';

/* ─── Price Source ────────────────────────────────────────────────────── */

export interface PriceSource {
  platform: PriceSourcePlatform;
  price: number;
  currency: string;
  url: string | null;
  title: string;
  condition: StampCondition | null;
  soldDate: ISODateString | null;
  listingType: 'sold' | 'active' | 'estimate';
  fetchedAt: ISODateString;
}

/* ─── Price Data (aggregated result from engine) ─────────────────────── */

export interface PriceData {
  estimatedValue: number;
  currency: string;
  confidence: number; // 0–1 scale
  sources: PriceSource[];
  priceRange: { min: number; max: number };
  lastUpdated: ISODateString;
  hipValue: number | null;
  sourceBreakdown: {
    hipstamp: { avg: number; count: number } | null;
    ebay: { avg: number; min: number; max: number; count: number } | null;
    delcampe: { avg: number; count: number } | null;
    stampworld: { avg: number; count: number } | null;
  };
}

/* ─── Price History Entry ────────────────────────────────────────────── */

export interface PriceHistoryEntry {
  date: ISODateString;
  value: number;
  sources: number;
}

/* ─── AI Identification Result ───────────────────────────────────────── */

export interface StampIdentification {
  country: string;
  year: number | null;
  denomination: string | null;
  scottNumber: string | null;
  michelNumber: string | null;
  description: string;
  condition: StampCondition;
  rarity: RarityTier;
  color: string | null;
  perforation: string | null;
  watermark: string | null;
  series: string | null;
  confidence: number;
  status: IdentificationStatus;
  referenceImageUrl?: string | null;
}

/* ─── Stamp (primary domain entity) ──────────────────────────────────── */

export interface Stamp {
  id: string;
  userId: string;
  imageUrl: string;
  thumbnailUrl: string | null;

  /* identification */
  identification: StampIdentification;

  /* pricing */
  pricing: PriceData | null;
  priceHistory: PriceHistoryEntry[];

  /* user metadata */
  notes: string;
  tags: string[];
  isFavorite: boolean;
  purchasePrice: number | null;
  purchaseDate: ISODateString | null;
  grade: number | null; // 0–100 numeric grade

  /* timestamps */
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/* ─── Detected Stamp (segmentation result) ───────────────────────────── */

export interface DetectedStamp {
  boundingBox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  description: string;
  confidence: number;
}

/* ─── Upload Batch ───────────────────────────────────────────────────── */

export type UploadItemStatus =
  | 'queued'
  | 'uploading'
  | 'identifying'
  | 'pricing'
  | 'complete'
  | 'error';

export interface UploadItem {
  id: string;
  file: File | null;
  previewUrl: string;
  status: UploadItemStatus;
  progress: number; // 0–100
  stamp: Stamp | null;
  error: string | null;
}

export interface UploadBatch {
  id: string;
  items: UploadItem[];
  totalItems: number;
  completedItems: number;
  failedItems: number;
  status: 'idle' | 'processing' | 'complete' | 'error';
  startedAt: ISODateString | null;
  completedAt: ISODateString | null;
}
