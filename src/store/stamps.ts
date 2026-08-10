import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Stamp } from '@/types/stamp';
import { safeThumbnail } from '@/lib/storage/persist-guards';

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


/* ── Cloud mirroring ──────────────────────────────────────────────────────
 *  Imported lazily so the Firebase SDK stays out of the initial bundle and
 *  so the sync store can import types from here without a cycle. Both are
 *  no-ops when sync is unconfigured or signed out.
 * ─────────────────────────────────────────────────────────────────────── */

async function mirrorUp(stamp: Stamp): Promise<void> {
  try {
    const { useSyncStore } = await import('./sync');
    await useSyncStore.getState().pushOne(stamp);
  } catch {
    /* sync is optional; never let it break a local write */
  }
}

async function mirrorDelete(stampId: string): Promise<void> {
  try {
    const { useSyncStore } = await import('./sync');
    await useSyncStore.getState().removeOne(stampId);
  } catch {
    /* as above */
  }
}


/* ── Image hydration ──────────────────────────────────────────────────────
 *  Full-resolution crops are kept out of localStorage (see partialize below)
 *  and restored from IndexedDB after rehydrate.
 * ─────────────────────────────────────────────────────────────────────── */

async function hydrateImages(): Promise<void> {
  try {
    const { getStampImages } = await import('@/lib/storage/image-store');
    const state = useStampsStore.getState();
    const missing = state.stamps.filter((s) => !s.imageUrl).map((s) => s.id);
    if (missing.length === 0) return;
    const images = await getStampImages(missing);
    if (images.size === 0) return;
    useStampsStore.setState((prev) => {
      const stamps = prev.stamps.map((s) =>
        images.has(s.id) ? { ...s, imageUrl: images.get(s.id)! } : s,
      );
      return {
        stamps,
        filteredStamps: filterAndSortStamps(stamps, prev.filters, prev.sortConfig),
      };
    });
  } catch {
    /* thumbnails still render; the full crop simply stays unavailable */
  }
}


async function storeImage(stamp: Stamp): Promise<void> {
  if (!stamp.imageUrl?.startsWith('data:')) return;
  try {
    const { putStampImage } = await import('@/lib/storage/image-store');
    await putStampImage(stamp.id, stamp.imageUrl);
  } catch (err) {
    // Loud, not silent. The whole point of moving off localStorage is that a
    // storage failure must be visible rather than quietly losing the image.
    console.error('[stamps] could not store image for', stamp.id, err);
  }
}

async function dropImage(stampId: string): Promise<void> {
  try {
    const { deleteStampImage } = await import('@/lib/storage/image-store');
    await deleteStampImage(stampId);
  } catch {
    /* an orphaned image is harmless */
  }
}

export const useStampsStore = create<StampsState>()(
  devtools(
    persist(
      (set) => ({
        /* Data */
        // A new collection starts EMPTY. It used to start with three sample
        // stamps, so anyone opening the app for the first time saw a
        // collection and a total value that were not theirs — and signing in
        // would have pushed them to their own cloud account as real records.
        // The samples now live in @/lib/demo-data behind an explicit action.
        stamps: [],
        filteredStamps: [],
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
      // Mirror to the cloud when signed in. Fire-and-forget on purpose: the
      // stamp is already saved locally, so a network failure must not block
      // or fail the save. Failures queue for the next full sync.
      // Persist the full crop to IndexedDB, not localStorage — see the
      // partialize comment below for why.
      void storeImage(stamp);
      void mirrorUp(stamp);
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
      // Always advance updatedAt: it is what sync uses to decide which copy
      // wins, so an edit that does not move it can be silently reverted by a
      // stale copy on another device.
      const stamped = { ...updates, updatedAt: new Date().toISOString() };
      const newStamps = state.stamps.map((s) =>
        s.id === id ? { ...s, ...stamped } : s
      );
      const changed = newStamps.find((s) => s.id === id);
      if (changed) void mirrorUp(changed);
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
      // A delete is explicit, so propagate it. Sync's merge deliberately does
      // NOT treat 'missing on one side' as a delete, so this is the only way a
      // stamp leaves the cloud.
      void mirrorDelete(id);
      void dropImage(id);
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
        version: 1,

        /*
         * Previously absent, so the ENTIRE state was written to localStorage —
         * including `filteredStamps`, which is the same records as `stamps`.
         * Every full-resolution base64 crop was therefore stored TWICE. At
         * ~110-270KB per crop that is ~250-550KB per stamp against Safari's
         * ~5MB cap, so the quota blew after roughly a dozen stamps — and
         * zustand's persist middleware swallows QuotaExceededError, so saves
         * failed silently.
         *
         * Now: metadata plus a ~20KB thumbnail only. Full crops live in
         * IndexedDB (see lib/storage/image-store), and filteredStamps /
         * collectionStats are recomputed on rehydrate rather than stored.
         */
        partialize: (state) => ({
          // safeThumbnail is the backstop: the store owns the ~5MB constraint,
          // so the store enforces it. An upstream bug once handed us a full
          // 80-200KB crop as a "thumbnail" and it was persisted verbatim,
          // exhausting the quota after a handful of stamps.
          stamps: state.stamps.map((stamp) => ({
            ...stamp,
            imageUrl: '',
            thumbnailUrl: safeThumbnail(stamp.thumbnailUrl),
          })),
          viewMode: state.viewMode,
          sortConfig: state.sortConfig,
          sort: state.sort,
          filters: state.filters,
          filterPresets: state.filterPresets,
          activePresetId: state.activePresetId,
        }),

        onRehydrateStorage: () => (state) => {
          if (!state) return;
          // Derived, never persisted.
          state.filteredStamps = filterAndSortStamps(
            state.stamps,
            state.filters,
            state.sortConfig,
          );
          // Full images come back asynchronously from IndexedDB; the grid
          // renders from thumbnailUrl in the meantime.
          void hydrateImages();
        },
      }
    ),
    { name: 'StampVault:stamps' }
  )
);
