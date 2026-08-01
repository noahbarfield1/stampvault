import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Stamp } from '@/types/stamp';
import { initialStamps } from '@/lib/stamps-data';
import type {
  CollectionStats,
  FilterConfig,
  SortConfig,
  ViewMode,
  FilterPreset,
} from '@/types/collection';

interface StampsState {
  /* Data */
  stamps: Stamp[];
  filteredStamps: Stamp[];
  selectedStampId: string | null;
  collectionStats: CollectionStats | null;

  /* Loading */
  isLoading: boolean;
  isStatsLoading: boolean;

  /* View */
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  /* Sort */
  sortConfig: SortConfig;
  setSortConfig: (config: SortConfig) => void;
  sort: SortConfig;
  setSort: (config: SortConfig) => void;

  /* Filters */
  filters: FilterConfig;
  setFilters: (filters: Partial<FilterConfig>) => void;
  resetFilters: () => void;

  /* Filter Presets */
  filterPresets: FilterPreset[];
  activePresetId: string | null;
  applyPreset: (id: string) => void;
  savePreset: (name: string) => void;
  deletePreset: (id: string) => void;

  /* Actions */
  setStamps: (stamps: Stamp[]) => void;
  addStamp: (stamp: Stamp) => void;
  updateStamp: (id: string, updates: Partial<Stamp>) => void;
  removeStamp: (id: string) => void;
  setSelectedStamp: (id: string | null) => void;
  setCollectionStats: (stats: CollectionStats) => void;
  setIsLoading: (loading: boolean) => void;
  setIsStatsLoading: (loading: boolean) => void;
}

const defaultFilters: FilterConfig = {
  search: '',
  countries: [],
  yearRange: { min: null, max: null },
  valueRange: { min: null, max: null },
  conditions: [],
  rarities: [],
  tags: [],
  favoritesOnly: false,
  hasPrice: null,
  identificationStatus: null,
};

const defaultSort: SortConfig = {
  field: 'createdAt',
  direction: 'desc',
};

const defaultPresets: FilterPreset[] = [
  {
    id: 'preset-1',
    name: 'US Classics',
    filters: {
      ...defaultFilters,
      countries: ['United States'],
      yearRange: { min: 1840, max: 1900 },
    },
    icon: '🇺🇸',
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'preset-2',
    name: 'Rare Errors',
    filters: {
      ...defaultFilters,
      identificationStatus: 'identified',
      rarities: ['rare', 'very_rare', 'extremely_rare'],
    },
    icon: '⚠️',
    isDefault: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'preset-3',
    name: 'Favorites Only',
    filters: {
      ...defaultFilters,
      favoritesOnly: true,
    },
    icon: '⭐️',
    isDefault: false,
    createdAt: new Date().toISOString(),
  },
];

function filterAndSortStamps(
  stamps: Stamp[],
  filters: FilterConfig,
  sort: SortConfig
): Stamp[] {
  let result = [...stamps];

  // 1. Search
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (s) =>
        s.identification.country?.toLowerCase().includes(q) ||
        s.identification.description?.toLowerCase().includes(q) ||
        s.identification.denomination?.toLowerCase().includes(q) ||
        s.identification.scottNumber?.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  // 2. Countries
  if (filters.countries && filters.countries.length > 0) {
    result = result.filter((s) =>
      filters.countries.includes(s.identification.country)
    );
  }

  // 3. Year range
  if (filters.yearRange.min !== null) {
    result = result.filter(
      (s) => s.identification.year !== null && s.identification.year >= filters.yearRange.min!
    );
  }
  if (filters.yearRange.max !== null) {
    result = result.filter(
      (s) => s.identification.year !== null && s.identification.year <= filters.yearRange.max!
    );
  }

  // 4. Value range
  if (filters.valueRange.min !== null) {
    result = result.filter(
      (s) => s.pricing !== null && s.pricing.estimatedValue >= filters.valueRange.min!
    );
  }
  if (filters.valueRange.max !== null) {
    result = result.filter(
      (s) => s.pricing !== null && s.pricing.estimatedValue <= filters.valueRange.max!
    );
  }

  // 5. Conditions
  if (filters.conditions && filters.conditions.length > 0) {
    result = result.filter((s) =>
      filters.conditions.includes(s.identification.condition)
    );
  }

  // 6. Rarities
  if (filters.rarities && filters.rarities.length > 0) {
    result = result.filter((s) =>
      filters.rarities.includes(s.identification.rarity)
    );
  }

  // 7. Tags
  if (filters.tags && filters.tags.length > 0) {
    result = result.filter((s) =>
      filters.tags.some((t) => s.tags.includes(t))
    );
  }

  // 8. Favorites Only
  if (filters.favoritesOnly) {
    result = result.filter((s) => s.isFavorite);
  }

  // 9. Has Price
  if (filters.hasPrice !== null) {
    if (filters.hasPrice) {
      result = result.filter((s) => s.pricing !== null && s.pricing.estimatedValue > 0);
    } else {
      result = result.filter((s) => s.pricing === null || s.pricing.estimatedValue === 0);
    }
  }

  // 10. Identification Status
  if (filters.identificationStatus !== null) {
    result = result.filter(
      (s) => s.identification.status === filters.identificationStatus
    );
  }

  // Sort
  result.sort((a, b) => {
    let valA: any = null;
    let valB: any = null;

    if (sort.field === 'createdAt' || sort.field === 'updatedAt') {
      valA = a[sort.field];
      valB = b[sort.field];
    } else if (sort.field === 'estimatedValue') {
      valA = a.pricing?.estimatedValue ?? 0;
      valB = b.pricing?.estimatedValue ?? 0;
    } else {
      const fieldName = sort.field === 'year' ? 'year' : sort.field;
      valA = (a.identification as any)[fieldName];
      valB = (b.identification as any)[fieldName];
    }

    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sort.direction === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }

    return sort.direction === 'asc' ? valA - valB : valB - valA;
  });

  return result;
}

