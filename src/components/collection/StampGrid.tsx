'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Stamp } from '@/types/stamp';
import StampCard from './StampCard';
import styles from './StampGrid.module.css';

/* ── Skeleton Heights ──────────────────────────────────────────────── */

const SKELETON_HEIGHTS = [220, 280, 200, 260, 240, 300, 190, 250];

interface StampGridProps {
  stamps: Stamp[];
  onStampClick: (stamp: Stamp) => void;
  isLoading?: boolean;
}

export default function StampGrid({
  stamps,
  onStampClick,
  isLoading = false,
}: StampGridProps) {
  if (isLoading) {
    return (
      <div className={styles.skeletonGrid}>
        {SKELETON_HEIGHTS.map((h, i) => (
          <div className={styles.skeleton} key={i}>
            <div className={styles.skeletonImage} style={{ height: h }} />
            <div className={styles.skeletonContent}>
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonLineShort} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (stamps.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>🔍</span>
        <h2 className={styles.emptyTitle}>No stamps found</h2>
        <p className={styles.emptyText}>
          Try adjusting your filters or add new stamps to your collection.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      <AnimatePresence mode="popLayout">
        {stamps.map((stamp) => (
          <motion.div
            key={stamp.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            layout
          >
            <StampCard stamp={stamp} onClick={() => onStampClick(stamp)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
