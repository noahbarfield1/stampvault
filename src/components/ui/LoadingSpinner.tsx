'use client';

import React from 'react';
import styles from './LoadingSpinner.module.css';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap: Record<string, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

export default function LoadingSpinner({
  size = 'md',
  className = '',
}: LoadingSpinnerProps) {
  const wrapperClasses = [styles.wrapper, className].filter(Boolean).join(' ');

  return (
    <span className={wrapperClasses} role="status" aria-label="Loading">
      <span className={`${styles.spinner} ${sizeMap[size]}`} />
    </span>
  );
}
