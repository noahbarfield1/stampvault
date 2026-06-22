'use client';

import React from 'react';
import { motion } from 'framer-motion';
import styles from './StatCard.module.css';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  subtitle?: string;
  onClick?: () => void;
}

export default function StatCard({
  title,
  value,
  icon,
  trend,
  subtitle,
  onClick,
}: StatCardProps) {
  return (
    <motion.div
      className={styles.card}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <div className={styles.iconWrapper}>{icon}</div>
      </div>

      <div className={styles.value}>{value}</div>

      <div className={styles.footer}>
        {trend && (
          <span
            className={`${styles.trend} ${
              trend.isPositive ? styles.trendPositive : styles.trendNegative
            }`}
          >
            <span className={styles.trendArrow}>
              {trend.isPositive ? (
                <svg
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 2.5L10 7.5H2L6 2.5Z"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 9.5L2 4.5H10L6 9.5Z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </span>
            {trend.isPositive ? '+' : ''}
            {trend.value.toFixed(1)}%
          </span>
        )}

        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
    </motion.div>
  );
}
