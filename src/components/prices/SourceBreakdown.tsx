'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import styles from './SourceBreakdown.module.css';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface SourceData {
  source: string;
  count: number;
  avgDeviation: number;
}

interface SourceBreakdownProps {
  data: SourceData[];
  className?: string;
}

/* ─── Source Colors ───────────────────────────────────────────────────── */

const SOURCE_COLORS: Record<string, string> = {
  hipstamp: '#d4a574',
  ebay: '#f5c842',
  delcampe: '#10b981',
  stampworld: '#3b82f6',
  colnect: '#8b5cf6',
  manual: '#06b6d4',
};

function getSourceColor(source: string): string {
  return SOURCE_COLORS[source.toLowerCase()] || '#f97316';
}

/* ─── Custom Tooltip ─────────────────────────────────────────────────── */

interface TooltipPayloadEntry {
  name: string;
  value: number;
  payload: SourceData & { fill: string };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipName}>{entry.name}</div>
      <div className={styles.tooltipCount}>
        {entry.value} listing{entry.value !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export default function SourceBreakdown({
  data,
  className = '',
}: SourceBreakdownProps) {
  const chartData = data.map((d) => ({
    ...d,
    name: d.source,
    fill: getSourceColor(d.source),
  }));

  const totalCount = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className={`${styles.container} ${className}`}>
      <h3 className={styles.title}>Pricing Sources</h3>

      {/* Donut Chart */}
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={3}
              dataKey="count"
              nameKey="source"
              stroke="none"
              animationDuration={800}
              animationEasing="ease-out"
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.source}
                  fill={entry.fill}
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                />
              ))}
            </Pie>
            <RechartsTooltip content={<CustomTooltip />} />
            {/* Center label */}
            <text
              x="50%"
              y="46%"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#e8e4dd"
              fontSize={24}
              fontWeight={700}
              fontFamily="'Playfair Display', serif"
            >
              {totalCount}
            </text>
            <text
              x="50%"
              y="58%"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#8a8578"
              fontSize={11}
              fontFamily="Inter, sans-serif"
              letterSpacing="0.05em"
            >
              SOURCES
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {data.map((item) => {
          const deviationClass =
            item.avgDeviation > 0
              ? styles.deviationPositive
              : item.avgDeviation < 0
                ? styles.deviationNegative
                : styles.deviationNeutral;

          return (
            <div key={item.source} className={styles.legendItem}>
              <div
                className={styles.legendDot}
                style={{ backgroundColor: getSourceColor(item.source) }}
              />
              <div className={styles.legendInfo}>
                <span className={styles.legendName}>{item.source}</span>
                <div className={styles.legendMeta}>
                  <span className={styles.legendCount}>
                    {item.count}
                  </span>
                  <span className={deviationClass}>
                    {item.avgDeviation > 0 ? '+' : ''}
                    {item.avgDeviation.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
