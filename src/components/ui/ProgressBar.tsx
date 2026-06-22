'use client';

import React from 'react';
import styles from './ProgressBar.module.css';

export interface ProgressBarProps {
  /** Progress value from 0 to 100 */
  progress: number;
  label?: string;
  showPercent?: boolean;
  variant?: 'gold' | 'emerald';
  className?: string;
}

export default function ProgressBar({
  progress,
  label,
  showPercent = false,
  variant = 'gold',
  className = '',
}: ProgressBarProps) {
  /* Clamp value between 0 and 100 */
  const clamped = Math.max(0, Math.min(100, progress));
  const rounded = Math.round(clamped);

  const fillClass =
    variant === 'emerald' ? styles.fillEmerald : styles.fillGold;

  const containerClasses = [styles.container, className]
    .filter(Boolean)
    .join(' ');

  const hasLabelRow = label || showPercent;

  return (
    <div className={containerClasses}>
      {hasLabelRow && (
        <div className={styles.labelRow}>
          {label && <span className={styles.label}>{label}</span>}
          {showPercent && (
            <span className={styles.percent}>{rounded}%</span>
          )}
        </div>
      )}
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
      >
        <div
          className={`${styles.fill} ${fillClass}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
