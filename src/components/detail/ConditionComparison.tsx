'use client';

import React from 'react';
import type { StampCondition } from '@/types/stamp';
import styles from './ConditionComparison.module.css';

/* ── Condition definitions ─────────────────────────────────────────────── */

interface ConditionDef {
  key: StampCondition;
  label: string;
  shortLabel: string;
  description: string;
}

const CONDITIONS: ConditionDef[] = [
  {
    key: 'poor',
    label: 'Poor',
    shortLabel: 'P',
    description:
      'Heavily damaged, torn, or missing perforations. Significant faults.',
  },
  {
    key: 'used',
    label: 'Used',
    shortLabel: 'U',
    description:
      'Cancelled stamp, may have minor faults. Typical postal use appearance.',
  },
  {
    key: 'fine',
    label: 'Fine',
    shortLabel: 'F',
    description:
      'Clear design, reasonably well-centered. Minor imperfections possible.',
  },
  {
    key: 'very_fine',
    label: 'Very Fine',
    shortLabel: 'VF',
    description:
      'Well-centered with full perforations. Clean and attractive appearance.',
  },
  {
    key: 'unused',
    label: 'Unused',
    shortLabel: 'UN',
    description:
      'Not postally used, but may lack gum. No cancellation marks present.',
  },
  {
    key: 'mint',
    label: 'Mint',
    shortLabel: 'M',
    description:
      'Original gum present (may have hinge marks). Excellent condition overall.',
  },
  {
    key: 'mint_nh',
    label: 'Mint NH',
    shortLabel: 'MNH',
    description:
      'Mint Never Hinged. Full original gum, no hinge marks whatsoever.',
  },
  {
    key: 'superb',
    label: 'Superb',
    shortLabel: 'S',
    description:
      'Perfect centering, pristine gum, flawless margins. Museum quality.',
  },
];

/* ── Props ─────────────────────────────────────────────────────────────── */

interface ConditionComparisonProps {
  currentCondition: StampCondition;
  stampType: string;
}

export default function ConditionComparison({
  currentCondition,
  stampType,
}: ConditionComparisonProps) {
  const activeCondition = CONDITIONS.find((c) => c.key === currentCondition);
  const activeIndex = CONDITIONS.findIndex((c) => c.key === currentCondition);

  return (
    <div className={styles.wrapper}>
      <h4 className={styles.title}>Condition Grade</h4>

      {/* Scale */}
      <div className={styles.scale}>
        {CONDITIONS.map((condition, index) => {
          const isActive = condition.key === currentCondition;
          return (
            <div key={condition.key} className={styles.scaleItem}>
              {isActive && <div className={styles.marker} />}
              <div
                className={
                  index <= activeIndex
                    ? styles.scaleBarActive
                    : styles.scaleBarInactive
                }
              />
              <span
                className={
                  isActive
                    ? styles.scaleLabelActive
                    : styles.scaleLabelInactive
                }
              >
                {condition.shortLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Description */}
      {activeCondition && (
        <div className={styles.description}>
          <p className={styles.descriptionTitle}>
            {activeCondition.label} — {stampType}
          </p>
          <p className={styles.descriptionText}>
            {activeCondition.description}
          </p>
        </div>
      )}
    </div>
  );
}
