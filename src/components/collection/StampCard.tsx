'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useStampsStore } from '@/store/stamps';
import { useUIStore } from '@/store/ui';
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
  if (!value || value <= 0) return '—';
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  }
  // Sub-$100 stamps (incl. sub-dollar) keep cents so $0.15 doesn't render as "$0".
  return `$${value.toFixed(value < 100 ? 2 : 0)}`;
}

/* ── Props ─────────────────────────────────────────────────────────────── */

interface StampCardProps {
  stamp: Stamp;
  onClick: () => void;
}

export default function StampCard({ stamp, onClick }: StampCardProps) {
  const router = useRouter();
  const removeStamp = useStampsStore((s) => s.removeStamp);
  const addToast = useUIStore((s) => s.addToast);
  const [hovered, setHovered] = useState(false);
  /* On a touch device there is no hover, so view/edit/delete were
     completely unreachable — the card had no other route to them.
     Render them unconditionally when the pointer is coarse. */
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  }, []);
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
      {(hovered || isTouch) && (
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
            onClick={(e) => {
              e.stopPropagation();
              router.push('/collection/' + stamp.id);
            }}
            title="Edit stamp"
            type="button"
          >
            ✏️
          </button>
          <button
            className={`${styles.quickAction} ${styles.quickActionDelete}`}
            onClick={(e) => {
              e.stopPropagation();
              const confirmed = window.confirm(
                `Remove "${identification.description}" from your collection? This cannot be undone.`
              );
              if (!confirmed) return;
              removeStamp(stamp.id);
              addToast({
                type: 'success',
                title: 'Stamp removed',
                message: `${identification.description} was removed from your collection.`,
              });
            }}
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
            src={stamp.thumbnailUrl || stamp.imageUrl || undefined}
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
            <span
              className={styles.value}
              title={pricing.priceBasis?.label ?? undefined}
            >
              {formatValue(pricing.estimatedValue)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
