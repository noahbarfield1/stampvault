'use client';

import React from 'react';
import styles from './AnimatedBackground.module.css';

export default function AnimatedBackground() {
  return (
    <div className={styles.backgroundContainer}>
      <div className={styles.meshGradient} />
      <div className={styles.noiseOverlay} />
    </div>
  );
}
