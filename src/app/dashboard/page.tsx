'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, type Variants } from 'framer-motion';
import { useUIStore } from '@/store/ui';
import { useStampsStore } from '@/store/stamps';
import type { Stamp } from '@/types/stamp';
import {
  mockStamps,
  mockValueTrendData,
  mockEraData,
  mockPriceMovers,
  mockCompletionSets,
  mockCollectionStats,
} from '@/lib/mockData';

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
  return `$${val.toFixed(0)}`;
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
  const setStamps = useStampsStore((s) => s.setStamps);
  const setCollectionStats = useStampsStore((s) => s.setCollectionStats);

  const [isLoading, setIsLoading] = useState(true);
  const [stamps, setLocalStamps] = useState<Stamp[]>([]);

  /* Simulate Firestore fetch on mount */
  useEffect(() => {
    const timer = setTimeout(() => {
      setLocalStamps(mockStamps);
      setStamps(mockStamps);
      setCollectionStats(mockCollectionStats);
      setIsLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [setStamps, setCollectionStats]);

  /* Compute rarest stamps sorted by rarity tier */
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

    return [...stamps]
      .sort(
        (a, b) =>
          (rarityOrder[a.identification.rarity] ?? 6) -
          (rarityOrder[b.identification.rarity] ?? 6)
      )
      .slice(0, 8);
  }, [stamps]);

  /* Stats for stat cards */
  const stats = mockCollectionStats;

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
              subtitle="4 added this month"
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
            <ValueTrendChart data={mockValueTrendData} />
            <EraTimeline data={mockEraData} />
          </motion.div>

          {/* ─── Panels Row ──────────────────────────────────── */}
          <motion.div className={styles.panelsRow} variants={itemVariants}>
            <PriceMovers movers={mockPriceMovers} />
            <RarestStamps stamps={rarestStamps} />
            <CompletionTracker sets={mockCompletionSets} />
          </motion.div>

          {/* ─── Recent Uploads ──────────────────────────────── */}
          <motion.div className={styles.recentRow} variants={itemVariants}>
            <RecentUploads stamps={stamps} />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
