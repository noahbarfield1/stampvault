'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FilterConfig } from '@/types/collection';
import type { StampCondition, RarityTier } from '@/types/stamp';
import styles from './FilterBar.module.css';

/* ── Filter type definitions ───────────────────────────────────────────── */

type FilterType =
  | 'country'
  | 'year'
  | 'condition'
  | 'value'
  | 'topic'
  | 'printing'
  | 'era'
  | 'error'
  | 'tags';

interface FilterTypeOption {
  type: FilterType;
  label: string;
  icon: string;
}

const FILTER_OPTIONS: FilterTypeOption[] = [
  { type: 'country', label: 'Country', icon: '🌍' },
  { type: 'year', label: 'Year', icon: '📅' },
  { type: 'condition', label: 'Condition', icon: '✨' },
  { type: 'value', label: 'Value', icon: '💰' },
  { type: 'topic', label: 'Topic', icon: '🏷️' },
  { type: 'printing', label: 'Printing', icon: '🖨️' },
  { type: 'era', label: 'Era', icon: '🕰️' },
  { type: 'error', label: 'Error Stamps', icon: '⚠️' },
  { type: 'tags', label: 'Tags', icon: '🔖' },
];

const CONDITIONS: { value: StampCondition; label: string }[] = [
  { value: 'superb', label: 'Superb' },
  { value: 'very_fine', label: 'Very Fine' },
  { value: 'fine', label: 'Fine' },
  { value: 'mint_nh', label: 'Mint NH' },
  { value: 'mint', label: 'Mint' },
  { value: 'unused', label: 'Unused' },
  { value: 'used', label: 'Used' },
  { value: 'poor', label: 'Poor' },
];

const ERAS: { value: string; label: string; min: number; max: number }[] = [
  { value: 'classic', label: 'Classic (pre-1900)', min: 0, max: 1899 },
  { value: 'early-20th', label: 'Early 20th Century', min: 1900, max: 1945 },
  { value: 'mid-20th', label: 'Mid 20th Century', min: 1946, max: 1975 },
  { value: 'modern', label: 'Modern (1976+)', min: 1976, max: 2030 },
];

interface ActiveFilter {
  id: string;
  type: FilterType;
  value: string;
}

/* ── Props ─────────────────────────────────────────────────────────────── */

interface FilterBarProps {
  filters: FilterConfig;
  onFiltersChange: (filters: Partial<FilterConfig>) => void;
  onSavePreset: (name: string) => void;
  onClearAll: () => void;
}

