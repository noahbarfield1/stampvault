'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, type Variants } from 'framer-motion';
import { useUIStore } from '@/store/ui';
import { useStampsStore } from '@/store/stamps';
import type { Stamp } from '@/types/stamp';
import type { CollectionStats } from '@/types/collection';


import StatCard from '@/components/dashboard/StatCard';
import ValueTrendChart from '@/components/dashboard/ValueTrendChart';
import EraTimeline from '@/components/dashboard/EraTimeline';
import PriceMovers from '@/components/dashboard/PriceMovers';
import RarestStamps from '@/components/dashboard/RarestStamps';
import CompletionTracker from '@/components/dashboard/CompletionTracker';
import RecentUploads from '@/components/dashboard/RecentUploads';

import styles from './dashboard.module.css';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(val < 100 ? 2 : 0)}`;
}

/* ─── Icons (inline SVGs) ────────────────────────────────────────────── */

function StampIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3 7.5C4.5 7.5 4.5 6 6 6C7.5 6 7.5 7.5 9 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 7V17M15 9.5C15 9.5 14.5 8 12 8C9.5 8 9 9.5 9 10C9 11.5 15 11 15 13.5C15 14.5 14 16 12 16C10 16 9 14.5 9 14.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DiamondIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 3H18L22 9L12 21L2 9L6 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M2 9H22"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 21L9 9L6 3M12 21L15 9L18 3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 20L9 14L13 18L21 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 10H21V14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Animation Variants ─────────────────────────────────────────────── */

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
};

/* ─── Skeleton Loader ────────────────────────────────────────────────── */

function SkeletonGrid() {
  return (
    <>
      <div className={styles.statsRow}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${styles.skeleton} ${styles.skeletonStat}`} />
        ))}
      </div>
      <div className={styles.chartsRow}>
        <div className={`${styles.skeleton} ${styles.skeletonChart}`} />
        <div className={`${styles.skeleton} ${styles.skeletonChart}`} />
      </div>
      <div className={styles.panelsRow}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`${styles.skeleton} ${styles.skeletonPanel}`} />
        ))}
      </div>
      <div className={`${styles.skeleton} ${styles.skeletonRecent}`} />
    </>
  );
}

/* ─── Dashboard Page ─────────────────────────────────────────────────── */

