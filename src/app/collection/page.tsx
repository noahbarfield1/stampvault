'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useStampsStore } from '@/store/stamps';
import { useUIStore } from '@/store/ui';
import type { SortConfig, SortField } from '@/types/collection';
import type { Stamp } from '@/types/stamp';
import FilterBar from '@/components/collection/FilterBar';
import FilterPresetBar from '@/components/collection/FilterPresetBar';
import StampGrid from '@/components/collection/StampGrid';
import StampTable from '@/components/collection/StampTable';
import styles from './collection.module.css';

/* ── Sort option labels ────────────────────────────────────────────────── */

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'createdAt', label: 'Date Added' },
  { field: 'estimatedValue', label: 'Value' },
  { field: 'country', label: 'Country' },
  { field: 'year', label: 'Year' },
  { field: 'scottNumber', label: 'Scott Number' },
  { field: 'condition', label: 'Condition' },
  { field: 'rarity', label: 'Rarity' },
  { field: 'name', label: 'Name' },
];

export default function CollectionPage() {
  const router = useRouter();

  const {
    filteredStamps,
    viewMode,
    setViewMode,
    sort,
    setSort,
    filters,
    setFilters,
    resetFilters,
    filterPresets,
    activePresetId,
    applyPreset,
    savePreset,
    deletePreset,
    isLoading,
  } = useStampsStore();

  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  /* Close sort menu on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleStampClick = useCallback(
    (stamp: Stamp) => {
      router.push(`/collection/${stamp.id}`);
    },
    [router]
  );

  const handleSortSelect = useCallback(
    (field: SortField) => {
      if (sort.field === field) {
        setSort({
          field,
          direction: sort.direction === 'asc' ? 'desc' : 'asc',
        });
      } else {
        setSort({ field, direction: 'desc' });
      }
      setSortMenuOpen(false);
    },
    [sort, setSort]
  );

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.field === sort.field)?.label ?? 'Sort';

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Collection</h1>
          <p className={styles.subtitle}>
            {filteredStamps.length} stamp
            {filteredStamps.length !== 1 ? 's' : ''}
            {filters.search && ` matching "${filters.search}"`}
          </p>
        </div>

        <div className={styles.controls}>
          {/* View Toggle */}
          <div className={styles.viewToggle}>
            <button
              className={
                viewMode === 'grid'
                  ? styles.viewBtnActive
                  : styles.viewBtn
              }
              onClick={() => setViewMode('grid')}
              title="Grid view"
              type="button"
              aria-label="Grid view"
            >
              ▦
            </button>
            <button
              className={
                viewMode === 'list'
                  ? styles.viewBtnActive
                  : styles.viewBtn
              }
              onClick={() => setViewMode('list')}
              title="Table view"
              type="button"
              aria-label="Table view"
            >
              ☰
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className={styles.sortDropdown} ref={sortRef}>
            <button
              className={styles.sortBtn}
              onClick={() => setSortMenuOpen(!sortMenuOpen)}
              type="button"
            >
              {currentSortLabel}
              <span>{sort.direction === 'asc' ? '↑' : '↓'}</span>
            </button>

            <AnimatePresence>
              {sortMenuOpen && (
                <motion.div
                  className={styles.sortMenu}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.field}
                      className={
                        sort.field === option.field
                          ? styles.sortMenuItemActive
                          : styles.sortMenuItem
                      }
                      onClick={() => handleSortSelect(option.field)}
                      type="button"
                    >
                      {option.label}
                      {sort.field === option.field && (
                        <span className={styles.sortMenuItemCheck}>✓</span>
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onSavePreset={savePreset}
        onClearAll={resetFilters}
      />

      {/* Filter Presets */}
      <FilterPresetBar
        presets={filterPresets}
        activePresetId={activePresetId}
        onApplyPreset={applyPreset}
        onDeletePreset={deletePreset}
      />

      {/* Content */}
      {viewMode === 'grid' || viewMode === 'masonry' ? (
        <StampGrid
          stamps={filteredStamps}
          onStampClick={handleStampClick}
          isLoading={isLoading}
        />
      ) : (
        <StampTable
          stamps={filteredStamps}
          onStampClick={handleStampClick}
          sort={sort}
          onSort={setSort}
        />
      )}
    </div>
  );
}
