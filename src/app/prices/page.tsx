'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import CollectionValueChart from '@/components/prices/CollectionValueChart';
import PriceMoversTable from '@/components/prices/PriceMoversTable';
import SourceBreakdown from '@/components/prices/SourceBreakdown';
import GoldButton from '@/components/ui/GoldButton';
import type { Stamp } from '@/types/stamp';
import styles from './prices.module.css';

/* ─── Mock Data Generator ────────────────────────────────────────────── */

function generateChartData() {
  const data: { date: string; value: number; avgValue: number }[] = [];
  const now = new Date();
  let baseValue = 12400;

  for (let i = 365; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const drift = (Math.random() - 0.48) * 200;
    baseValue = Math.max(8000, baseValue + drift);
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(baseValue * 100) / 100,
      avgValue: Math.round((baseValue / 87) * 100) / 100,
    });
  }
  return data;
}

function createMockStamp(
  id: string,
  description: string,
  country: string,
  year: number,
  imageUrl: string
): Stamp {
  return {
    id,
    userId: 'user-1',
    imageUrl,
    thumbnailUrl: imageUrl,
    identification: {
      country,
      year,
      denomination: null,
      scottNumber: `SC-${id}`,
      michelNumber: null,
      description,
      condition: 'very_fine',
      rarity: 'rare',
      color: null,
      perforation: null,
      watermark: null,
      series: null,
      confidence: 0.92,
      status: 'identified',
    },
    pricing: {
      estimatedValue: 150,
      currency: 'USD',
      confidence: 0.85,
      sources: [],
      priceRange: { min: 120, max: 200 },
      lastUpdated: new Date().toISOString(),
      hipValue: 145,
      sourceBreakdown: {
        hipstamp: { avg: 145, count: 3 },
        ebay: { avg: 160, min: 120, max: 200, count: 8 },
        delcampe: { avg: 140, count: 2 },
        stampworld: { avg: 155, count: 1 },
      },
    },
    priceHistory: [],
    notes: '',
    tags: [],
    isFavorite: false,
    purchasePrice: null,
    purchaseDate: null,
    grade: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const MOCK_MOVERS = [
  {
    stamp: createMockStamp('1', '1847 5¢ Benjamin Franklin', 'United States', 1847, '/stamps/franklin.jpg'),
    previousValue: 4250.0,
    currentValue: 4890.0,
    change: 640.0,
    changePercent: 15.06,
    source: 'eBay',
  },
  {
    stamp: createMockStamp('2', '1856 British Guiana 1¢ Magenta', 'British Guiana', 1856, '/stamps/guiana.jpg'),
    previousValue: 8750.0,
    currentValue: 9200.0,
    change: 450.0,
    changePercent: 5.14,
    source: 'HipStamp',
  },
  {
    stamp: createMockStamp('3', '1918 Inverted Jenny 24¢', 'United States', 1918, '/stamps/jenny.jpg'),
    previousValue: 1250.0,
    currentValue: 1180.0,
    change: -70.0,
    changePercent: -5.6,
    source: 'Delcampe',
  },
  {
    stamp: createMockStamp('4', '1840 Penny Black', 'Great Britain', 1840, '/stamps/penny.jpg'),
    previousValue: 3200.0,
    currentValue: 3650.0,
    change: 450.0,
    changePercent: 14.06,
    source: 'eBay',
  },
  {
    stamp: createMockStamp('5', '1851 Baden 9 Kreuzer Error', 'Germany', 1851, '/stamps/baden.jpg'),
    previousValue: 980.0,
    currentValue: 920.0,
    change: -60.0,
    changePercent: -6.12,
    source: 'StampWorld',
  },
  {
    stamp: createMockStamp('6', '1855 Treskilling Yellow', 'Sweden', 1855, '/stamps/treskilling.jpg'),
    previousValue: 2100.0,
    currentValue: 2350.0,
    change: 250.0,
    changePercent: 11.9,
    source: 'HipStamp',
  },
  {
    stamp: createMockStamp('7', '1893 Columbian Exposition $5', 'United States', 1893, '/stamps/columbian.jpg'),
    previousValue: 540.0,
    currentValue: 510.0,
    change: -30.0,
    changePercent: -5.56,
    source: 'eBay',
  },
];

const MOCK_SOURCES = [
  { source: 'eBay', count: 142, avgDeviation: 3.2 },
  { source: 'HipStamp', count: 87, avgDeviation: -1.8 },
  { source: 'Delcampe', count: 43, avgDeviation: -4.5 },
  { source: 'StampWorld', count: 28, avgDeviation: 2.1 },
  { source: 'Colnect', count: 15, avgDeviation: 0.8 },
  { source: 'Manual', count: 12, avgDeviation: 0 },
];

/* ─── Page Component ─────────────────────────────────────────────────── */

export default function PricesPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const chartData = useMemo(() => generateChartData(), []);

  const totalValue = 24892.5;
  const totalChange = 2340.0;
  const totalChangePercent = 10.37;
  const stampCount = 87;
  const avgPerStamp = totalValue / stampCount;
  const highestValue = 9200.0;
  const lastUpdated = new Date().toLocaleString();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    setIsRefreshing(false);
  };

  const handleStampClick = (stampId: string) => {
    /* In production, navigate to stamp detail */
    console.log('Navigate to stamp:', stampId);
  };

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <motion.div
        className={styles.pageHeader}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Price Tracker</h1>
          <p className={styles.subtitle}>
            Monitor your collection&apos;s market value in real time
          </p>
        </div>

        <GoldButton
          onClick={handleRefresh}
          loading={isRefreshing}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          }
        >
          {isRefreshing ? 'Refreshing…' : 'Refresh All Prices'}
        </GoldButton>
      </motion.div>

      {/* Value Banner */}
      <motion.div
        className={styles.valueBanner}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className={styles.valueSection}>
          <p className={styles.valueLabel}>Total Collection Value</p>
          <h2 className={styles.valueAmount}>
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h2>
          <div
            className={`${styles.valueTrend} ${
              totalChange >= 0 ? styles.trendUp : styles.trendDown
            }`}
          >
            <span className={styles.trendArrow}>
              {totalChange >= 0 ? '▲' : '▼'}
            </span>
            <span>
              ${Math.abs(totalChange).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              {' '}({totalChangePercent > 0 ? '+' : ''}{totalChangePercent.toFixed(1)}%)
            </span>
            <span className={styles.trendPeriod}>past 30 days</span>
          </div>
        </div>

        <div className={styles.valueStats}>
          <div className={styles.valueStat}>
            <span className={styles.valueStatLabel}>Stamps</span>
            <span className={styles.valueStatAmount}>{stampCount}</span>
          </div>
          <div className={styles.valueStat}>
            <span className={styles.valueStatLabel}>Avg / Stamp</span>
            <span className={styles.valueStatAmount}>
              ${avgPerStamp.toFixed(2)}
            </span>
          </div>
          <div className={styles.valueStat}>
            <span className={styles.valueStatLabel}>Highest</span>
            <span className={styles.valueStatAmount}>
              ${highestValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Collection Value Chart */}
      <motion.div
        className={styles.chartSection}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <CollectionValueChart data={chartData} />
      </motion.div>

      {/* Bottom Grid: Movers + Sources */}
      <motion.div
        className={styles.bottomGrid}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <PriceMoversTable
          movers={MOCK_MOVERS}
          onStampClick={handleStampClick}
        />
        <SourceBreakdown data={MOCK_SOURCES} />
      </motion.div>

      {/* Footer */}
      <div className={styles.lastUpdated}>
        Last updated: {lastUpdated}
      </div>
    </div>
  );
}
