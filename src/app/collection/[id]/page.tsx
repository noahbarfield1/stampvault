'use client';

import React, { useEffect, useMemo, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useStampsStore } from '@/store/stamps';
import { useUIStore } from '@/store/ui';
import ZoomableImage from '@/components/detail/ZoomableImage';
import MetadataAccordion from '@/components/detail/MetadataAccordion';
import PricingPanel from '@/components/detail/PricingPanel';
import PriceHistoryChart from '@/components/detail/PriceHistoryChart';
import SimilarStamps from '@/components/detail/SimilarStamps';
import ConditionComparison from '@/components/detail/ConditionComparison';
import StampPdfExport from '@/components/detail/StampPdfExport';
import styles from './stampDetail.module.css';

interface StampDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function StampDetailPage({ params }: StampDetailPageProps) {
  const { id } = use(params);
  const openChat = useUIStore((s) => s.openChat);
  const stamps = useStampsStore((s) => s.stamps);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const stamp = useMemo(
    () => stamps.find((s) => s.id === id),
    [stamps, id]
  );

  const similarStamps = useMemo(() => {
    if (!stamp) return [];
    return stamps
      .filter(
        (s) =>
          s.id !== stamp.id &&
          (s.identification.country === stamp.identification.country ||
            s.identification.rarity === stamp.identification.rarity ||
            s.tags.some((t) => stamp.tags.includes(t)))
      )
      .slice(0, 6);
  }, [stamps, stamp]);

  const handleFieldEdit = useCallback(
    (field: string, value: string) => {
      console.log(`Edit field ${field} to: ${value}`);
    },
    []
  );

  const handleRefreshPrices = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 2000);
  }, []);

  const handleShare = useCallback(() => {
    if (navigator.share && stamp) {
      navigator.share({
        title: stamp.identification.description,
        text: `Check out this stamp: ${stamp.identification.description}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  }, [stamp]);

  if (!stamp) {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <span className={styles.notFoundIcon}>🔍</span>
          <h2 className={styles.notFoundTitle}>Stamp Not Found</h2>
          <p className={styles.notFoundText}>
            The stamp you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Link href="/collection" className={styles.backBtn}>
            ← Back to Collection
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <Link href="/collection" className={styles.breadcrumbLink}>
          Collection
        </Link>
        <span className={styles.breadcrumbSeparator}>›</span>
        <span className={styles.breadcrumbCurrent}>
          {stamp.identification.description}
        </span>
      </nav>

      {/* Two-column layout */}
      <div className={styles.layout}>
        {/* Left Column */}
        <div className={styles.leftColumn}>
          {stamp.identification?.referenceImageUrl ? (
            <div className={styles.comparisonContainer}>
              <div className={styles.imageColumn}>
                <span className={styles.imageBadge}>Your Stamp</span>
                <ZoomableImage
                  src={stamp.imageUrl || (stamp.thumbnailUrl ?? '')}
                  alt={stamp.identification.description}
                />
              </div>
              <div className={styles.imageColumn}>
                <span className={styles.imageBadge}>Catalog Reference</span>
                <a
                  href={`https://www.hipstamp.com/search?q=${encodeURIComponent((stamp.identification.country || '') + ' ' + (stamp.identification.scottNumber || ''))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block', textDecoration: 'none' }}
                  title="View catalog reference on Hipstamp"
                >
                  <ZoomableImage
                    src={stamp.identification.referenceImageUrl}
                    alt="Catalog Reference"
                  />
                </a>
              </div>
            </div>
          ) : (
            <ZoomableImage
              src={stamp.imageUrl || (stamp.thumbnailUrl ?? '')}
              alt={stamp.identification.description}
            />
          )}

          <MetadataAccordion
            stamp={stamp}
            onFieldEdit={handleFieldEdit}
          />

          <SimilarStamps stamps={similarStamps} />
        </div>

        {/* Right Column */}
        <div className={styles.rightColumn}>
          <PricingPanel
            stamp={stamp}
            onRefresh={handleRefreshPrices}
            isRefreshing={isRefreshing}
          />

          <PriceHistoryChart data={stamp.priceHistory} />

          <ConditionComparison
            currentCondition={stamp.identification.condition}
            stampType={stamp.identification.series ?? 'Postage Stamp'}
          />

          <div className={styles.actions}>
            <StampPdfExport stamp={stamp} />
            <button
              className={styles.shareBtn}
              onClick={handleShare}
              type="button"
            >
              🔗 Share
            </button>
          </div>
        </div>
      </div>

      {/* Floating Chat Button */}
      <motion.button
        className={styles.chatBtn}
        onClick={() => {
          if (stamp) {
            openChat({
              type: 'stamp_detail',
              stampId: stamp.id,
              metadata: { name: stamp.identification.description },
            });
          } else {
            openChat();
          }
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        title="Ask AI about this stamp"
        type="button"
      >
        💬
      </motion.button>
    </div>
  );
}
