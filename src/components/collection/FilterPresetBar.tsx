'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { FilterPreset } from '@/types/collection';
import styles from './FilterPresetBar.module.css';

interface FilterPresetBarProps {
  presets: FilterPreset[];
  activePresetId: string | null;
  onApplyPreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
}

export default function FilterPresetBar({
  presets,
  activePresetId,
  onApplyPreset,
  onDeletePreset,
}: FilterPresetBarProps) {
  if (presets.length === 0) {
    return <div className={styles.empty}>No saved presets</div>;
  }

  return (
    <div className={styles.bar} role="tablist" aria-label="Filter presets">
      {presets.map((preset) => {
        const isActive = preset.id === activePresetId;
        return (
          <motion.button
            key={preset.id}
            className={isActive ? styles.presetActive : styles.preset}
            onClick={() => onApplyPreset(preset.id)}
            role="tab"
            aria-selected={isActive}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            type="button"
          >
            {preset.icon && (
              <span className={styles.presetIcon}>{preset.icon}</span>
            )}
            <span className={styles.presetName}>{preset.name}</span>
            {!preset.isDefault && (
              <span
                className={styles.presetDelete}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePreset(preset.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    onDeletePreset(preset.id);
                  }
                }}
                aria-label={`Delete ${preset.name} preset`}
              >
                ✕
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
