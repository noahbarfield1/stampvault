'use client';

import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import styles from './GoldButton.module.css';

export interface GoldButtonProps extends HTMLMotionProps<'button'> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantMap: Record<string, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
};

const sizeMap: Record<string, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

export default function GoldButton({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  className = '',
  onClick,
  ...rest
}: GoldButtonProps) {
  const classes = [
    styles.button,
    variantMap[variant],
    sizeMap[size],
    fullWidth ? styles.fullWidth : '',
    loading ? styles.loading : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.button
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      whileTap={!disabled && !loading ? { scale: 0.97 } : undefined}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      {...rest}
    >
      {loading && (
        <span className={styles.spinner}>
          <span className={styles.spinnerIcon} />
        </span>
      )}
      <span className={loading ? styles.loadingContent : undefined}>
        {icon && <span className={styles.icon}>{icon}</span>}
        {children}
      </span>
    </motion.button>
  );
}
