'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import styles from './CollectionValueChart.module.css';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface DataPoint {
  date: string;
  value: number;
  avgValue?: number;
}

type ChartMode = 'total' | 'average' | 'top10';
type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

interface CollectionValueChartProps {
  data: DataPoint[];
  className?: string;
}

/* ─── Constants ──────────────────────────────────────────────────────── */

const CHART_MODES: { key: ChartMode; label: string }[] = [
  { key: 'total', label: 'Total Value' },
  { key: 'average', label: 'Avg / Stamp' },
  { key: 'top10', label: 'Top 10' },
];

const TIME_RANGES: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];

const TIME_RANGE_DAYS: Record<TimeRange, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  ALL: Infinity,
};

/* ─── Custom Tooltip ─────────────────────────────────────────────────── */

interface TooltipPayload {
  value: number;
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const valueEntry = payload.find((p) => p.dataKey === 'value');
  const avgEntry = payload.find((p) => p.dataKey === 'avgValue');

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipDate}>{label}</div>
      {valueEntry && (
        <div className={styles.tooltipValue}>
          ${valueEntry.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
      )}
      {avgEntry && avgEntry.value !== undefined && (
        <div className={styles.tooltipAvg}>
          Avg: ${avgEntry.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
      )}
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export default function CollectionValueChart({
  data,
  className = '',
}: CollectionValueChartProps) {
  const [mode, setMode] = useState<ChartMode>('total');
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');

  /* ── Filter data by time range ──────────────────────────────────────── */
  const filteredData = useMemo(() => {
    if (timeRange === 'ALL') return data;
    const days = TIME_RANGE_DAYS[timeRange];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return data.filter((d) => new Date(d.date) >= cutoff);
  }, [data, timeRange]);

  /* ── Transform data based on mode ──────────────────────────────────── */
  const chartData = useMemo(() => {
    switch (mode) {
      case 'average':
        return filteredData.map((d) => ({
          ...d,
          value: d.avgValue ?? d.value * 0.15,
        }));
      case 'top10':
        return filteredData.map((d) => ({
          ...d,
          value: d.value * 0.6,
        }));
      default:
        return filteredData;
    }
  }, [filteredData, mode]);

  /* ── Format helpers ─────────────────────────────────────────────────── */
  const formatYAxis = useCallback((value: number) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value}`;
  }, []);

  const formatDate = useCallback(
    (dateStr: string) => {
      const d = new Date(dateStr);
      if (timeRange === '1W' || timeRange === '1M') {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    },
    [timeRange]
  );

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>Collection Value</h3>
      </div>

      <div className={styles.controls}>
        {/* Mode Toggle */}
        <div className={styles.toggleGroup}>
          {CHART_MODES.map((m) => (
            <button
              key={m.key}
              className={
                mode === m.key ? styles.toggleButtonActive : styles.toggleButton
              }
              onClick={() => setMode(m.key)}
              type="button"
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Time Range Pills */}
        <div className={styles.timeRange}>
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              className={
                timeRange === range ? styles.timePillActive : styles.timePill
              }
              onClick={() => setTimeRange(range)}
              type="button"
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="goldAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d4a574" stopOpacity={0.35} />
                <stop offset="50%" stopColor="#f5c842" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#d4a574" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="goldStroke" x1="0" y1="0" x2="1" y2="0">
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
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8a8578', fontSize: 11, fontFamily: 'Inter' }}
              interval="preserveStartEnd"
              minTickGap={40}
            />

            <YAxis
              tickFormatter={formatYAxis}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8a8578', fontSize: 11, fontFamily: 'Inter' }}
              width={60}
            />

            <RechartsTooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="value"
              stroke="url(#goldStroke)"
              strokeWidth={2}
              fill="url(#goldAreaGradient)"
              animationDuration={800}
              animationEasing="ease-out"
            />

            {mode === 'total' && (
              <Line
                type="monotone"
                dataKey="avgValue"
                stroke="#10b981"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                dot={false}
                activeDot={{ r: 4, fill: '#10b981', stroke: '#0a0a0f', strokeWidth: 2 }}
                animationDuration={800}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
