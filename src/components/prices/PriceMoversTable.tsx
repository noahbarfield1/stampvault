'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Stamp } from '@/types/stamp';
import styles from './PriceMoversTable.module.css';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface PriceMover {
  stamp: Stamp;
  previousValue: number;
  currentValue: number;
  change: number;
  changePercent: number;
  source: string;
}

type SortKey = 'name' | 'previousValue' | 'currentValue' | 'change' | 'changePercent' | 'source';
type SortDir = 'asc' | 'desc';

interface PriceMoversTableProps {
  movers: PriceMover[];
  className?: string;
  onStampClick?: (stampId: string) => void;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

function formatChange(value: number): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatCurrency(Math.abs(value))}`;
}

/* ─── Column Definitions ─────────────────────────────────────────────── */

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'name', label: 'Stamp', align: 'left' },
  { key: 'previousValue', label: 'Previous', align: 'right' },
  { key: 'currentValue', label: 'Current', align: 'right' },
  { key: 'change', label: 'Change', align: 'right' },
  { key: 'changePercent', label: 'Change %', align: 'right' },
  { key: 'source', label: 'Source', align: 'right' },
];

/* ─── Component ──────────────────────────────────────────────────────── */

export default function PriceMoversTable({
  movers,
  className = '',
  onStampClick,
}: PriceMoversTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('changePercent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedMovers = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...movers].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return dir * a.stamp.identification.description.localeCompare(b.stamp.identification.description);
        case 'previousValue':
          return dir * (a.previousValue - b.previousValue);
        case 'currentValue':
          return dir * (a.currentValue - b.currentValue);
        case 'change':
          return dir * (a.change - b.change);
        case 'changePercent':
          return dir * (a.changePercent - b.changePercent);
        case 'source':
          return dir * a.source.localeCompare(b.source);
        default:
          return 0;
      }
    });
  }, [movers, sortKey, sortDir]);

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? '↑' : '↓';
  };

  const getChangeStyle = (value: number) => {
    if (value > 0) return styles.positive;
    if (value < 0) return styles.negative;
    return styles.neutral;
  };

  const getChangeBadgeStyle = (value: number) => {
    if (value > 0) return styles.changeBadgePositive;
    if (value < 0) return styles.changeBadgeNegative;
    return styles.changeBadgeNeutral;
  };

  if (movers.length === 0) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.header}>
          <h3 className={styles.title}>Price Movers</h3>
        </div>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📊</div>
          <p>No price changes to display yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>Price Movers</h3>
        <span className={styles.count}>{movers.length} stamps</span>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`${sortKey === col.key ? styles.thActive : styles.th} ${
                    col.align === 'right' ? styles.thRight : ''
                  }`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {getSortIndicator(col.key) && (
                    <span className={styles.sortIcon}>{getSortIndicator(col.key)}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {sortedMovers.map((mover, index) => (
                <motion.tr
                  key={mover.stamp.id}
                  className={styles.tr}
                  onClick={() => onStampClick?.(mover.stamp.id)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                  layout
                >
                  {/* Stamp */}
                  <td className={styles.td}>
                    <div className={styles.stampCell}>
                      <img
                        src={mover.stamp.thumbnailUrl || mover.stamp.imageUrl}
                        alt={mover.stamp.identification.description}
                        className={styles.stampThumbnail}
                        loading="lazy"
                      />
                      <div className={styles.stampInfo}>
                        <span className={styles.stampName}>
                          {mover.stamp.identification.description}
                        </span>
                        <span className={styles.stampCountry}>
                          {mover.stamp.identification.country}
                          {mover.stamp.identification.year
                            ? ` · ${mover.stamp.identification.year}`
                            : ''}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Previous */}
                  <td className={styles.tdRight}>{formatCurrency(mover.previousValue)}</td>

                  {/* Current */}
                  <td className={`${styles.tdRight} ${getChangeStyle(mover.change)}`}>
                    {formatCurrency(mover.currentValue)}
                  </td>

                  {/* Change */}
                  <td className={styles.tdRight}>
                    <span className={getChangeStyle(mover.change)}>
                      {mover.change > 0 ? '+' : ''}
                      {formatCurrency(mover.change)}
                    </span>
                  </td>

                  {/* Change % */}
                  <td className={styles.tdRight}>
                    <span className={getChangeBadgeStyle(mover.changePercent)}>
                      {mover.changePercent > 0 ? '▲' : mover.changePercent < 0 ? '▼' : '–'}
                      {' '}
                      {formatPercent(Math.abs(mover.changePercent))}
                    </span>
                  </td>

                  {/* Source */}
                  <td className={styles.tdRight}>
                    <span className={styles.sourceBadge}>{mover.source}</span>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
