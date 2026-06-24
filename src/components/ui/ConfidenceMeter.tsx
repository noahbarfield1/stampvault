'use client';

import React from 'react';
import styles from './ConfidenceMeter.module.css';

export interface ConfidenceMeterProps {
  /** Confidence value (0 to 1, or 0 to 100) */
  confidence: number;
  /** Optional suffix/label text (e.g. 'Match', 'Confidence') */
  label?: string;
  /** Whether to display the text label/percentage */
  showText?: boolean;
  /** Whether to apply a glowing box-shadow or bar shadow */
  glow?: boolean;
  /** Additional custom class names */
  className?: string;
}

export default function ConfidenceMeter({
  confidence,
  label = 'Confidence',
  showText = true,
  glow = true,
  className = '',
}: ConfidenceMeterProps) {
  // Normalize confidence to 0-100 percentage
  const percentage = confidence <= 1 ? confidence * 100 : confidence;
  const clamped = Math.max(0, Math.min(100, percentage));
  const rounded = Math.round(clamped);

  // Determine classification levels
  let levelClass = styles.low;

  if (rounded >= 80) {
    levelClass = styles.high;
  } else if (rounded >= 60) {
    levelClass = styles.medium;
  }

  // Adjust standard label capitalization if needed or preserve user label
  const containerClasses = [
    styles.container,
    levelClass,
    glow ? styles.glow : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      {showText && (
        <div className={styles.textRow}>
          <span className={styles.percentText}>{rounded}%</span>
          {label && <span className={styles.labelText}>{label}</span>}
        </div>
      )}
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={styles.fill}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
