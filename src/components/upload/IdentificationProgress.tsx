'use client';

import React from 'react';
import type { DetectedStamp } from './SegmentationOverlay';
import type { Stamp } from '@/types/stamp';
import styles from './IdentificationProgress.module.css';

interface IdentificationProgressProps {
  stamps: DetectedStamp[];
  identifiedStamps: Partial<Stamp>[];
  currentIndex: number;
}

export default function IdentificationProgress({
  stamps,
  identifiedStamps,
  currentIndex,
}: IdentificationProgressProps) {
  const totalStamps = stamps.length;
  const completedCount = identifiedStamps.length;
  const progressPercent =
    totalStamps > 0 ? (completedCount / totalStamps) * 100 : 0;

  return (
    <div className={styles.wrapper}>
      {/* Overall progress bar */}
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className={styles.progressLabel}>
        Identifying stamp {Math.min(currentIndex + 1, totalStamps)} of{' '}
        {totalStamps}…
      </p>

      {/* Items list */}
      <div className={styles.items}>
        {stamps.map((stamp, index) => {
          const isComplete = index < completedCount;
          const isCurrent = index === currentIndex;
          const identified = identifiedStamps[index];

          let itemClass = styles.item;
          if (isCurrent) itemClass = styles.itemActive;
          if (isComplete) itemClass = styles.itemComplete;

          return (
            <div key={stamp.id} className={itemClass}>
              {/* Image preview */}
              {stamp.croppedImageUrl ? (
                <img
                  className={styles.itemImage}
                  src={stamp.croppedImageUrl}
                  alt={stamp.description || `Stamp ${index + 1}`}
                />
              ) : (
                <div className={styles.itemImagePlaceholder}>🎫</div>
              )}

              {/* Info */}
              <div className={styles.itemInfo}>
                <p className={styles.itemTitle}>
                  {isComplete && identified?.identification
                    ? identified.identification.description
                    : stamp.description || `Stamp #${index + 1}`}
                </p>

                {isComplete && identified?.identification ? (
                  <div className={styles.metaPreview}>
                    <span className={styles.metaTag}>
                      {identified.identification.country}
                    </span>
                    {identified.identification.year && (
                      <span className={styles.metaTag}>
                        {identified.identification.year}
                      </span>
                    )}
                    {identified.identification.scottNumber && (
                      <span className={styles.metaTag}>
                        #{identified.identification.scottNumber}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className={styles.itemMeta}>
                    {isCurrent
                      ? 'Analyzing with AI…'
                      : 'Waiting in queue'}
                  </p>
                )}
              </div>

              {/* Status */}
              <div className={styles.itemStatus}>
                {isComplete && (
                  <span className={styles.statusComplete}>✓</span>
                )}
                {isCurrent && (
                  <span className={styles.statusProcessing}>⟳</span>
                )}
                {!isComplete && !isCurrent && (
                  <span className={styles.statusWaiting}>⏳</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
