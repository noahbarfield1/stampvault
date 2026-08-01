'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Stamp } from '@/types/stamp';
import GoldButton from '@/components/ui/GoldButton';
import styles from './EditStampModal.module.css';

interface EditStampModalProps {
  isOpen: boolean;
  onClose: () => void;
  stamp: Partial<Stamp> | null;
  onSave: (updatedStamp: Partial<Stamp>) => void;
}

export default function EditStampModal({ isOpen, onClose, stamp, onSave }: EditStampModalProps) {
  const [formData, setFormData] = useState<Partial<Stamp['identification']>>({});
  const [priceOverride, setPriceOverride] = useState<string>('');

  useEffect(() => {
    if (stamp?.identification) {
      setFormData(stamp.identification);
    }
    if (stamp?.pricing?.estimatedValue != null) {
      setPriceOverride(stamp.pricing.estimatedValue.toString());
    }
  }, [stamp]);

  if (!isOpen || !stamp) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    const updated = {
      ...stamp,
      identification: {
        ...stamp.identification,
        ...formData,
      } as any,
      pricing: {
        ...stamp.pricing,
        estimatedValue: parseFloat(priceOverride) || stamp.pricing?.estimatedValue || 0,
      } as any,
    };
    onSave(updated);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.header}>
            <h2>Edit Metadata</h2>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
          
          <div className={styles.body}>
            <div className={styles.fieldGroup}>
              <label>Scott Number</label>
              <input
                type="text"
                name="scottNumber"
                value={formData.scottNumber || ''}
                onChange={handleChange}
                placeholder="e.g., C3a"
                className={styles.input}
              />
            </div>
            <div className={styles.row}>
              <div className={styles.fieldGroup}>
                <label>Country</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country || ''}
                  onChange={handleChange}
                  className={styles.input}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label>Year</label>
                <input
                  type="number"
                  name="year"
                  value={formData.year || ''}
                  onChange={handleChange}
                  className={styles.input}
                />
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label>Condition</label>
              <select name="condition" value={formData.condition || ''} onChange={handleChange} className={styles.input}>
                <option value="mint">Mint</option>
                <option value="mint_nh">Mint (Never Hinged)</option>
                <option value="unused">Unused</option>
                <option value="used">Used</option>
                <option value="fine">Fine</option>
                <option value="very_fine">Very Fine</option>
                <option value="superb">Superb</option>
                <option value="poor">Poor</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label>Estimated Value (USD)</label>
              <input
                type="number"
                name="price"
                value={priceOverride}
                onChange={(e) => setPriceOverride(e.target.value)}
                className={styles.input}
              />
            </div>
            <p className={styles.hint}>
              Changes are saved to this stamp only — pricing sources are not re-fetched.
            </p>
          </div>
          
          <div className={styles.footer}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <GoldButton onClick={handleSave}>Save Changes</GoldButton>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
