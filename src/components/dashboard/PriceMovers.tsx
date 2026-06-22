'use client';

import React from 'react';
import type { Stamp } from '@/types/stamp';
import styles from './PriceMovers.module.css';

interface PriceMover {
  stamp: Stamp;
  change: number;
  changePercent: number;
}

interface PriceMoversProps {
  movers: PriceMover[];
}

function formatPrice(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

export default function PriceMovers({ movers }: PriceMoversProps) {
  const displayMovers = movers.slice(0, 5);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Price Movers</h3>
        <span className={styles.badge}>30d</span>
      </div>

      {displayMovers.length === 0 ? (
        <div className={styles.emptyState}>No price changes to display</div>
      ) : (
        <div className={styles.list}>
          {displayMovers.map((mover) => {
            const isPositive = mover.changePercent >= 0;
            const currentValue = mover.stamp.pricing?.estimatedValue ?? 0;
            const oldValue = currentValue - mover.change;

            return (
              <div key={mover.stamp.id} className={styles.row}>
                <div className={styles.thumbnailPlaceholder}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="2"
                      y="2"
                      width="12"
                      height="12"
                      rx="1"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </div>

                <div className={styles.info}>
                  <div className={styles.stampName}>
                    {mover.stamp.identification.description.split('—')[0].trim()}
                  </div>
                  <div className={styles.priceRow}>
                    <span className={styles.oldPrice}>
                      {formatPrice(oldValue)}
                    </span>
                    <span className={styles.arrow}>→</span>
                    <span className={styles.newPrice}>
                      {formatPrice(currentValue)}
                    </span>
                  </div>
                </div>

                <div
                  className={`${styles.change} ${
                    isPositive ? styles.changePositive : styles.changeNegative
                  }`}
                >
                  <span className={styles.changeIcon}>
                    {isPositive ? (
                      <svg
                        viewBox="0 0 10 10"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M5 1.5L8.5 6.5H1.5L5 1.5Z" fill="currentColor" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 10 10"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M5 8.5L1.5 3.5H8.5L5 8.5Z" fill="currentColor" />
                      </svg>
                    )}
                  </span>
                  {isPositive ? '+' : ''}
                  {mover.changePercent.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
