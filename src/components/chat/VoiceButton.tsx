'use client';

import React from 'react';
import { motion } from 'framer-motion';
import styles from './VoiceButton.module.css';

/* ─── Props ──────────────────────────────────────────────────────────── */

interface VoiceButtonProps {
  isListening: boolean;
  onToggle: () => void;
  isProcessing?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export default function VoiceButton({
  isListening,
  onToggle,
  isProcessing = false,
  size = 'md',
  className = '',
}: VoiceButtonProps) {
  const stateClass = isProcessing
    ? styles.processing
    : isListening
      ? styles.listening
      : '';

  const label = isProcessing
    ? 'Processing voice…'
    : isListening
      ? 'Stop listening'
      : 'Start voice input';

  return (
    <div className={`${styles.tooltipWrapper} ${className}`}>
      <motion.button
        className={`${styles.button} ${styles[size]} ${stateClass}`}
        onClick={onToggle}
        type="button"
        aria-label={label}
        whileTap={!isProcessing ? { scale: 0.92 } : undefined}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        disabled={isProcessing}
      >
        {/* Pulse ring when listening */}
        {isListening && !isProcessing && (
          <span className={styles.pulseRing} aria-hidden="true" />
        )}

        {/* Processing spinner */}
        {isProcessing && (
          <span className={styles.spinner} aria-hidden="true">
            <span className={styles.spinnerRing} />
          </span>
        )}

        {/* Mic icon */}
        {!isProcessing && (
          <svg
            className={styles.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="1" width="6" height="12" rx="3" />
            <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}

        {/* Waveform bars when listening */}
        {isListening && !isProcessing && (
          <div className={styles.waveform} aria-hidden="true">
            <div className={styles.waveBar} />
            <div className={styles.waveBar} />
            <div className={styles.waveBar} />
            <div className={styles.waveBar} />
            <div className={styles.waveBar} />
          </div>
        )}
      </motion.button>

      <span className={styles.tooltipText}>{label}</span>
    </div>
  );
}
