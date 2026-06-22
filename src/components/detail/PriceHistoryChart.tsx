'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { PriceHistoryEntry } from '@/types/stamp';
import styles from './PriceHistoryChart.module.css';

/* ── Types ─────────────────────────────────────────────────────────────── */

interface PricePoint extends PriceHistoryEntry {}

interface PriceHistoryChartProps {
  data: PricePoint[];
  className?: string;
}

type TimeRange = '3m' | '6m' | '1y' | 'all';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
];

/* ── Custom tooltip ────────────────────────────────────────────────────── */

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: PricePoint;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipDate}>
        {new Date(point.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
        })}
      </p>
      <p className={styles.tooltipValue}>
        ${point.value.toLocaleString()}
      </p>
      <p className={styles.tooltipSources}>
        {point.sources} source{point.sources !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

/* ── Tick formatter ────────────────────────────────────────────────────── */

function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function formatXAxis(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function PriceHistoryChart({
  data,
  className = '',
}: PriceHistoryChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  const filteredData = useMemo(() => {
    if (timeRange === 'all') return data;
    const now = new Date();
    const months = timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1);
    return data.filter((d) => new Date(d.date) >= cutoff);
  }, [data, timeRange]);

  if (data.length === 0) {
    return (
      <div className={`${styles.chartWrapper} ${className}`}>
        <div className={styles.header}>
          <h4 className={styles.title}>Price History</h4>
        </div>
        <div className={styles.empty}>No price history data</div>
      </div>
    );
  }

  return (
    <div className={`${styles.chartWrapper} ${className}`}>
      <div className={styles.header}>
        <h4 className={styles.title}>Price History</h4>
        <div className={styles.timeRange}>
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              className={
                timeRange === range.value
                  ? styles.timeBtnActive
                  : styles.timeBtn
              }
              onClick={() => setTimeRange(range.value)}
              type="button"
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={filteredData}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(212, 165, 116, 0.08)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              tick={{ fill: '#8a8578', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(212, 165, 116, 0.12)' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fill: '#8a8578', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={65}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#d4a574"
              strokeWidth={2}
              dot={{
                r: 4,
                fill: '#0a0a0f',
                stroke: '#d4a574',
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: '#f5c842',
                stroke: '#d4a574',
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
