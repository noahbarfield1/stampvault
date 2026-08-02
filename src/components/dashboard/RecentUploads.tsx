'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { Stamp } from '@/types/stamp';
import styles from './RecentUploads.module.css';

interface RecentUploadsProps {
  stamps: Stamp[];
}

const countryFlags: Record<string, string> = {
  'United States': '🇺🇸',
  'United Kingdom': '🇬🇧',
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'Japan': '🇯🇵',
  'Sweden': '🇸🇪',
  'Mauritius': '🇲🇺',
  'Austria': '🇦🇹',
  'South Africa': '🇿🇦',
  'Guyana': '🇬🇾',
};

function getShortName(stamp: Stamp): string {
  const desc = stamp.identification.description;
  const dashIndex = desc.indexOf('—');
  return dashIndex > -1 ? desc.substring(0, dashIndex).trim() : desc.substring(0, 28);
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  });
}

export default function RecentUploads({ stamps }: RecentUploadsProps) {
  const router = useRouter();
  const sorted = [...stamps]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 12);

  if (sorted.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <h3 className={styles.title}>Recent Uploads</h3>
          </div>
        </div>
        <div className={styles.emptyState}>No stamps uploaded yet</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h3 className={styles.title}>Recent Uploads</h3>
          <span className={styles.subtitle}>
            Latest additions to your collection
          </span>
        </div>
        <button
          className={styles.viewAll}
          type="button"
          onClick={() => router.push('/collection')}
        >
          View All
        </button>
      </div>

      <div className={styles.scrollWrapper}>
        {sorted.map((stamp, index) => {
          const flag =
            countryFlags[stamp.identification.country] ?? '🏳️';

          return (
            <motion.div
              key={stamp.id}
              className={styles.card}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.35 }}
            >
              <div className={styles.imageWrapper}>
                {stamp.imageUrl || stamp.thumbnailUrl ? (
                  <img
                    className={styles.image}
                    src={stamp.thumbnailUrl || stamp.imageUrl || undefined}
                    alt={stamp.identification.description}
                  />
                ) : (
                  <div className={styles.imagePlaceholder}>
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 28 28"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect
                        x="3"
                        y="3"
                        width="22"
                        height="22"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="3 2"
                      />
                      <path
                        d="M8 20L12 14L15 17L18 12L20 20H8Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="11"
                        cy="10"
                        r="2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                    <span>{stamp.identification.country}</span>
                  </div>
                )}
                <div className={styles.countryFlag}>{flag}</div>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.stampName}>{getShortName(stamp)}</div>
                <div className={styles.meta}>
                  <span className={styles.country}>
                    {stamp.identification.country}
                  </span>
                  <span className={styles.date}>
                    {formatDate(stamp.createdAt)}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
