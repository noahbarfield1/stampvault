'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/ui';
import styles from './GuidedTour.module.css';

interface TourStep {
  title: string;
  path: string;
  description: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Dashboard Command Center',
    path: '/dashboard',
    description: 'Welcome to StampVault! This screen displays your collection health metrics, total portfolio estimated value, recent additions, and your stamp distribution across historical eras.',
  },
  {
    title: 'Smart Collection Browser',
    path: '/collection',
    description: 'Browse your stamps in a masonry grid or sorting table. Use the dynamic filter builder to isolate stamps by country, year, or Scott number, and save filter combinations as presets.',
  },
  {
    title: 'AI Upload & Crop Pipeline',
    path: '/upload',
    description: 'Bulk upload album pages or individual photos. Our segmentation engine detects stamp boundaries, and our Gemini vision model matches them with Scott catalog photos side-by-side.',
  },
  {
    title: 'Live Price Tracker',
    path: '/prices',
    description: 'Analyze value fluctuations over time. Review pricing details aggregated in real-time from eBay sold listings, active HipStamp listings, and historical auction values.',
  },
  {
    title: 'Conversational AI Assistant',
    path: '/assistant',
    description: 'Interact with our context-aware stamp assistant. Ask questions about specific catalog numbers, grade certification requirements, or upload photos of mystery items.',
  },
];

export default function GuidedTour() {
  const router = useRouter();
  const pathname = usePathname();

  const tourActive = useUIStore((s) => s.tourActive);
  const tourStep = useUIStore((s) => s.tourStep);
  const tourDisabled = useUIStore((s) => s.tourDisabled);
  const startTour = useUIStore((s) => s.startTour);
  const nextTourStep = useUIStore((s) => s.nextTourStep);
  const prevTourStep = useUIStore((s) => s.prevTourStep);
  const endTour = useUIStore((s) => s.endTour);
  const setTourDisabled = useUIStore((s) => s.setTourDisabled);

  // Trigger tour start on first visit if not disabled
  useEffect(() => {
    // If not active and not disabled, trigger start after a small delay
    if (!tourActive && !tourDisabled && pathname === '/dashboard') {
      const timer = setTimeout(() => {
        startTour();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [tourActive, tourDisabled, pathname, startTour]);

  // Sync route on step change
  useEffect(() => {
    if (tourActive && TOUR_STEPS[tourStep]) {
      const targetPath = TOUR_STEPS[tourStep].path;
      if (pathname !== targetPath) {
        router.push(targetPath);
      }
    }
  }, [tourActive, tourStep, pathname, router]);

  if (!tourActive) {
    return null;
  }

  const currentStepData = TOUR_STEPS[tourStep];
  if (!currentStepData) return null;

  const handleNext = () => {
    if (tourStep < TOUR_STEPS.length - 1) {
      nextTourStep();
    } else {
      endTour();
    }
  };

  const handlePrev = () => {
    if (tourStep > 0) {
      prevTourStep();
    }
  };

  const handleDisableToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const disabled = e.target.checked;
    setTourDisabled(disabled);
    if (disabled) {
      endTour();
    }
  };

  return (
    <AnimatePresence>
      <div className={styles.tourOverlay}>
        <motion.div
          className={styles.tourCard}
          initial={{ scale: 0.95, y: 10, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 10, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {/* Progress Indicator */}
          <div className={styles.progressRow}>
            <span className={styles.badge}>Guided Tour</span>
            <span className={styles.stepCounter}>
              Step {tourStep + 1} of {TOUR_STEPS.length}
            </span>
          </div>

          {/* Step Content */}
          <div className={styles.body}>
            <h4 className={styles.stepTitle}>{currentStepData.title}</h4>
            <p className={styles.stepDescription}>{currentStepData.description}</p>
          </div>

          {/* Action Buttons */}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.skipBtn}
              onClick={endTour}
            >
              Skip Tour
            </button>
            <div className={styles.navButtons}>
              {tourStep > 0 && (
                <button
                  type="button"
                  className={styles.prevBtn}
                  onClick={handlePrev}
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                className={styles.nextBtn}
                onClick={handleNext}
              >
                {tourStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next →'}
              </button>
            </div>
          </div>

          {/* Disable Checkbox Option */}
          <div className={styles.footer}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={tourDisabled}
                onChange={handleDisableToggle}
                className={styles.checkboxInput}
              />
              <span className={styles.checkboxText}>
                Disable tutorial walk-through tips globally
              </span>
            </label>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
