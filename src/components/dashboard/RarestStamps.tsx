'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { Stamp, RarityTier } from '@/types/stamp';
import styles from './RarestStamps.module.css';

interface RarestStampsProps {
  stamps: Stamp[];
}

const rarityLabels: Record<RarityTier, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  scarce: 'Scarce',
  rare: 'Rare',
  very_rare: 'Very Rare',
  extremely_rare: 'Ext. Rare',
  unique: 'Unique',
};

const conditionLabels: Record<string, string> = {
  mint: 'Mint',
  mint_nh: 'MNH',
  unused: 'Unused',
  used: 'Used',
  fine: 'Fine',
  very_fine: 'VF',
  superb: 'Superb',
  poor: 'Poor',
  unknown: '—',
};

function getShortName(stamp: Stamp): string {
  const desc = stamp.identification.description;
  const dashIndex = desc.indexOf('—');
  return dashIndex > -1 ? desc.substring(0, dashIndex).trim() : desc.substring(0, 30);
}

export default function RarestStamps({ stamps }: RarestStampsProps) {
  if (stamps.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Rarest Stamps</h3>
        </div>
        <div className={styles.emptyState}>No rare stamps yet</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Rarest Stamps</h3>
        <p className={styles.subtitle}>Your most exceptional finds</p>
      </div>

      <div className={styles.scrollWrapper}>
        {stamps.map((stamp, index) => (
          <motion.div
            key={stamp.id}
            className={styles.card}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08, duration: 0.3 }}
            whileHover={{ y: -2 }}
          >
            <div className={styles.thumbnailWrapper}>
              <div className={styles.thumbnailPlaceholder}>
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="4"
                    y="4"
                    width="24"
                    height="24"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                  />
                  <circle cx="16" cy="14" r="4" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M10 24C10 21 12.5 19 16 19C19.5 19 22 21 22 24"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            <div className={styles.stampName}>{getShortName(stamp)}</div>
            <div className={styles.country}>
              {stamp.identification.country}
              {stamp.identification.year ? ` · ${stamp.identification.year}` : ''}
            </div>

            <div className={styles.footer}>
              <span
                className={`${styles.rarityBadge} ${
                  stamp.identification.rarity === 'unique' ? styles.rarityUnique : ''
                }`}
              >
                {rarityLabels[stamp.identification.rarity]}
              </span>
              <span className={styles.conditionBadge}>
                {conditionLabels[stamp.identification.condition] ?? stamp.identification.condition}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