export default function FilterBar({
  filters,
  onFiltersChange,
  onSavePreset,
  onClearAll,
}: FilterBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* Close dropdown on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* Sync active filters from FilterConfig on mount */
  useEffect(() => {
    const initial: ActiveFilter[] = [];
    if (filters.countries.length > 0) {
      filters.countries.forEach((c) =>
        initial.push({ id: `country-${c}`, type: 'country', value: c })
      );
    }
    if (filters.yearRange.min !== null || filters.yearRange.max !== null) {
      initial.push({
        id: 'year-range',
        type: 'year',
        value: `${filters.yearRange.min ?? ''}–${filters.yearRange.max ?? ''}`,
      });
    }
    if (filters.conditions.length > 0) {
      filters.conditions.forEach((c) =>
        initial.push({ id: `condition-${c}`, type: 'condition', value: c })
      );
    }
    if (filters.valueRange.min !== null || filters.valueRange.max !== null) {
      initial.push({
        id: 'value-range',
        type: 'value',
        value: `${filters.valueRange.min ?? ''}–${filters.valueRange.max ?? ''}`,
      });
    }
    if (filters.tags.length > 0) {
      filters.tags.forEach((t) =>
        initial.push({ id: `tags-${t}`, type: 'tags', value: t })
      );
    }
    if (initial.length > 0) {
      setActiveFilters(initial);
    }
    // Only sync on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFilter = useCallback(
    (type: FilterType) => {
      const id = `${type}-${Date.now()}`;
      let defaultValue = '';

      switch (type) {
        case 'condition':
          defaultValue = 'very_fine';
          onFiltersChange({
            conditions: [...filters.conditions, 'very_fine' as StampCondition],
          });
          break;
        case 'error':
          defaultValue = 'error';
          onFiltersChange({ tags: [...filters.tags, 'error'] });
          break;
        case 'era':
          defaultValue = 'classic';
          onFiltersChange({ yearRange: { min: 0, max: 1899 } });
          break;
        default:
          break;
      }

      setActiveFilters((prev) => [...prev, { id, type, value: defaultValue }]);
      setDropdownOpen(false);
    },
    [filters.conditions, filters.tags, onFiltersChange]
  );

  const removeFilter = useCallback(
    (filterId: string) => {
      const filter = activeFilters.find((f) => f.id === filterId);
      if (!filter) return;

      switch (filter.type) {
        case 'country':
          onFiltersChange({
            countries: filters.countries.filter(
              (c) => c.toLowerCase() !== filter.value.toLowerCase()
            ),
          });
          break;
        case 'year':
        case 'era':
          onFiltersChange({ yearRange: { min: null, max: null } });
          break;
        case 'condition':
          onFiltersChange({
            conditions: filters.conditions.filter(
              (c) => c !== filter.value
            ),
          });
          break;
        case 'value':
          onFiltersChange({ valueRange: { min: null, max: null } });
          break;
        case 'tags':
        case 'error':
        case 'topic':
          onFiltersChange({
            tags: filters.tags.filter((t) => t !== filter.value),
          });
          break;
        default:
          break;
      }

      setActiveFilters((prev) => prev.filter((f) => f.id !== filterId));
    },
    [activeFilters, filters, onFiltersChange]
  );

  const updateFilterValue = useCallback(
    (filterId: string, newValue: string) => {
      const filter = activeFilters.find((f) => f.id === filterId);
      if (!filter) return;

      setActiveFilters((prev) =>
        prev.map((f) => (f.id === filterId ? { ...f, value: newValue } : f))
      );

      switch (filter.type) {
        case 'country':
          onFiltersChange({
            countries: [
              ...filters.countries.filter(
                (c) => c.toLowerCase() !== filter.value.toLowerCase()
              ),
              ...(newValue ? [newValue] : []),
            ],
          });
          break;
        case 'condition':
          onFiltersChange({
            conditions: [
              ...filters.conditions.filter((c) => c !== filter.value),
              ...(newValue ? [newValue as StampCondition] : []),
            ],
          });
          break;
        case 'tags':
        case 'topic':
        case 'printing':
          onFiltersChange({
            tags: [
              ...filters.tags.filter((t) => t !== filter.value),
              ...(newValue ? [newValue] : []),
            ],
          });
          break;
        case 'era': {
          const era = ERAS.find((e) => e.value === newValue);
          if (era) {
            onFiltersChange({ yearRange: { min: era.min, max: era.max } });
          }
          break;
        }
        default:
          break;
      }
    },
    [activeFilters, filters, onFiltersChange]
  );

  const updateRangeFilter = useCallback(
    (filterId: string, min: string, max: string) => {
      const filter = activeFilters.find((f) => f.id === filterId);
      if (!filter) return;

      const minNum = min ? Number(min) : null;
      const maxNum = max ? Number(max) : null;

      setActiveFilters((prev) =>
        prev.map((f) =>
          f.id === filterId ? { ...f, value: `${min}–${max}` } : f
        )
      );

      if (filter.type === 'year') {
        onFiltersChange({ yearRange: { min: minNum, max: maxNum } });
      } else if (filter.type === 'value') {
        onFiltersChange({ valueRange: { min: minNum, max: maxNum } });
      }
    },
    [activeFilters, onFiltersChange]
  );

  const handleClearAll = useCallback(() => {
    setActiveFilters([]);
    onClearAll();
  }, [onClearAll]);

  const handleSavePreset = useCallback(() => {
    if (presetName.trim()) {
      onSavePreset(presetName.trim());
      setPresetName('');
      setSaveModalOpen(false);
    }
  }, [presetName, onSavePreset]);

  const hasActiveFilters = activeFilters.length > 0;

  const renderChipEditor = (filter: ActiveFilter) => {
    switch (filter.type) {
      case 'country':
      case 'topic':
      case 'printing':
      case 'tags':
        return (
          <input
            className={styles.chipInput}
            type="text"
            placeholder={`Enter ${filter.type}…`}
            value={filter.value}
            onChange={(e) => updateFilterValue(filter.id, e.target.value)}
            onBlur={(e) => {
              if (!e.target.value.trim()) {
                removeFilter(filter.id);
              }
            }}
            autoFocus={!filter.value}
          />
        );

      case 'year':
      case 'value': {
        const parts = filter.value.split('–');
        return (
          <span className={styles.chipRangeInputs}>
            <input
              className={styles.chipRangeInput}
              type="number"
              placeholder="Min"
              defaultValue={parts[0] || ''}
              onBlur={(e) =>
                updateRangeFilter(filter.id, e.target.value, parts[1] || '')
              }
            />
            <span className={styles.chipRangeSeparator}>–</span>
            <input
              className={styles.chipRangeInput}
              type="number"
              placeholder="Max"
              defaultValue={parts[1] || ''}
              onBlur={(e) =>
                updateRangeFilter(filter.id, parts[0] || '', e.target.value)
              }
            />
          </span>
        );
      }

      case 'condition':
        return (
          <select
            className={styles.chipSelect}
            value={filter.value}
            onChange={(e) => updateFilterValue(filter.id, e.target.value)}
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        );

      case 'era':
        return (
          <select
            className={styles.chipSelect}
            value={filter.value}
            onChange={(e) => updateFilterValue(filter.id, e.target.value)}
          >
            {ERAS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        );

      case 'error':
        return <span className={styles.chipValue}>Error Stamps Only</span>;

      default:
        return null;
    }
  };

  const getFilterLabel = (type: FilterType): string => {
    return FILTER_OPTIONS.find((o) => o.type === type)?.label ?? type;
  };

  return (
    <>
      <div className={styles.bar}>
        {/* Add Filter Dropdown */}
        <div className={styles.dropdownWrapper} ref={dropdownRef}>
          <button
            className={styles.addFilterBtn}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            type="button"
          >
            <span className={styles.addFilterBtnIcon}>+</span>
            Add Filter
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                className={styles.dropdown}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {FILTER_OPTIONS.map((option) => {
                  const alreadyHas =
                    (option.type === 'error' &&
                      activeFilters.some((f) => f.type === 'error')) ||
                    (option.type === 'era' &&
                      activeFilters.some((f) => f.type === 'era'));

                  return (
                    <button
                      key={option.type}
                      className={`${styles.dropdownItem} ${
                        alreadyHas ? styles.dropdownItemDisabled : ''
                      }`}
                      onClick={() => !alreadyHas && addFilter(option.type)}
                      disabled={alreadyHas}
                      type="button"
                    >
                      <span className={styles.dropdownItemIcon}>
                        {option.icon}
                      </span>
                      {option.label}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Active Filter Chips */}
        <div className={styles.chips}>
          <AnimatePresence>
            {activeFilters.map((filter) => (
              <motion.div
                key={filter.id}
                className={styles.chip}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                layout
              >
                <span className={styles.chipLabel}>
                  {getFilterLabel(filter.type)}
                </span>
                {renderChipEditor(filter)}
                <button
                  className={styles.chipRemove}
                  onClick={() => removeFilter(filter.id)}
                  type="button"
                  aria-label={`Remove ${getFilterLabel(filter.type)} filter`}
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Actions */}
        {hasActiveFilters && (
          <div className={styles.actions}>
            <button
              className={styles.saveBtn}
              onClick={() => setSaveModalOpen(true)}
              type="button"
            >
              Save Preset
            </button>
            <button
              className={styles.clearBtn}
              onClick={handleClearAll}
              type="button"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Save Preset Modal */}
      <AnimatePresence>
        {saveModalOpen && (
          <motion.div
            className={styles.modalBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSaveModalOpen(false)}
          >
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={styles.modalTitle}>Save Filter Preset</h3>
              <input
                className={styles.modalInput}
                type="text"
                placeholder="Preset name…"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                autoFocus
              />
              <div className={styles.modalActions}>
                <button
                  className={styles.clearBtn}
                  onClick={() => setSaveModalOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={styles.saveBtn}
                  onClick={handleSavePreset}
                  type="button"
                  disabled={!presetName.trim()}
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
