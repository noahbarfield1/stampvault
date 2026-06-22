'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import styles from './EraTimeline.module.css';

interface EraTimelineProps {
  data: { era: string; count: number }[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { era: string; count: number } }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const { era, count } = payload[0].payload;

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipEra}>{era}</div>
      <span className={styles.tooltipCount}>{count}</span>
      <span className={styles.tooltipCountLabel}>
        {count === 1 ? 'stamp' : 'stamps'}
      </span>
    </div>
  );
}

export default function EraTimeline({ data }: EraTimelineProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Stamps by Era</h3>
        <p className={styles.subtitle}>Distribution across decades</p>
      </div>

      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 32, left: -12, bottom: 8 }}
          >
            <defs>
              <linearGradient id="barGoldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f5c842" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#d4a574" stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(212, 165, 116, 0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="era"
              stroke="rgba(138, 133, 120, 0.3)"
              tick={{ fontSize: 10, fill: '#8a8578', fontFamily: 'Inter' }}
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={50}
            />
            <YAxis
              allowDecimals={false}
              stroke="rgba(138, 133, 120, 0.3)"
              tick={{ fontSize: 11, fill: '#8a8578', fontFamily: 'Inter' }}
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(212, 165, 116, 0.06)' }}
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              animationDuration={800}
              animationEasing="ease-out"
              maxBarSize={36}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.era}
                  fill={
                    entry.count > 0
                      ? 'url(#barGoldGradient)'
                      : 'rgba(138, 133, 120, 0.15)'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
