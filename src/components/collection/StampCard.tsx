'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { Stamp, StampCondition } from '@/types/stamp';
import styles from './StampCard.module.css';

/* ── Helpers ───────────────────────────────────────────────────────────── */

const COUNTRY_FLAGS: Record<string, string> = {
  'United States': '🇺🇸',
  'Great Britain': '🇬🇧',
  Switzerland: '🇨🇭',
  Sweden: '🇸🇪',
  Austria: '🇦🇹',
  'British Guiana': '🇬🇾',
  Mauritius: '🇲🇺',
  France: '🇫🇷',
  Germany: '🇩🇪',
  Japan: '🇯🇵',
  China: '🇨🇳',
  Australia: '🇦🇺',
  Canada: '🇨🇦',
  India: '🇮🇳',
  Brazil: '🇧🇷',
};

function getFlag(country: string): string {
  return COUNTRY_FLAGS[country] ?? '🏳️';
}

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

function formatValue(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

/* ── Props ─────────────────────────────────────────────────────────────── */

interface StampCardProps {
  stamp: Stamp;
  onClick: () => void;
}

export default function StampCard({ stamp, onClick }: StampCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { identification, pricing, isFavorite } = stamp;

  return (
    <motion.div
      className={styles.card}
      layoutId={`stamp-card-${stamp.id}`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{
        y: -4,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 20px rgba(212,165,116,0.1)',
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Favorite */}
      {isFavorite && <span className={styles.favorite}>⭐</span>}

      {/* Quick Actions */}
      {hovered && (
        <motion.div
          className={styles.quickActions}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15 }}
        >
          <button
            className={styles.quickAction}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            title="View details"
            type="button"
          >
            👁
          </button>
          <button
            className={styles.quickAction}
            onClick={(e) => e.stopPropagation()}
            title="Edit stamp"
            type="button"
          >
            ✏️
          </button>
          <button
            className={`${styles.quickAction} ${styles.quickActionDelete}`}
            onClick={(e) => e.stopPropagation()}
            title="Delete stamp"
            type="button"
          >
            🗑
          </button>
        </motion.div>
      )}

      {/* Image */}
      <div className={styles.imageWrapper}>
        {imgError ? (
          <div className={styles.placeholder}>🎫</div>
        ) : (
          <img
            className={styles.image}
            src={stamp.imageUrl}
            alt={identification.description}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        )}
      </div>

      {/* Overlay */}
      <div className={styles.overlay}>
        <div className={styles.overlayTop}>
          <span className={styles.countryFlag}>
            {getFlag(identification.country)}
          </span>
          <span className={styles.stampName}>{identification.description}</span>
        </div>
        <div className={styles.overlayBottom}>
          {identification.scottNumber && (
            <span className={styles.scottNumber}>
              #{identification.scottNumber}
            </span>
          )}
          <span className={styles.conditionBadge}>
            {CONDITION_LABELS[identification.condition]}
          </span>
          {pricing && (
            <span className={styles.value}>
              {formatValue(pricing.estimatedValue)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
