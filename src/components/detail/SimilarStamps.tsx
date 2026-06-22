'use client';

import React, { useState } from 'react';
import type { Stamp } from '@/types/stamp';
import styles from './SimilarStamps.module.css';

interface SimilarStampsProps {
  stamps: Stamp[];
}

function formatValue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function getSimilarityReason(stamp: Stamp): string {
  if (stamp.tags.includes('error')) return 'Error stamp';
  if (stamp.identification.rarity === 'unique') return 'Unique rarity';
  return `Same era (${stamp.identification.year ?? '?'})`;
}

export default function SimilarStamps({ stamps }: SimilarStampsProps) {
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  if (stamps.length === 0) {
    return (
      <div className={styles.carousel}>
        <h4 className={styles.title}>Similar Stamps</h4>
        <div className={styles.empty}>No similar stamps found</div>
      </div>
    );
  }

  const handleImgError = (id: string) => {
    setImgErrors((prev) => new Set(prev).add(id));
  };

  return (
    <div className={styles.carousel}>
      <h4 className={styles.title}>Similar Stamps</h4>
      <div className={styles.track}>
        {stamps.map((stamp) => (
          <div key={stamp.id} className={styles.card}>
            {imgErrors.has(stamp.id) ? (
              <div className={styles.cardImagePlaceholder}>🎫</div>
            ) : (
              <img
                className={styles.cardImage}
                src={stamp.thumbnailUrl ?? stamp.imageUrl}
                alt={stamp.identification.description}
                onError={() => handleImgError(stamp.id)}
                loading="lazy"
              />
            )}
            <div className={styles.cardBody}>
              <p className={styles.cardName}>
                {stamp.identification.description}
              </p>
              <div className={styles.cardMeta}>
                <span className={styles.cardValue}>
                  {stamp.pricing
                    ? formatValue(stamp.pricing.estimatedValue)
                    : '—'}
                </span>
                <span className={styles.cardReason}>
                  {getSimilarityReason(stamp)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
