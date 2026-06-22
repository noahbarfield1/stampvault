'use client';

import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import styles from './GlassCard.module.css';

export interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  padding?: 'sm' | 'md' | 'lg';
  glow?: boolean;
}

const paddingMap: Record<string, string> = {
  sm: styles.paddingSm,
  md: styles.paddingMd,
  lg: styles.paddingLg,
};

export default function GlassCard({
  children,
  className = '',
  onClick,
  hoverable = false,
  padding = 'md',
  glow = false,
  ...rest
}: GlassCardProps) {
  const classes = [
    styles.card,
    paddingMap[padding],
    hoverable ? styles.hoverable : '',
    glow ? styles.glow : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.div
      className={classes}
      onClick={onClick}
      whileHover={
        hoverable
          ? {
              scale: 1.01,
              boxShadow: glow
                ? '0 8px 32px rgba(0,0,0,0.5), 0 0 40px rgba(212,165,116,0.25)'
                : '0 8px 32px rgba(0,0,0,0.5)',
            }
          : undefined
      }
      whileTap={hoverable ? { scale: 0.995 } : undefined}
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
      {...rest}
    >
      {children}
    </motion.div>
  );
}