export default function DashboardPage() {
  const storeStamps = useStampsStore((s) => s.stamps);
  const setStamps = useStampsStore((s) => s.setStamps);
  const setCollectionStats = useStampsStore((s) => s.setCollectionStats);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, []);

  /* Calculate collection stats dynamically from storeStamps */
  const stats = useMemo<CollectionStats>(() => {
    const totalStamps = storeStamps.length;
    const totalValue = storeStamps.reduce((sum, s) => sum + (s.pricing?.estimatedValue ?? 0), 0);
    const averageValue = totalStamps > 0 ? totalValue / totalStamps : 0;

    // Find highest value stamp
    let highestValue: CollectionStats['highestValue'] = null;
    if (totalStamps > 0) {
      const highest = [...storeStamps].sort((a, b) => {
        return (b.pricing?.estimatedValue ?? 0) - (a.pricing?.estimatedValue ?? 0);
      })[0];
      highestValue = {
        stampId: highest.id,
        value: highest.pricing?.estimatedValue ?? 0,
        title: highest.identification.description.split(' — ')[0],
      };
    }

    // Find lowest value stamp
    let lowestValue: CollectionStats['lowestValue'] = null;
    if (totalStamps > 0) {
      const lowest = [...storeStamps].sort((a, b) => {
        return (a.pricing?.estimatedValue ?? 0) - (b.pricing?.estimatedValue ?? 0);
      })[0];
      lowestValue = {
        stampId: lowest.id,
        value: lowest.pricing?.estimatedValue ?? 0,
        title: lowest.identification.description.split(' — ')[0],
      };
    }

    // Average identification confidence
    const totalConfidence = storeStamps.reduce((sum, s) => sum + (s.identification.confidence ?? 0), 0);
    const averageConfidence = totalStamps > 0 ? totalConfidence / totalStamps : 0;

    // Total countries
    const countriesMap = new Map<string, number>();
    storeStamps.forEach((s) => {
      const c = s.identification.country || 'Unknown';
      countriesMap.set(c, (countriesMap.get(c) || 0) + 1);
    });
    const totalCountries = countriesMap.size;
    const topCountries = Array.from(countriesMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    // Condition breakdown
    const conditionsMap = new Map<string, number>();
    storeStamps.forEach((s) => {
      const cond = s.identification.condition || 'unknown';
      conditionsMap.set(cond, (conditionsMap.get(cond) || 0) + 1);
    });
    const conditionBreakdown = Array.from(conditionsMap.entries())
      .map(([condition, count]) => ({ condition: condition as any, count }))
      .sort((a, b) => b.count - a.count);

    // Rarity breakdown
    const raritiesMap = new Map<string, number>();
    storeStamps.forEach((s) => {
      const rar = s.identification.rarity || 'common';
      raritiesMap.set(rar, (raritiesMap.get(rar) || 0) + 1);
    });
    const rarityBreakdown = Array.from(raritiesMap.entries())
      .map(([rarity, count]) => ({ rarity: rarity as any, count }))
      .sort((a, b) => b.count - a.count);

    // Recently added (stamps added in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentlyAdded = storeStamps.filter((s) => {
      try {
        return new Date(s.createdAt) >= thirtyDaysAgo;
      } catch {
        return false;
      }
    }).length;

    // Value change 30d (aggregate value change percent)
    const totalPreviousValue = storeStamps.reduce((sum, s) => {
      let currentVal = s.pricing?.estimatedValue ?? 0;
      let prevVal = currentVal;
      if (s.priceHistory && s.priceHistory.length >= 2) {
        prevVal = s.priceHistory[s.priceHistory.length - 2].value;
      } else if (s.purchasePrice !== null) {
        prevVal = s.purchasePrice;
      }
      return sum + prevVal;
    }, 0);
    const valueChange30d = totalPreviousValue > 0 ? ((totalValue - totalPreviousValue) / totalPreviousValue) * 100 : 0;

    return {
      totalStamps,
      totalValue,
      averageValue,
      highestValue,
      lowestValue,
      totalCountries,
      topCountries,
      conditionBreakdown,
      rarityBreakdown,
      recentlyAdded,
      valueChange30d,
      averageConfidence,
      priceHistoryAggregate: [],
    };
  }, [storeStamps]);

  // Sync calculated stats back to store if needed
  useEffect(() => {
    if (stats) {
      setCollectionStats(stats);
    }
  }, [stats, setCollectionStats]);

  /* Compute rarest stamps sorted by rarity tier from storeStamps */
  const rarestStamps = useMemo(() => {
    const rarityOrder: Record<string, number> = {
      unique: 0,
      extremely_rare: 1,
      very_rare: 2,
      rare: 3,
      scarce: 4,
      uncommon: 5,
      common: 6,
    };

    return [...storeStamps]
      .sort(
        (a, b) =>
          (rarityOrder[a.identification.rarity] ?? 6) -
          (rarityOrder[b.identification.rarity] ?? 6)
      )
      .slice(0, 8);
  }, [storeStamps]);

  /* Compute era timeline distribution dynamically from storeStamps */
  const eraData = useMemo(() => {
    const years = storeStamps
      .map((s) => s.identification.year)
      .filter((y): y is number => y !== null && y !== undefined);

    if (years.length === 0) return [];

    const minDecade = Math.floor(Math.min(...years) / 10) * 10;
    const maxDecade = Math.floor(Math.max(...years) / 10) * 10;

    const dataMap = new Map<number, number>();
    for (let d = minDecade; d <= maxDecade; d += 10) {
      dataMap.set(d, 0);
    }

    storeStamps.forEach((s) => {
      const year = s.identification.year;
      if (year !== null && year !== undefined) {
        const decade = Math.floor(year / 10) * 10;
        dataMap.set(decade, (dataMap.get(decade) || 0) + 1);
      }
    });

    return Array.from(dataMap.entries())
      .map(([decade, count]) => ({
        era: `${decade}s`,
        count,
      }))
      .sort((a, b) => parseInt(a.era) - parseInt(b.era));
  }, [storeStamps]);

  /* Compute price movers dynamically from storeStamps */
  const priceMovers = useMemo(() => {
    return storeStamps
      .map((stamp) => {
        let currentValue = stamp.pricing?.estimatedValue ?? 0;
        let previousValue = currentValue;
        
        if (stamp.priceHistory && stamp.priceHistory.length >= 2) {
          previousValue = stamp.priceHistory[stamp.priceHistory.length - 2].value;
          currentValue = stamp.priceHistory[stamp.priceHistory.length - 1].value;
        } else if (stamp.purchasePrice !== null) {
          previousValue = stamp.purchasePrice;
        }

        if (previousValue === currentValue || previousValue === 0) {
          return null;
        }

        const change = currentValue - previousValue;
        const changePercent = (change / previousValue) * 100;

        return {
          stamp,
          change,
          changePercent,
        };
      })
      .filter((mover): mover is NonNullable<typeof mover> => mover !== null)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 5);
  }, [storeStamps]);

  /* Compute completion sets dynamically from storeStamps */
  const completionSets = useMemo(() => {
    return [
      {
        setName: 'US Air Mail (C1-C150)',
        completed: storeStamps.filter((s) => s.identification.country === 'United States' && (s.identification.series?.toLowerCase().includes('air mail') || s.tags.includes('air-mail'))).length,
        total: 150,
      },
      {
        setName: 'Germany Germania Series',
        completed: storeStamps.filter((s) => s.identification.country === 'Germany' && (s.identification.series?.toLowerCase().includes('germania') || s.identification.series?.toLowerCase().includes('imperial eagle'))).length,
        total: 18,
      },
      {
        setName: 'France Ceres & Napoleon',
        completed: storeStamps.filter((s) => s.identification.country === 'France' && (s.identification.series?.toLowerCase().includes('ceres') || s.identification.series?.toLowerCase().includes('napoleon') || s.identification.series?.toLowerCase().includes('sage'))).length,
        total: 12,
      },
      {
        setName: 'Japan Dragon & Cherry Blossom',
        completed: storeStamps.filter((s) => s.identification.country === 'Japan' && (s.identification.series?.toLowerCase().includes('dragon') || s.identification.series?.toLowerCase().includes('cherry blossom') || s.identification.series?.toLowerCase().includes('koban'))).length,
        total: 8,
      },
      {
        setName: 'Cape Triangulars',
        completed: storeStamps.filter((s) => s.identification.country === 'South Africa' || s.identification.series?.toLowerCase().includes('cape triangular')).length,
        total: 6,
      },
      {
        setName: 'US Trans-Mississippi',
        completed: storeStamps.filter((s) => s.identification.series?.toLowerCase().includes('trans-mississippi')).length,
        total: 9,
      },
    ];
  }, [storeStamps]);

  /* Generate value trend chart data dynamically from storeStamps */
  const valueTrendData = useMemo(() => {
    const allDates = new Set<string>();
    storeStamps.forEach((s) => {
      s.priceHistory?.forEach((h) => {
        if (h.date) {
          allDates.add(h.date.split('T')[0]);
        }
      });
    });

    if (allDates.size === 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const totalVal = storeStamps.reduce((sum, s) => sum + (s.pricing?.estimatedValue ?? 0), 0);
      return [
        { date: '2026-01-01', value: totalVal * 0.95 },
        { date: todayStr, value: totalVal },
      ];
    }

    const sortedDates = Array.from(allDates).sort();
    return sortedDates.map((date) => {
      const dateMs = new Date(date).getTime();
      const value = storeStamps.reduce((sum, stamp) => {
        let stampVal = stamp.pricing?.estimatedValue ?? 0;
        let closestHistoryVal = stampVal;
        let closestDiff = Infinity;
        
        if (stamp.priceHistory && stamp.priceHistory.length > 0) {
          stamp.priceHistory.forEach((h) => {
            const hDateMs = new Date(h.date).getTime();
            if (hDateMs <= dateMs) {
              const diff = dateMs - hDateMs;
              if (diff < closestDiff) {
                closestDiff = diff;
                closestHistoryVal = h.value;
              }
            }
          });
        } else if (stamp.purchasePrice !== null && stamp.purchaseDate) {
          const pDateMs = new Date(stamp.purchaseDate).getTime();
          if (pDateMs <= dateMs) {
            closestHistoryVal = stamp.purchasePrice;
          }
        }
        
        return sum + closestHistoryVal;
      }, 0);

      return { date, value };
    });
  }, [storeStamps]);

  const avgConfidence = (stats as any).averageConfidence ?? 0.85;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <p className={styles.pageSubtitle}>Your collection at a glance</p>
      </div>

      {isLoading ? (
        <SkeletonGrid />
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ─── Stat Cards Row ──────────────────────────────── */}
          <motion.div className={styles.statsRow} variants={itemVariants}>
            <StatCard
              title="Total Stamps"
              value={stats.totalStamps.toLocaleString()}
              icon={<StampIcon />}
              trend={{ value: 8.3, isPositive: true }}
              subtitle={`${stats.recentlyAdded} new · ${Math.round(avgConfidence * 100)}% AI`}
            />
            <StatCard
              title="Total Value"
              value={formatCurrency(stats.totalValue)}
              icon={<DollarIcon />}
              trend={{ value: stats.valueChange30d, isPositive: stats.valueChange30d >= 0 }}
              subtitle="USD estimated"
            />
            <StatCard
              title="Most Valuable"
              value={formatCurrency(stats.highestValue?.value ?? 0)}
              icon={<DiamondIcon />}
              subtitle={stats.highestValue?.title ?? '—'}
            />
            <StatCard
              title="Avg Value"
              value={formatCurrency(stats.averageValue)}
              icon={<ChartIcon />}
              trend={{ value: 1.8, isPositive: true }}
              subtitle="Per stamp"
            />
          </motion.div>

          {/* ─── Charts Row ──────────────────────────────────── */}
          <motion.div className={styles.chartsRow} variants={itemVariants}>
            <ValueTrendChart data={valueTrendData} />
            <EraTimeline data={eraData} />
          </motion.div>

          {/* ─── Panels Row ──────────────────────────────────── */}
          <motion.div className={styles.panelsRow} variants={itemVariants}>
            <PriceMovers movers={priceMovers} />
            <RarestStamps stamps={rarestStamps} />
            <CompletionTracker sets={completionSets} />
          </motion.div>

          {/* ─── Recent Uploads ──────────────────────────────── */}
          <motion.div className={styles.recentRow} variants={itemVariants}>
            <RecentUploads stamps={storeStamps} />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

