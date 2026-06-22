'use client';

import React, { useState } from 'react';
import type { Stamp, StampCondition } from '@/types/stamp';
import type { SortConfig, SortField } from '@/types/collection';
import styles from './StampTable.module.css';

/* ── Helpers ───────────────────────────────────────────────────────────── */

const CONDITION_LABELS: Record<StampCondition, string> = {
  superb: 'Superb',
  very_fine: 'VF',
  fine: 'Fine',
  mint_nh: 'MNH',
  mint: 'Mint',
  unused: 'Unused',
  used: 'Used',
  poor: 'Poor',
  unknown: '—',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/* ── Column definitions ────────────────────────────────────────────────── */

interface Column {
  key: string;
  label: string;
  sortField?: SortField;
  width?: string;
}

const COLUMNS: Column[] = [
  { key: 'checkbox', label: '', width: '40px' },
  { key: 'thumbnail', label: '', width: '56px' },
  { key: 'country', label: 'Country', sortField: 'country' },
  { key: 'year', label: 'Year', sortField: 'year' },
  { key: 'scottNumber', label: 'Scott #', sortField: 'scottNumber' },
  { key: 'denomination', label: 'Denom.' },
  { key: 'condition', label: 'Condition', sortField: 'condition' },
  { key: 'grade', label: 'Grade' },
  { key: 'value', label: 'Value', sortField: 'estimatedValue' },
  { key: 'tags', label: 'Tags' },
];

/* ── Props ─────────────────────────────────────────────────────────────── */

interface StampTableProps {
  stamps: Stamp[];
  onStampClick: (stamp: Stamp) => void;
  sort: SortConfig;
  onSort: (sort: SortConfig) => void;
}

export default function StampTable({
  stamps,
  onStampClick,
  sort,
  onSort,
}: StampTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allSelected =
    stamps.length > 0 && selectedIds.size === stamps.length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(stamps.map((s) => s.id)));
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    if (sort.field === field) {
      onSort({
        field,
        direction: sort.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      onSort({ field, direction: 'asc' });
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sort.field !== field) return <span className={styles.sortIcon}>↕</span>;
    return (
      <span className={styles.sortIcon}>
        {sort.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            {COLUMNS.map((col) => {
              if (col.key === 'checkbox') {
                return (
                  <th
                    key={col.key}
                    className={styles.checkboxCell}
                    style={{ width: col.width }}
                  >
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={allSelected}
                      onChange={handleSelectAll}
                    />
                  </th>
                );
              }

              const isSortable = !!col.sortField;
              const isActive = col.sortField === sort.field;

              return (
                <th
                  key={col.key}
                  className={`${isSortable ? styles.sortable : ''} ${
                    isActive ? styles.sortActive : ''
                  }`}
                  style={{ width: col.width }}
                  onClick={
                    isSortable
                      ? () => handleSort(col.sortField!)
                      : undefined
                  }
                >
                  {col.label}
                  {isSortable && renderSortIcon(col.sortField!)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className={styles.tbody}>
          {stamps.map((stamp) => {
            const isSelected = selectedIds.has(stamp.id);
            return (
              <tr
                key={stamp.id}
                onClick={() => onStampClick(stamp)}
                style={
                  isSelected
                    ? { background: 'rgba(212, 165, 116, 0.06)' }
                    : undefined
                }
              >
                {/* Checkbox */}
                <td className={styles.checkboxCell}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleSelectRow(stamp.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>

                {/* Thumbnail */}
                <td className={styles.thumbnailCell}>
                  {stamp.thumbnailUrl || stamp.imageUrl ? (
                    <img
                      className={styles.thumbnail}
                      src={stamp.thumbnailUrl ?? stamp.imageUrl}
                      alt={stamp.identification.description}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className={styles.thumbnailPlaceholder}>🎫</div>
                  )}
                </td>

                {/* Country */}
                <td className={styles.countryCell}>
                  {stamp.identification.country}
                </td>

                {/* Year */}
                <td>{stamp.identification.year ?? '—'}</td>

                {/* Scott # */}
                <td className={styles.scottCell}>
                  {stamp.identification.scottNumber ?? '—'}
                </td>

                {/* Denomination */}
                <td>{stamp.identification.denomination ?? '—'}</td>

                {/* Condition */}
                <td>
                  <span className={styles.conditionBadge}>
                    {CONDITION_LABELS[stamp.identification.condition]}
                  </span>
                </td>

                {/* Grade */}
                <td className={styles.grade}>
                  {stamp.grade !== null ? stamp.grade : '—'}
                </td>

                {/* Value */}
                <td className={styles.valueCell}>
                  {stamp.pricing
                    ? formatCurrency(stamp.pricing.estimatedValue)
                    : '—'}
                </td>

                {/* Tags */}
                <td>
                  <div className={styles.tags}>
                    {stamp.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                    {stamp.tags.length > 3 && (
                      <span className={styles.tag}>
                        +{stamp.tags.length - 3}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
