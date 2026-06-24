'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import styles from './ValueTrendChart.module.css';

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

const TIME_RANGES: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];

interface ValueTrendChartProps {
  data: { date: string; value: number }[];
  className?: string;
}

function filterDataByRange(
  data: { date: string; value: number }[],
  range: TimeRange
): { date: string; value: number }[] {
  if (range === 'ALL' || data.length === 0) return data;

  const now = new Date();
  const cutoff = new Date(now);

  switch (range) {
    case '1W':
      cutoff.setDate(cutoff.getDate() - 7);
      break;
    case '1M':
      cutoff.setMonth(cutoff.getMonth() - 1);
      break;
    case '3M':
      cutoff.setMonth(cutoff.getMonth() - 3);
      break;
    case '6M':
      cutoff.setMonth(cutoff.getMonth() - 6);
      break;
    case '1Y':
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      break;
  }

  const filtered = data.filter((d) => new Date(d.date) >= cutoff);
  return filtered.length > 0 ? filtered : data.slice(-2);
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(val < 100 ? 2 : 0)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatTooltipDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipDate}>{formatTooltipDate(label ?? '')}</div>
      <div className={styles.tooltipValue}>
        {formatCurrency(payload[0].value)}
      </div>
    </div>
  );
}

export default function ValueTrendChart({
  data,
  className = '',
}: ValueTrendChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('ALL');

  const filteredData = useMemo(
    () => filterDataByRange(data, selectedRange),
    [data, selectedRange]
  );

  const handleRangeChange = useCallback((range: TimeRange) => {
    setSelectedRange(range);
  }, []);

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>Collection Value</h2>
          <span className={styles.subtitle}>Portfolio performance over time</span>
        </div>

        <div className={styles.tabs}>
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              className={`${styles.tab} ${
                selectedRange === range ? styles.tabActive : ''
              }`}
              onClick={() => handleRangeChange(range)}
              type="button"
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={filteredData}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="goldAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d4a574" stopOpacity={0.25} />
                <stop offset="50%" stopColor="#f5c842" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#d4a574" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="goldStrokeGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#d4a574" />
                <stop offset="100%" stopColor="#f5c842" />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(212, 165, 116, 0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="rgba(138, 133, 120, 0.3)"
              tick={{ fontSize: 11, fill: '#8a8578', fontFamily: 'Inter' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              tickFormatter={formatCurrency}
              stroke="rgba(138, 133, 120, 0.3)"
              tick={{ fontSize: 11, fill: '#8a8578', fontFamily: 'Inter' }}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="url(#goldStrokeGradient)"
              strokeWidth={2}
              fill="url(#goldAreaGradient)"
              animationDuration={800}
              animationEasing="ease-out"
              dot={false}
              activeDot={{
                r: 5,
                fill: '#d4a574',
                stroke: '#0a0a0f',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
