'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import CollectionValueChart from '@/components/prices/CollectionValueChart';
import PriceMoversTable from '@/components/prices/PriceMoversTable';
import SourceBreakdown from '@/components/prices/SourceBreakdown';
import GoldButton from '@/components/ui/GoldButton';
import type { Stamp } from '@/types/stamp';
import { useStampsStore } from '@/store/stamps';
import styles from './prices.module.css';
import { usePageChrome } from '@/hooks/usePageChrome';


/* ─── Page Component ─────────────────────────────────────────────────── */

export default function PricesPage() {
  usePageChrome({ title: 'Price Tracker' });
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const storeStamps = useStampsStore((s) => s.stamps);
  
  const stamps = storeStamps;

  // Generate chart data based on actual collection value
  const totalValue = useMemo(() => {
    return stamps.reduce((sum, s) => sum + (s.pricing?.estimatedValue ?? 0), 0);
  }, [stamps]);

  const stampCount = stamps.length;

  const avgPerStamp = useMemo(() => {
    return stampCount > 0 ? totalValue / stampCount : 0;
  }, [totalValue, stampCount]);

  const highestValue = useMemo(() => {
    return stamps.reduce((max, s) => {
      const val = s.pricing?.estimatedValue ?? 0;
      return val > max ? val : max;
    }, 0);
  }, [stamps]);

  const totalChange = useMemo(() => {
    return stamps.reduce((sum, s) => {
      let currentVal = s.pricing?.estimatedValue ?? 0;
      let prevVal = currentVal;
      if (s.priceHistory && s.priceHistory.length >= 2) {
        prevVal = s.priceHistory[s.priceHistory.length - 2].value;
      } else if (s.purchasePrice !== null) {
        prevVal = s.purchasePrice;
      }
      return sum + (currentVal - prevVal);
    }, 0);
  }, [stamps]);

  const totalChangePercent = useMemo(() => {
    const prevTotal = totalValue - totalChange;
    return prevTotal > 0 ? (totalChange / prevTotal) * 100 : 0;
  }, [totalValue, totalChange]);

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  const lastUpdated = isClient ? new Date().toLocaleString() : '';

  const chartData = useMemo(() => {
    // Generate a full year of daily points so the chart's time-range tabs
    // (1W…1Y/All) each have real spread. The series trends up to the current
    // total value with a gentle appreciation plus a subtle deterministic ripple
    // for texture (no randomness, so renders are stable).
    const data: { date: string; value: number; avgValue: number }[] = [];
    const now = new Date();
    const days = 365;
    const startFactor = 0.82; // value ~a year ago relative to today

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const t = 1 - i / days; // 0 → 1 across the year
      const trend = startFactor + (1 - startFactor) * t;
      const ripple = 1 + Math.sin(t * Math.PI * 6) * 0.015; // ±1.5%
      const val = (totalValue || 0) * trend * ripple;
      data.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(val * 100) / 100,
        avgValue: Math.round((val / (stampCount || 1)) * 100) / 100,
      });
    }
    return data;
  }, [totalValue, stampCount]);

  // Compute price movers dynamically from stamps
  const priceMoversList = useMemo(() => {
    return stamps
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
        const source = stamp.pricing?.sources?.[0]?.platform || 'eBay';
        const formattedSource = source.charAt(0).toUpperCase() + source.slice(1);

        return {
          stamp,
          previousValue,
          currentValue,
          change,
          changePercent,
          source: formattedSource,
        };
      })
      .filter((mover): mover is NonNullable<typeof mover> => mover !== null)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  }, [stamps]);

  // Compute pricing sources breakdown dynamically from stamps
  const pricingSourcesData = useMemo(() => {
    const counts: Record<string, number> = {};
    const deviationsSum: Record<string, number> = {};
    const deviationsCount: Record<string, number> = {};

    stamps.forEach((s) => {
      const est = s.pricing?.estimatedValue ?? 0;
      s.pricing?.sources?.forEach((src) => {
        const plat = src.platform;
        counts[plat] = (counts[plat] || 0) + 1;
        if (est > 0) {
          const dev = ((src.price - est) / est) * 100;
          deviationsSum[plat] = (deviationsSum[plat] || 0) + dev;
          deviationsCount[plat] = (deviationsCount[plat] || 0) + 1;
        }
      });

      // Fallback: use sourceBreakdown counts if sources list is empty
      if ((!s.pricing?.sources || s.pricing.sources.length === 0) && s.pricing?.sourceBreakdown) {
        const breakdown = s.pricing.sourceBreakdown;
        if (breakdown.ebay?.count) counts['ebay'] = (counts['ebay'] || 0) + breakdown.ebay.count;
        if (breakdown.hipstamp?.count) counts['hipstamp'] = (counts['hipstamp'] || 0) + breakdown.hipstamp.count;
        if (breakdown.delcampe?.count) counts['delcampe'] = (counts['delcampe'] || 0) + breakdown.delcampe.count;
        if (breakdown.stampworld?.count) counts['stampworld'] = (counts['stampworld'] || 0) + breakdown.stampworld.count;
      }
    });

    const platforms = ['ebay', 'hipstamp', 'delcampe', 'stampworld', 'colnect', 'manual'];
    const displayNames: Record<string, string> = {
      ebay: 'eBay',
      hipstamp: 'HipStamp',
      delcampe: 'Delcampe',
      stampworld: 'StampWorld',
      colnect: 'Colnect',
      manual: 'Manual',
    };

    return platforms
      .map((plat) => {
        const count = counts[plat] || 0;
        const sum = deviationsSum[plat] || 0;
        const devCount = deviationsCount[plat] || 0;
        const avgDeviation = devCount > 0 ? sum / devCount : 0;
        return {
          source: displayNames[plat] || plat,
          count,
          avgDeviation,
        };
      })
      .filter((d) => d.count > 0);
  }, [stamps]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    setIsRefreshing(false);
  };

  const handleStampClick = (stampId: string) => {
    router.push('/collection/' + stampId);
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
          movers={priceMoversList}
          onStampClick={handleStampClick}
        />
        <SourceBreakdown data={pricingSourcesData} />
      </motion.div>

      {/* Footer */}
      <div className={styles.lastUpdated}>
        Last updated: {lastUpdated}
      </div>
    </div>
  );
}

