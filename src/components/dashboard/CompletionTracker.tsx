'use client';

import React from 'react';
import { motion } from 'framer-motion';
import styles from './CompletionTracker.module.css';

interface CompletionSet {
  setName: string;
  completed: number;
  total: number;
}

interface CompletionTrackerProps {
  sets: CompletionSet[];
}

export default function CompletionTracker({ sets }: CompletionTrackerProps) {
  if (sets.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Set Completion</h3>
        </div>
        <div className={styles.emptyState}>No sets tracked yet</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Set Completion</h3>
        <p className={styles.subtitle}>Track your progress across stamp sets</p>
      </div>

      <div className={styles.list}>
        {sets.map((set, index) => {
          const pct = set.total > 0 ? (set.completed / set.total) * 100 : 0;
          const isComplete = pct >= 100;

          return (
            <div key={set.setName} className={styles.item}>
              <div className={styles.itemHeader}>
                <span className={styles.setName}>{set.setName}</span>
                <div className={styles.counts}>
                  <span className={styles.fraction}>
                    {set.completed}/{set.total}
                  </span>
                  <span className={styles.percentage}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </div>

              <div className={styles.barTrack}>
                <motion.div
                  className={`${styles.barFill} ${
                    isComplete ? styles.barComplete : ''
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(pct, 100)}%` }}
                  transition={{
                    duration: 0.8,
                    delay: index * 0.1,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
