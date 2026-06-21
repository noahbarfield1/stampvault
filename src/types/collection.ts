/* ─── StampVault Collection & UI Types ────────────────────────────────── */

import type { StampCondition, RarityTier, ISODateString } from './stamp';

/* ─── View ───────────────────────────────────────────────────────────── */

export type ViewMode = 'grid' | 'list' | 'masonry';

/* ─── Sort ───────────────────────────────────────────────────────────── */

export type SortField =
  | 'createdAt'
  | 'updatedAt'
  | 'estimatedValue'
  | 'country'
  | 'year'
  | 'scottNumber'
  | 'condition'
  | 'rarity'
  | 'name';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

/* ─── Filters ────────────────────────────────────────────────────────── */

export interface FilterConfig {
  search: string;
  countries: string[];
  yearRange: { min: number | null; max: number | null };
  valueRange: { min: number | null; max: number | null };
  conditions: StampCondition[];
  rarities: RarityTier[];
  tags: string[];
  favoritesOnly: boolean;
  hasPrice: boolean | null; // null = don't filter
  identificationStatus: string | null;
}

/* ─── Filter Presets ─────────────────────────────────────────────────── */

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterConfig;
  icon: string | null;
  isDefault: boolean;
  createdAt: ISODateString;
}

/* ─── Dashboard Stats ────────────────────────────────────────────────── */

export interface CollectionStats {
  totalStamps: number;
  totalValue: number;
  averageValue: number;
  highestValue: { stampId: string; value: number; title: string } | null;
  lowestValue: { stampId: string; value: number; title: string } | null;
  totalCountries: number;
  topCountries: { country: string; count: number }[];
  conditionBreakdown: { condition: StampCondition; count: number }[];
  rarityBreakdown: { rarity: RarityTier; count: number }[];
  recentlyAdded: number; // count added in last 30 days
  valueChange30d: number; // percentage change
  priceHistoryAggregate: { date: string; totalValue: number }[];
}
