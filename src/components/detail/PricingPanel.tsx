'use client';

import React from 'react';
import type { Stamp, PriceSource } from '@/types/stamp';
import styles from './PricingPanel.module.css';

/* ── Helpers ───────────────────────────────────────────────────────────── */

const PLATFORM_ICONS: Record<string, string> = {
  hipstamp: '🏪',
  ebay: '🛒',
  delcampe: '📮',
  stampworld: '🌍',
  colnect: '📋',
  manual: '✍️',
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getConfidenceClass(confidence: number): string {
  if (confidence >= 0.8) return styles.confidenceHigh;
  if (confidence >= 0.6) return styles.confidenceMedium;
  return styles.confidenceLow;
}

function getTypeClass(type: string): string {
  switch (type) {
    case 'sold':
      return styles.typeSold;
    case 'active':
      return styles.typeActive;
    case 'estimate':
      return styles.typeEstimate;
    default:
      return styles.typeEstimate;
  }
}

/* ── Props ─────────────────────────────────────────────────────────────── */

interface PricingPanelProps {
  stamp: Stamp;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export default function PricingPanel({
  stamp,
  onRefresh,
  isRefreshing,
}: PricingPanelProps) {
  const { pricing } = stamp;

  if (!pricing) {
    return (
      <div className={styles.panel}>
        <div className={styles.valueHeader}>
          <p className={styles.valueLabel}>Estimated Value</p>
          <p className={styles.valueAmount}>—</p>
          <p className={styles.valueRange}>No pricing data available</p>
        </div>
        <div className={styles.footer}>
          <span className={styles.lastUpdated}>Never updated</span>
          <button
            className={styles.refreshBtn}
            onClick={onRefresh}
            disabled={isRefreshing}
            type="button"
          >
            {isRefreshing && <span className={styles.refreshSpinner}>⟳</span>}
            Fetch Prices
          </button>
        </div>
      </div>
    );
  }

  if (isRefreshing) {
    return (
      <div className={styles.panel}>
        <div className={styles.valueHeader}>
          <p className={styles.valueLabel}>Estimated Value</p>
          <div className={styles.skeletonValue} />
        </div>
        <div className={styles.sources}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.source}>
              <div
                className={styles.skeletonLine}
                style={{ width: '100%', height: 44 }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {/* Value Header */}
      <div className={styles.valueHeader}>
        <p className={styles.valueLabel}>Estimated Value</p>
        <p className={styles.valueAmount}>
          {formatCurrency(pricing.estimatedValue)}
        </p>
        <p className={styles.valueRange}>
          Range: {formatCurrency(pricing.priceRange.min)} –{' '}
          {formatCurrency(pricing.priceRange.max)}
        </p>
        <span className={getConfidenceClass(pricing.confidence)}>
          {Math.round(pricing.confidence * 100)}% Confidence
        </span>
      </div>

      {/* Sources */}
      <div>
        <h4 className={styles.sourcesTitle}>Price Sources</h4>
        <div className={styles.sources}>
          {pricing.sources.map((source: PriceSource, index: number) => {
            const SourceWrapper = source.url ? 'a' : 'div';
            const linkProps = source.url
              ? {
                  href: source.url,
                  target: '_blank' as const,
                  rel: 'noopener noreferrer',
                }
              : {};

            return (
              <SourceWrapper
                key={`${source.platform}-${index}`}
                className={styles.source}
                {...linkProps}
              >
                <div className={styles.sourceIcon}>
                  {PLATFORM_ICONS[source.platform] ?? '📊'}
                </div>
                <div className={styles.sourceInfo}>
                  <div className={styles.sourceName}>
                    {source.platform.charAt(0).toUpperCase() +
                      source.platform.slice(1)}
                  </div>
                  <div className={styles.sourceDate}>
                    {source.soldDate
                      ? formatDate(source.soldDate)
                      : `Fetched ${formatDate(source.fetchedAt)}`}
                    {' · '}
                    <span className={getTypeClass(source.listingType)}>
                      {source.listingType}
                    </span>
                  </div>
                </div>
                <div className={styles.sourcePrice}>
                  {formatCurrency(source.price)}
                </div>
              </SourceWrapper>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.lastUpdated}>
          Updated {formatDate(pricing.lastUpdated)}
        </span>
        <button
          className={styles.refreshBtn}
          onClick={onRefresh}
          disabled={isRefreshing}
          type="button"
        >
          {isRefreshing && <span className={styles.refreshSpinner}>⟳</span>}
          Refresh Prices
        </button>
      </div>
    </div>
  );
}
