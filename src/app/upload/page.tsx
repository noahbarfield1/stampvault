'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useUIStore } from '@/store/ui';
import { useStampsStore } from '@/store/stamps';
import type { Stamp } from '@/types/stamp';
import type { DetectedStamp, BoundingBox } from '@/components/upload/SegmentationOverlay';
import DropZone from '@/components/upload/DropZone';
import SegmentationOverlay from '@/components/upload/SegmentationOverlay';
import ReviewGrid from '@/components/upload/ReviewGrid';
import IdentificationProgress from '@/components/upload/IdentificationProgress';
import UploadSummary from '@/components/upload/UploadSummary';
import GoldButton from '@/components/ui/GoldButton';
import styles from './upload.module.css';

/* ── Types ─────────────────────────────────────────────────────────────── */

type UploadStep =
  | 'upload'
  | 'segmentation'
  | 'review'
  | 'identification'
  | 'complete';

const STEPS: { key: UploadStep; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'segmentation', label: 'Detect' },
  { key: 'review', label: 'Review' },
  { key: 'identification', label: 'Identify' },
  { key: 'complete', label: 'Complete' },
];

import { VERIFIED_STAMPS, type VerifiedStampMock } from '@/lib/pricing/verified-database';

function generateMockDetections(fileCount: number, files?: File[]): DetectedStamp[] {
  // Check if any file matches our verified stamp database keywords
  const matchedStamp = files && files.reduce<VerifiedStampMock | null>((found, file) => {
    if (found) return found;
    const lowerName = file.name.toLowerCase();
    const match = VERIFIED_STAMPS.find(stamp => 
      stamp.keywords.some(keyword => lowerName.includes(keyword))
    );
    return match || null;
  }, null);

  if (matchedStamp) {
    return [
      {
        id: `det-${matchedStamp.id}`,
        boundingBox: { x: 5, y: 5, width: 90, height: 90 },
        confidence: 0.99,
        croppedImageUrl: '',
        description: matchedStamp.detectedDescription,
        confirmed: false,
        rejected: false,
      }
    ];
  }

  // Fallback to defaults
  const descriptions = [
    'US Inverted Jenny airmail stamp',
    'British Penny Black first issue',
    'Swiss Basel Dove cantonal',
    'Sweden Treskilling Yellow error',
    'Austria Red Mercury newspaper stamp',
    'Mauritius Post Office Blue',
  ];

  const count = Math.min(fileCount * 3, 6);
  return Array.from({ length: count }, (_, i) => ({
    id: `detected-${i}`,
    boundingBox: {
      x: 10 + (i % 3) * 30,
      y: 10 + Math.floor(i / 3) * 40,
      width: 22,
      height: 30,
    },
    confidence: 0.7 + Math.random() * 0.28,
    croppedImageUrl: '',
    description: descriptions[i % descriptions.length],
    confirmed: false,
    rejected: false,
  }));
}