export const useStampsStore = create<StampsState>()(
  devtools(
    persist(
      (set) => ({
        /* Data */
        stamps: initialStamps,
        filteredStamps: initialStamps,
        selectedStampId: null,
        collectionStats: null,

        /* Loading */
        isLoading: false,
        isStatsLoading: false,

        /* View */
        viewMode: 'grid',
        setViewMode: (mode) => set({ viewMode: mode }),

        /* Sort */
        sortConfig: defaultSort,
        setSortConfig: (config) =>
          set((state) => ({
            sortConfig: config,
            sort: config,
            filteredStamps: filterAndSortStamps(state.stamps, state.filters, config),
          })),
        sort: defaultSort,
        setSort: (config) =>
          set((state) => ({
            sortConfig: config,
            sort: config,
            filteredStamps: filterAndSortStamps(state.stamps, state.filters, config),
          })),

  /* Filters */
  filters: defaultFilters,
  setFilters: (updates) =>
    set((state) => {
      const newFilters = { ...state.filters, ...updates };
      return {
        filters: newFilters,
        activePresetId: null, // Clear active preset when manual filter applied
        filteredStamps: filterAndSortStamps(
          state.stamps,
          newFilters,
          state.sortConfig
        ),
      };
    }),
  resetFilters: () =>
    set((state) => ({
      filters: defaultFilters,
      activePresetId: null,
      filteredStamps: filterAndSortStamps(
        state.stamps,
        defaultFilters,
        state.sortConfig
      ),
    })),

  /* Filter Presets */
  filterPresets: defaultPresets,
  activePresetId: null,
  applyPreset: (id) =>
    set((state) => {
      const preset = state.filterPresets.find((p) => p.id === id);
      if (!preset) return {};
      return {
        activePresetId: id,
        filters: preset.filters,
        filteredStamps: filterAndSortStamps(
          state.stamps,
          preset.filters,
          state.sortConfig
        ),
      };
    }),
  savePreset: (name) =>
    set((state) => {
      const newPreset: FilterPreset = {
        id: `preset-${Date.now()}`,
        name,
        filters: state.filters,
        icon: '📁',
        isDefault: false,
        createdAt: new Date().toISOString(),
      };
      const newPresets = [...state.filterPresets, newPreset];
      return {
        filterPresets: newPresets,
        activePresetId: newPreset.id,
      };
    }),
  deletePreset: (id) =>
    set((state) => {
      const newPresets = state.filterPresets.filter((p) => p.id !== id);
      const activePresetId = state.activePresetId === id ? null : state.activePresetId;
      return {
        filterPresets: newPresets,
        activePresetId,
      };
    }),

  /* Actions */
  setStamps: (stamps) =>
    set((state) => ({
      stamps,
      filteredStamps: filterAndSortStamps(stamps, state.filters, state.sortConfig),
    })),
  addStamp: (stamp) =>
    set((state) => {
      // Upsert by id: importing a previously-exported collection (or any
      // other re-add of an existing stamp) would otherwise append a second
      // entry with the same id, producing duplicate React keys and two
      // divergent copies of the same stamp in the collection.
      const exists = state.stamps.some((s) => s.id === stamp.id);
      const newStamps = exists
        ? state.stamps.map((s) => (s.id === stamp.id ? stamp : s))
        : [stamp, ...state.stamps];
      return {
        stamps: newStamps,
        filteredStamps: filterAndSortStamps(
          newStamps,
          state.filters,
          state.sortConfig
        ),
      };
    }),
  updateStamp: (id, updates) =>
    set((state) => {
      const newStamps = state.stamps.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      );
      return {
        stamps: newStamps,
        filteredStamps: filterAndSortStamps(
          newStamps,
          state.filters,
          state.sortConfig
        ),
      };
    }),
  removeStamp: (id) =>
    set((state) => {
      const newStamps = state.stamps.filter((s) => s.id !== id);
      return {
        stamps: newStamps,
        filteredStamps: filterAndSortStamps(
          newStamps,
          state.filters,
          state.sortConfig
        ),
      };
    }),
  setSelectedStamp: (id) => set({ selectedStampId: id }),
  setCollectionStats: (stats) => set({ collectionStats: stats }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsStatsLoading: (loading) => set({ isStatsLoading: loading }),
      }),
      {
        name: 'stampvault-stamps',
      }
    ),
    { name: 'StampVault:stamps' }
  )
);
