'use client';

import React, { useEffect, useMemo, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useStampsStore } from '@/store/stamps';
import { useUIStore } from '@/store/ui';
import type { StampCondition } from '@/types/stamp';
import ZoomableImage from '@/components/detail/ZoomableImage';
import MetadataAccordion from '@/components/detail/MetadataAccordion';
import PricingPanel from '@/components/detail/PricingPanel';
import PriceHistoryChart from '@/components/detail/PriceHistoryChart';
import SimilarStamps from '@/components/detail/SimilarStamps';
import ConditionComparison from '@/components/detail/ConditionComparison';
import StampPdfExport from '@/components/detail/StampPdfExport';
import styles from './stampDetail.module.css';
import { usePageChrome } from '@/hooks/usePageChrome';

interface StampDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function StampDetailPage({ params }: StampDetailPageProps) {
  usePageChrome({ title: 'Stamp', backHref: '/collection' });
  const { id } = use(params);
  const openChat = useUIStore((s) => s.openChat);
  const addToast = useUIStore((s) => s.addToast);
  const stamps = useStampsStore((s) => s.stamps);
  const updateStamp = useStampsStore((s) => s.updateStamp);
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
      if (!stamp) return;

      switch (field) {
        case 'country':
          updateStamp(stamp.id, {
            identification: { ...stamp.identification, country: value },
          });
          break;
        case 'year': {
          const parsed = parseInt(value, 10);
          updateStamp(stamp.id, {
            identification: {
              ...stamp.identification,
              year: Number.isNaN(parsed) ? null : parsed,
            },
          });
          break;
        }
        case 'denomination':
          updateStamp(stamp.id, {
            identification: {
              ...stamp.identification,
              denomination: value.trim() === '' ? null : value,
            },
          });
          break;
        case 'scottNumber':
          updateStamp(stamp.id, {
            identification: {
              ...stamp.identification,
              scottNumber: value.trim() === '' ? null : value,
            },
          });
          break;
        case 'michelNumber':
          updateStamp(stamp.id, {
            identification: {
              ...stamp.identification,
              michelNumber: value.trim() === '' ? null : value,
            },
          });
          break;
        case 'description':
          updateStamp(stamp.id, {
            identification: { ...stamp.identification, description: value },
          });
          break;
        case 'series':
          updateStamp(stamp.id, {
            identification: {
              ...stamp.identification,
              series: value.trim() === '' ? null : value,
            },
          });
          break;
        case 'condition': {
          const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
          updateStamp(stamp.id, {
            identification: {
              ...stamp.identification,
              condition: normalized as StampCondition,
            },
          });
          break;
        }
        case 'color':
          updateStamp(stamp.id, {
            identification: {
              ...stamp.identification,
              color: value.trim() === '' ? null : value,
            },
          });
          break;
        case 'perforation':
          updateStamp(stamp.id, {
            identification: {
              ...stamp.identification,
              perforation: value.trim() === '' ? null : value,
            },
          });
          break;
        case 'watermark':
          updateStamp(stamp.id, {
            identification: {
              ...stamp.identification,
              watermark: value.trim() === '' ? null : value,
            },
          });
          break;
        case 'grade': {
          const parsed = parseFloat(value);
          updateStamp(stamp.id, { grade: Number.isNaN(parsed) ? null : parsed });
          break;
        }
        case 'tags': {
          const tags = value
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
          updateStamp(stamp.id, { tags });
          break;
        }
        case 'notes':
          updateStamp(stamp.id, { notes: value });
          break;
        case 'purchasePrice': {
          const parsed = parseFloat(value);
          updateStamp(stamp.id, {
            purchasePrice: Number.isNaN(parsed) ? null : parsed,
          });
          break;
        }
        case 'purchaseDate': {
          if (value.trim() === '') {
            updateStamp(stamp.id, { purchaseDate: null });
            break;
          }
          const parsedDate = new Date(value);
          updateStamp(stamp.id, {
            purchaseDate: Number.isNaN(parsedDate.getTime())
              ? null
              : parsedDate.toISOString(),
          });
          break;
        }
        default:
          return;
      }

      addToast({ type: 'success', title: 'Saved', duration: 2000 });
    },
    [stamp, updateStamp, addToast]
  );

  const handleRefreshPrices = useCallback(async () => {
    if (!stamp) return;

    setIsRefreshing(true);
    try {
      const res = await fetch('/api/pricing/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stampDescription: stamp.identification.description,
          scottNumber: stamp.identification.scottNumber || undefined,
          country: stamp.identification.country || undefined,
          year: stamp.identification.year || undefined,
          condition: stamp.identification.condition || undefined,
          forceRefresh: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`Price lookup failed with status ${res.status}`);
      }

      const { pricing } = await res.json();
      if (pricing) {
        updateStamp(stamp.id, { pricing });
        addToast({ type: 'success', title: 'Prices refreshed' });
      } else {
        addToast({
          type: 'error',
          title: "Couldn't refresh prices",
          message: 'No pricing data was returned.',
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: "Couldn't refresh prices",
        message:
          error instanceof Error ? error.message : 'Please try again later.',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [stamp, updateStamp, addToast]);

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
                {/* Deliberately NOT wrapped in an anchor. Any pinch, pan or
                    double-tap on a zoomable image ends in a click, which would
                    navigate off-site and lose the user's place. The link is a
                    separate, explicit control below the image — which also
                    gives it a real accessible name. */}
                <ZoomableImage
                  src={stamp.identification.referenceImageUrl}
                  alt="Catalog Reference"
                />
                <a
                  className={styles.referenceLink}
                  href={`https://www.hipstamp.com/search?q=${encodeURIComponent((stamp.identification.country || '') + ' ' + (stamp.identification.scottNumber || ''))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on HipStamp ↗
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