function generateMockIdentifiedStamps(
  detected: DetectedStamp[]
): Partial<Stamp>[] {
  return detected
    .filter((d) => d.confirmed)
    .map((d, i) => {
      // Find matches from VERIFIED_STAMPS database
      const matchedStamp = VERIFIED_STAMPS.find(s => 
        d.id === `det-${s.id}` || d.description.includes(s.scottNumber) || s.keywords.some(k => d.description.toLowerCase().includes(k))
      );

      if (matchedStamp) {
        return {
          id: matchedStamp.id,
          imageUrl: d.croppedImageUrl || matchedStamp.referenceImageUrl,
          identification: {
            country: matchedStamp.country,
            year: matchedStamp.year,
            denomination: matchedStamp.denomination,
            scottNumber: matchedStamp.scottNumber,
            michelNumber: matchedStamp.michelNumber,
            description: matchedStamp.description,
            condition: matchedStamp.condition as any,
            rarity: matchedStamp.rarity as any,
            color: matchedStamp.color,
            perforation: matchedStamp.perforation,
            watermark: matchedStamp.watermark,
            series: matchedStamp.series,
            confidence: d.confidence,
            status: 'identified' as const,
            referenceImageUrl: matchedStamp.referenceImageUrl,
          },
          pricing: {
            estimatedValue: matchedStamp.estimatedValue,
            currency: 'USD',
            confidence: 0.95,
            sources: matchedStamp.sources.map(s => ({
              ...s,
              fetchedAt: new Date().toISOString()
            })),
            priceRange: matchedStamp.priceRange,
            lastUpdated: new Date().toISOString(),
            hipValue: matchedStamp.hipValue,
            sourceBreakdown: matchedStamp.sourceBreakdown,
          },
          priceHistory: matchedStamp.priceHistory,
          tags: matchedStamp.tags,
          notes: matchedStamp.notes,
          isFavorite: false,
          purchasePrice: null,
          purchaseDate: null,
          grade: matchedStamp.grade,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      // Generic fallback
      return {
        id: `identified-${i}`,
        imageUrl: d.croppedImageUrl || '/mock/stamps/placeholder.jpg',
        identification: {
          country: ['United States', 'Great Britain', 'Switzerland', 'Sweden'][
            i % 4
          ],
          year: 1840 + i * 15,
          denomination: ['1d', '24¢', '2½ Rp', '3 Skilling'][i % 4],
          scottNumber: `${i + 1}`,
          michelNumber: `${i + 1}`,
          description: d.description,
          condition: (['fine', 'very_fine', 'used', 'mint'] as const)[i % 4],
          rarity: (['rare', 'very_rare', 'uncommon', 'scarce'] as const)[
            i % 4
          ],
          color: ['Black', 'Blue & Red', 'Multicolor', 'Yellow'][i % 4],
          perforation: i % 2 === 0 ? 'Imperforate' : '11',
          watermark: i % 3 === 0 ? 'Small Crown' : 'None',
          series: ['Line-Engraved', 'Air Mail', 'Cantonal', 'Coat of Arms'][
            i % 4
          ],
          confidence: d.confidence,
          status: 'identified' as const,
          referenceImageUrl: '/mock/stamps/placeholder.jpg',
        },
        pricing: {
          estimatedValue: Math.floor(1000 + Math.random() * 50000),
          currency: 'USD',
          confidence: 0.7 + Math.random() * 0.25,
          sources: [],
          priceRange: { min: 800, max: 60000 },
          lastUpdated: new Date().toISOString(),
          hipValue: null,
          sourceBreakdown: {
            hipstamp: null,
            ebay: null,
            delcampe: null,
            stampworld: null,
          },
        },
        priceHistory: [],
        tags: [],
        notes: '',
        isFavorite: false,
        purchasePrice: null,
        purchaseDate: null,
        grade: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function UploadPage() {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const addStamp = useStampsStore((s) => s.addStamp);

  /* State */
  const [currentStep, setCurrentStep] = useState<UploadStep>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [detectedStamps, setDetectedStamps] = useState<DetectedStamp[]>([]);
  const [identifiedStamps, setIdentifiedStamps] = useState<
    Partial<Stamp>[]
  >([]);
  const [currentIdentificationIndex, setCurrentIdentificationIndex] =
    useState(0);

  /* Step index */
  const stepIndex = useMemo(
    () => STEPS.findIndex((s) => s.key === currentStep),
    [currentStep]
  );

  /* GSAP step transition */
  const animateTransition = useCallback(
    (nextStep: UploadStep) => {
      if (!contentRef.current) {
        setCurrentStep(nextStep);
        return;
      }
      const tl = gsap.timeline();
      tl.to(contentRef.current, {
        opacity: 0,
        y: -20,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          setCurrentStep(nextStep);
        },
      });
      tl.fromTo(
        contentRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
      );
    },
    []
  );

  /* File upload handler */
  const handleFilesSelected = useCallback((files: File[]) => {
    setUploadedFiles(files);
  }, []);

  /* Proceed from upload to segmentation */
  const handleProceedToSegmentation = useCallback(() => {
    const detections = generateMockDetections(uploadedFiles.length, uploadedFiles);
    const fileUrl = uploadedFiles.length > 0 ? URL.createObjectURL(uploadedFiles[0]) : '/mock/stamps/album-page.jpg';
    detections.forEach((d) => {
      d.croppedImageUrl = fileUrl;
    });
    setDetectedStamps(detections);
    animateTransition('segmentation');
  }, [uploadedFiles, animateTransition]);

  /* Adjust bounding box */
  const handleAdjustBox = useCallback(
    (index: number, box: BoundingBox) => {
      setDetectedStamps((prev) =>
        prev.map((s, i) => (i === index ? { ...s, boundingBox: box } : s))
      );
    },
    []
  );

  /* Proceed to review */
  const handleProceedToReview = useCallback(() => {
    animateTransition('review');
  }, [animateTransition]);

  /* Confirm/reject handlers */
  const handleConfirm = useCallback((index: number) => {
    setDetectedStamps((prev) =>
      prev.map((s, i) =>
        i === index
          ? { ...s, confirmed: !s.confirmed, rejected: false }
          : s
      )
    );
  }, []);

  const handleReject = useCallback((index: number) => {
    setDetectedStamps((prev) =>
      prev.map((s, i) =>
        i === index
          ? { ...s, rejected: !s.rejected, confirmed: false }
          : s
      )
    );
  }, []);

  /* Proceed to identification */
  const handleProceedToIdentification = useCallback(() => {
    animateTransition('identification');

    /* Simulate sequential identification */
    const confirmed = detectedStamps.filter((s) => s.confirmed);
    let idx = 0;

    const interval = setInterval(() => {
      if (idx >= confirmed.length) {
        clearInterval(interval);
        setTimeout(() => {
          const finalStamps = generateMockIdentifiedStamps(detectedStamps);
          setIdentifiedStamps(finalStamps);
          animateTransition('complete');
        }, 500);
        return;
      }
      setCurrentIdentificationIndex(idx);
      setIdentifiedStamps((prev) => {
        const newStamp = generateMockIdentifiedStamps(
          detectedStamps.filter((s) => s.confirmed).slice(0, idx + 1)
        );
        return newStamp;
      });
      idx++;
    }, 1200);

    return () => clearInterval(interval);
  }, [detectedStamps, animateTransition]);

  /* Save all */
  const handleSave = useCallback(() => {
    identifiedStamps.forEach((partialStamp) => {
      const fullStamp: Stamp = {
        id: partialStamp.id || `stamp-${Date.now()}-${Math.random()}`,
        userId: 'mock-user',
        imageUrl: partialStamp.imageUrl || '/mock/stamps/placeholder.jpg',
        thumbnailUrl: partialStamp.imageUrl || '/mock/stamps/placeholder.jpg',
        identification: {
          country: partialStamp.identification?.country ?? 'Unknown',
          year: partialStamp.identification?.year ?? null,
          denomination: partialStamp.identification?.denomination ?? null,
          scottNumber: partialStamp.identification?.scottNumber ?? null,
          michelNumber: partialStamp.identification?.michelNumber ?? null,
          description: partialStamp.identification?.description ?? 'Stamp',
          condition: partialStamp.identification?.condition ?? 'unknown',
          rarity: partialStamp.identification?.rarity ?? 'common',
          color: partialStamp.identification?.color ?? null,
          perforation: partialStamp.identification?.perforation ?? null,
          watermark: partialStamp.identification?.watermark ?? null,
          series: partialStamp.identification?.series ?? null,
          confidence: partialStamp.identification?.confidence ?? 0.5,
          status: 'identified',
        },
        pricing: partialStamp.pricing ?? {
          estimatedValue: 0,
          currency: 'USD',
          confidence: 0.5,
          sources: [],
          priceRange: { min: 0, max: 0 },
          lastUpdated: new Date().toISOString(),
          hipValue: null,
          sourceBreakdown: { hipstamp: null, ebay: null, delcampe: null, stampworld: null },
        },
        priceHistory: partialStamp.priceHistory ?? [],
        notes: partialStamp.notes ?? '',
        tags: partialStamp.tags ?? [],
        isFavorite: partialStamp.isFavorite ?? false,
        purchasePrice: partialStamp.purchasePrice ?? null,
        purchaseDate: partialStamp.purchaseDate ?? null,
        grade: partialStamp.grade ?? null,
        createdAt: partialStamp.createdAt ?? new Date().toISOString(),
        updatedAt: partialStamp.updatedAt ?? new Date().toISOString(),
      };
      addStamp(fullStamp);
    });
    router.push('/collection');
  }, [identifiedStamps, addStamp, router]);

  /* Update stamp metadata */
  const handleUpdateStamp = useCallback((index: number, updated: Partial<Stamp>) => {
    setIdentifiedStamps((prev) => {
      const copy = [...prev];
      copy[index] = updated;
      return copy;
    });
  }, []);

  /* Delete stamp from queue */
  const handleDeleteStamp = useCallback((index: number) => {
    setIdentifiedStamps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* Cancel */
  const handleCancel = useCallback(() => {
    setCurrentStep('upload');
    setUploadedFiles([]);
    setDetectedStamps([]);
    setIdentifiedStamps([]);
    setCurrentIdentificationIndex(0);
  }, []);

  /* Go back */
  const handleBack = useCallback(() => {
    switch (currentStep) {
      case 'segmentation':
        animateTransition('upload');
        break;
      case 'review':
        animateTransition('segmentation');
        break;
      case 'identification':
        animateTransition('review');
        break;
      case 'complete':
        animateTransition('review');
        break;
      default:
        break;
    }
  }, [currentStep, animateTransition]);

  /* Preview URL from first uploaded file */
  const previewUrl = useMemo(() => {
    if (uploadedFiles.length > 0) {
      return URL.createObjectURL(uploadedFiles[0]);
    }
    return '/mock/stamps/album-page.jpg';
  }, [uploadedFiles]);

  /* Confirmed count */
  const confirmedCount = detectedStamps.filter((s) => s.confirmed).length;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Upload Stamps</h1>

      {/* Step Indicator */}
      <div className={styles.steps}>
        {STEPS.map((step, index) => {
          const isCompleted = index < stepIndex;
          const isActive = index === stepIndex;

          let circleClass = styles.stepCirclePending;
          let labelClass = styles.stepLabelPending;

          if (isCompleted) {
            circleClass = styles.stepCircleCompleted;
            labelClass = styles.stepLabelCompleted;
          } else if (isActive) {
            circleClass = styles.stepCircleActive;
            labelClass = styles.stepLabelActive;
          }

          return (
            <React.Fragment key={step.key}>
              {index > 0 && (
                <div
                  className={
                    isCompleted || isActive
                      ? styles.connectorCompleted
                      : styles.connectorPending
                  }
                />
              )}
              <div className={styles.step}>
                <div className={circleClass}>
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span className={labelClass}>{step.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <div className={styles.content} ref={contentRef}>
        {currentStep === 'upload' && (
          <div className={styles.stepContent}>
            <DropZone onFilesSelected={handleFilesSelected} />
            {uploadedFiles.length > 0 && (
              <div className={styles.nav}>
                <div />
                <GoldButton onClick={handleProceedToSegmentation}>
                  Detect Stamps →
                </GoldButton>
              </div>
            )}
          </div>
        )}

        {currentStep === 'segmentation' && (
          <div className={styles.stepContent}>
            <SegmentationOverlay
              imageUrl={previewUrl}
              detectedStamps={detectedStamps}
              onAdjust={handleAdjustBox}
            />
            <div className={styles.nav}>
              <button
                className={styles.navBackBtn}
                onClick={handleBack}
                type="button"
              >
                ← Back
              </button>
              <GoldButton onClick={handleProceedToReview}>
                Review {detectedStamps.length} Stamps →
              </GoldButton>
            </div>
          </div>
        )}

        {currentStep === 'review' && (
          <div className={styles.stepContent}>
            <ReviewGrid
              stamps={detectedStamps}
              onConfirm={handleConfirm}
              onReject={handleReject}
            />
            <div className={styles.nav}>
              <button
                className={styles.navBackBtn}
                onClick={handleBack}
                type="button"
              >
                ← Back
              </button>
              <GoldButton
                onClick={handleProceedToIdentification}
                disabled={confirmedCount === 0}
              >
                Identify {confirmedCount} Stamps →
              </GoldButton>
            </div>
          </div>
        )}

        {currentStep === 'identification' && (
          <div className={styles.stepContent}>
            <IdentificationProgress
              stamps={detectedStamps.filter((s) => s.confirmed)}
              identifiedStamps={identifiedStamps}
              currentIndex={currentIdentificationIndex}
            />
          </div>
        )}

        {currentStep === 'complete' && (
          <div className={styles.stepContent}>
            <UploadSummary
              stamps={identifiedStamps}
              onSave={handleSave}
              onCancel={handleCancel}
              onUpdateStamp={handleUpdateStamp}
              onDeleteStamp={handleDeleteStamp}
            />
          </div>
        )}
      </div>
    </div>
  );
}
