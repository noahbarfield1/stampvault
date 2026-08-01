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
    description: 'Welcome. This screen summarises your collection: how many stamps, what they are worth on current estimates, what you added recently, and how they spread across eras.',
  },
  {
    title: 'Smart Collection Browser',
    path: '/collection',
    description: 'Browse your stamps in a masonry grid or sorting table. Use the dynamic filter builder to isolate stamps by country, year, or Scott number, and save filter combinations as presets.',
  },
  {
    title: 'AI Upload & Crop Pipeline',
    path: '/upload',
    description: 'Photograph a whole album page or one stamp at a time. Detected stamps arrive already selected — tap any you do not want, pinch to zoom, and press the pencil to fine-tune a box.',
  },
  {
    title: 'Live Price Tracker',
    path: '/prices',
    description: 'Estimates are aggregated from real eBay listings scraped when you ask, with outliers removed and a link to every listing used. Values are a starting point, not an appraisal.',
  },
  {
    title: 'Conversational AI Assistant',
    path: '/assistant',
    description: 'Ask about a catalog number, a grading question, or anything you are unsure of. Reachable any time from the More menu.',
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

  // Push route when tour step changes
  useEffect(() => {
    if (tourActive && TOUR_STEPS[tourStep]) {
      router.push(TOUR_STEPS[tourStep].path);
    }
  }, [tourActive, tourStep, router]);

  // End tour if user navigates away manually
  useEffect(() => {
    if (tourActive && TOUR_STEPS[tourStep]) {
      if (pathname !== TOUR_STEPS[tourStep].path) {
        endTour();
      }
    }
  }, [pathname]); // Only depend on pathname so we detect manual clicks

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
            <div className={styles.topActions}>
              <span className={styles.stepCounter}>
                Step {tourStep + 1} of {TOUR_STEPS.length}
              </span>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={endTour}
                aria-label="Close tutorial"
              >
                ✕
              </button>
            </div>
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
