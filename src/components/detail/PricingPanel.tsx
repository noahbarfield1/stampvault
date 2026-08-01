'use client';

import React from 'react';
import type { Stamp, PriceSource, PriceBasis } from '@/types/stamp';
import ConfidenceMeter from '@/components/ui/ConfidenceMeter';
import { Tooltip } from '@/components/ui/InfoHint';
import styles from './PricingPanel.module.css';

const TIER_HEADING: Record<PriceBasis['tier'], string> = {
  live_sold: 'Live Sold Price',
  active: 'Current Asking Price',
  last_sold: 'Last Known Sold',
  catalog: 'Catalog Value',
};

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
  const hasCents = value % 1 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasCents || value < 100 ? 2 : 0,
    maximumFractionDigits: hasCents || value < 100 ? 2 : 0,
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

  const basis = pricing.priceBasis;

  return (
    <div className={styles.panel}>
      {/* Value Header */}
      <div className={styles.valueHeader}>
        {basis && (
          <span className={styles.basisBadge} data-tier={basis.tier}>
            {basis.label}
          </span>
        )}
        <p className={styles.valueLabel}>
          {basis ? TIER_HEADING[basis.tier] : 'Estimated Value'}{' '}
          <Tooltip label="Where does this price come from?" title="Where this comes from">
            An estimate aggregated from real eBay listings, with outliers removed. It is not an
            appraisal — condition drives most of a stamp&rsquo;s value and a photo cannot judge
            gum, thins or repairs.
          </Tooltip>
        </p>
        <p className={styles.valueAmount}>
          {formatCurrency(pricing.estimatedValue)}
        </p>
        <p className={styles.valueRange}>
          Range: {formatCurrency(pricing.priceRange.min)} –{' '}
          {formatCurrency(pricing.priceRange.max)}
        </p>
        <ConfidenceMeter
          confidence={pricing.confidence}
          label="Confidence"
          className={styles.panelConfidenceMeter}
          explain
        />

        {/* Proof: the actual listing behind the headline value */}
        {basis?.proof && (basis.proof.imageUrl || basis.proof.url) && (
          <a
            className={styles.proof}
            href={basis.proof.url ?? undefined}
            target={basis.proof.url ? '_blank' : undefined}
            rel="noopener noreferrer"
          >
            {basis.proof.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.proofThumb}
                src={basis.proof.imageUrl}
                alt={basis.proof.title ?? 'Listing proof'}
                loading="lazy"
              />
            )}
            <span className={styles.proofBody}>
              <span className={styles.proofLabel}>
                {basis.tier === 'live_sold' || basis.tier === 'last_sold'
                  ? 'Most recent sale'
                  : basis.tier === 'active'
                    ? 'Example listing'
                    : 'Source'}
                {basis.proof.price != null && ` · ${formatCurrency(basis.proof.price)}`}
                {basis.proof.soldDate && ` · ${formatDate(basis.proof.soldDate)}`}
              </span>
              {basis.proof.url && (
                <span className={styles.proofLink}>View listing →</span>
              )}
            </span>
          </a>
        )}
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
                {source.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className={styles.sourceThumb}
                    src={source.imageUrl}
                    alt={source.title || source.platform}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.sourceIcon}>
                    {PLATFORM_ICONS[source.platform] ?? '📊'}
                  </div>
                )}
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
