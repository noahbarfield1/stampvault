'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const positionMap: Record<string, string> = {
  top: styles.top,
  bottom: styles.bottom,
  left: styles.left,
  right: styles.right,
};

export default function Tooltip({
  content,
  children,
  position = 'top',
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearTimer();
    setVisible(true);
    /* Auto-hide after 3 seconds */
    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, 3000);
  }, [clearTimer]);

  const handleMouseLeave = useCallback(() => {
    clearTimer();
    setVisible(false);
  }, [clearTimer]);

  const handleFocus = useCallback(() => {
    handleMouseEnter();
  }, [handleMouseEnter]);

  const handleBlur = useCallback(() => {
    handleMouseLeave();
  }, [handleMouseLeave]);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const tooltipClasses = [
    styles.tooltip,
    positionMap[position],
    visible ? styles.visible : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={styles.wrapper}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children}
      <span className={tooltipClasses} role="tooltip" aria-hidden={!visible}>
        {content}
      </span>
    </span>
  );
}
