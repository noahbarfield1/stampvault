'use client';

import React from 'react';
import type { DetectedStamp } from './SegmentationOverlay';
import styles from './ReviewGrid.module.css';

interface ReviewGridProps {
  stamps: DetectedStamp[];
  onConfirm: (index: number) => void;
  onReject: (index: number) => void;
}

function getConfidenceClass(confidence: number): string {
  if (confidence >= 0.8) return styles.confidenceHigh;
  if (confidence >= 0.6) return styles.confidenceMedium;
  return styles.confidenceLow;
}

export default function ReviewGrid({
  stamps,
  onConfirm,
  onReject,
}: ReviewGridProps) {
  const confirmedCount = stamps.filter((s) => s.confirmed).length;

  return (
    <div className={styles.wrapper}>
      <div className={styles.counter}>
        <span className={styles.counterHighlight}>{confirmedCount}</span> of{' '}
        {stamps.length} confirmed
      </div>

      <div className={styles.grid}>
        {stamps.map((stamp, index) => {
          let cardClass = styles.card;
          if (stamp.confirmed) cardClass = styles.cardConfirmed;
          if (stamp.rejected) cardClass = styles.cardRejected;

          return (
            <div key={stamp.id} className={cardClass}>
              {stamp.croppedImageUrl ? (
                <img
                  className={styles.cardImage}
                  src={stamp.croppedImageUrl}
                  alt={stamp.description || `Stamp ${index + 1}`}
                />
              ) : (
                <div className={styles.cardImagePlaceholder}>🎫</div>
              )}

              <div className={styles.cardBody}>
                <p className={styles.cardDescription}>
                  {stamp.description || `Detected stamp #${index + 1}`}
                </p>
                <p
                  className={`${styles.cardConfidence} ${getConfidenceClass(stamp.confidence)}`}
                >
                  {Math.round(stamp.confidence * 100)}% confidence
                </p>
                <div className={styles.cardActions}>
                  <button
                    className={
                      stamp.confirmed
                        ? styles.confirmBtnActive
                        : styles.confirmBtn
                    }
                    onClick={() => onConfirm(index)}
                    type="button"
                  >
                    {stamp.confirmed ? '✓ Confirmed' : 'Confirm'}
                  </button>
                  <button
                    className={
                      stamp.rejected
                        ? styles.rejectBtnActive
                        : styles.rejectBtn
                    }
                    onClick={() => onReject(index)}
                    type="button"
                  >
                    {stamp.rejected ? '✕ Rejected' : 'Reject'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
