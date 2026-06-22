'use client';

import React from 'react';
import styles from './Badge.module.css';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'condition' | 'error' | 'rare' | 'price' | 'custom';
  /** Only used when variant='custom' — any valid CSS color */
  color?: string;
  className?: string;
}

/**
 * Maps condition label text to CSS class.
 * Called only when variant === 'condition'.
 */
function resolveConditionClass(label: string): string {
  const normalized = label.trim().toUpperCase();

  if (['SUPERB', 'GEM', 'MINT', 'S'].includes(normalized)) {
    return styles.conditionSuperb;
  }
  if (['XF', 'EF', 'EXTREMELY FINE', 'AU', 'ABOUT UNCIRCULATED'].includes(normalized)) {
    return styles.conditionXf;
  }
  if (['VF', 'VERY FINE'].includes(normalized)) {
    return styles.conditionVf;
  }
  if (['F', 'FINE'].includes(normalized)) {
    return styles.conditionFine;
  }
  // VG, Good, Fair, Poor, etc.
  return styles.conditionLower;
}

/**
 * Attempt to parse a CSS color string into R,G,B for use in rgba().
 * Supports hex (#rrggbb, #rgb) and returns a CSS-compatible string.
 */
function hexToRgb(hex: string): string | null {
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return `${r}, ${g}, ${b}`;
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.substring(0, 2), 16);
    const g = parseInt(cleaned.substring(2, 4), 16);
    const b = parseInt(cleaned.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return null;
}

export default function Badge({
  children,
  variant = 'condition',
  color,
  className = '',
}: BadgeProps) {
  let variantClass = '';
  let inlineStyle: React.CSSProperties | undefined;

  switch (variant) {
    case 'condition':
      variantClass = resolveConditionClass(
        typeof children === 'string' ? children : ''
      );
      break;
    case 'error':
      variantClass = styles.error;
      break;
    case 'rare':
      variantClass = styles.rare;
      break;
    case 'price':
      variantClass = styles.price;
      break;
    case 'custom': {
      variantClass = styles.custom;
      if (color) {
        const rgb = hexToRgb(color);
        inlineStyle = {
          '--badge-color': color,
          ...(rgb ? { '--badge-color-rgb': rgb } : {}),
        } as React.CSSProperties;
      }
      break;
    }
  }

  const classes = [styles.badge, variantClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} style={inlineStyle}>
      {children}
    </span>
  );
}
