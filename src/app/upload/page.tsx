'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useUIStore } from '@/store/ui';
import { useStampsStore } from '@/store/stamps';
import { useUploadSession, STEPS, type UploadStep } from '@/store/uploadSession';
import type { Stamp } from '@/types/stamp';
import type { BoundingBox, DetectedStamp } from '@/types/upload';
import DropZone from '@/components/upload/DropZone';
import StampSelectStep from '@/components/upload/select/StampSelectStep';
import IdentificationProgress from '@/components/upload/IdentificationProgress';
import UploadSummary from '@/components/upload/UploadSummary';
import GoldButton from '@/components/ui/GoldButton';
import {
  resizeImageForUpload,
  createCropper,
  makeThumbnail,
  nextFrame,
  SEGMENT_MAX_DIMENSION,
  SEGMENT_QUALITY,
} from '@/lib/upload/image-pipeline';
import { segmentImage, describeSegmentFailure, type SegmentOutcome } from '@/lib/upload/segment-client';
import { identifyStamp, isIdentified, lookupPricing } from '@/lib/upload/identify-client';
import { buildIdentifiedStamp, buildFailedStamp, toFullStamp } from '@/lib/upload/to-stamp';
import styles from './upload.module.css';

export default function UploadPage() {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const addStamp = useStampsStore((s) => s.addStamp);
  const addToast = useUIStore((s) => s.addToast);

  const session = useUploadSession();
  const {
    step,
    mode,
    files,
    sheetImageDataUrl,
    detections,
    identified,
    identifyIndex,
    hasHydrated,
    restoreWarning,
  } = session;

  const [isDetecting, setIsDetecting] = useState(false);
  const [cropProgress, setCropProgress] = useState<string | null>(null);
  const [segmentError, setSegmentError] = useState<SegmentOutcome | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stepIndex = useMemo(() => STEPS.findIndex((s) => s.key === step), [step]);
  const selected = useMemo(() => detections.filter((d) => d.confirmed), [detections]);

  /* A restored session that lost its photo explains itself once, then clears. */
  useEffect(() => {
    if (restoreWarning) {
      addToast({ type: 'warning', title: 'Upload not restored', message: restoreWarning });
      session.clearRestoreWarning();
    }
  }, [restoreWarning, addToast, session]);

  /* Warn before navigating away mid-flow. Minutes of AI work are at stake. */
  useEffect(() => {
    if (step === 'upload' || step === 'complete') return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [step]);

  /* Abort any in-flight AI work if the page unmounts. */
  useEffect(() => () => abortRef.current?.abort(), []);

  const animateTransition = useCallback(
    (next: UploadStep) => {
      const el = contentRef.current;
      if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        session.setStep(next);
        return;
      }
      const tl = gsap.timeline();
      tl.to(el, {
        opacity: 0,
        y: -20,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => session.setStep(next),
      });
      tl.fromTo(el, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    },
    [session],
  );

  /* ── Upload step ───────────────────────────────────────────────────────── */

  const handleFilesSelected = useCallback(
    (picked: File[]) => {
      setSegmentError(null);
      session.setFiles(picked);
      session.setMode(picked.length > 1 ? 'batch' : 'sheet');
    },
    [session],
  );

  const runSheetDetection = useCallback(async () => {
    const file = files[0];
    // Downscale BEFORE upload. The sheet path previously sent the full-
    // resolution photo, and a 12MP iPhone JPEG base64s to 4-7MB against
    // Vercel's hard 4.5MB body cap — a guaranteed 413 on a real phone.
    const dataUrl = await resizeImageForUpload(file, SEGMENT_MAX_DIMENSION, SEGMENT_QUALITY);
    session.setSheetImage(dataUrl);

    let outcome = await segmentImage(dataUrl);

    // One automatic retry at a smaller size before bothering the user.
    if (outcome.kind === 'payload_too_large') {
      const smaller = await resizeImageForUpload(file, 1200, 0.75);
      session.setSheetImage(smaller);
      outcome = await segmentImage(smaller);
    }

    if (outcome.kind !== 'ok') {
      // No fabricated boxes. The old code fell back to hardcoded demo
      // detections named by matching the FILENAME against the catalog, with
      // only a console.error — invisible on a phone.
      setSegmentError(outcome);
      addToast({
        type: 'error',
        title: 'Could not detect stamps',
        message: describeSegmentFailure(outcome),
      });
      return;
    }

    session.setDetections(
      outcome.stamps.map((s, i) => ({
        id: `det-${i}-${s.boundingBox.x.toFixed(1)}-${s.boundingBox.y.toFixed(1)}`,
        boundingBox: s.boundingBox,
        confidence: s.confidence,
        croppedImageUrl: '',
        description: s.description,
        // Selected by default: this is the point of the merged step. A correct
        // 20-stamp detection should cost zero taps, not twenty.
        confirmed: true,
        rejected: false,
        source: 'ai' as const,
      })),
    );
    if (outcome.truncated) {
      addToast({
        type: 'warning',
        title: 'Too many stamps',
        message: 'Only the first 60 are shown. Photograph the rest separately.',
      });
    }
    animateTransition('select');
  }, [files, session, addToast, animateTransition]);

  const runBatchPrep = useCallback(async () => {
    // Batch mode used to skip segmentation entirely and assign confidence 0.99
    // from a filename keyword match, before any AI ran. Now each photo is
    // simply a whole-frame candidate with no invented score; identification
    // does the real work.
    const prepared: DetectedStamp[] = [];
    for (const [index, file] of files.entries()) {
      setCropProgress(`Preparing ${index + 1} of ${files.length}`);
      const dataUrl = await resizeImageForUpload(file);
      prepared.push({
        id: `batch-${index}-${file.name}`,
        boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        confidence: null,
        croppedImageUrl: dataUrl,
        description: file.name,
        confirmed: true,
        rejected: false,
        source: 'ai',
      });
      await nextFrame();
    }
    setCropProgress(null);
    session.setDetections(prepared);
    animateTransition('select');
  }, [files, session, animateTransition]);

  const handleProceedToSelect = useCallback(async () => {
    if (files.length === 0) return;
    setSegmentError(null);
    setIsDetecting(true);
    try {
      if (mode === 'batch') await runBatchPrep();
      else await runSheetDetection();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not read that photo';
      setSegmentError({ kind: 'network', message });
      addToast({ type: 'error', title: 'Upload failed', message });
    } finally {
      setIsDetecting(false);
      setCropProgress(null);
    }
  }, [files, mode, runBatchPrep, runSheetDetection, addToast]);

  /** Skip detection and let the user frame the stamp themselves. Honest: they drew it. */
  const handleDrawMyself = useCallback(() => {
    setSegmentError(null);
    session.setDetections([
      {
        id: 'user-box-initial',
        boundingBox: { x: 15, y: 15, width: 70, height: 70 },
        confidence: null,
        croppedImageUrl: '',
        description: 'Added by you',
        confirmed: true,
        rejected: false,
        source: 'user',
      },
    ]);
    animateTransition('select');
  }, [session, animateTransition]);

  /* ── Identification ────────────────────────────────────────────────────── */

  const handleIdentify = useCallback(async () => {
    if (selected.length === 0) return;

    const controller = new AbortController();
    abortRef.current = controller;
    const now = new Date().toISOString();

    // Crop first, with visible progress. The old code decoded the source image
    // once PER BOX inside the loop — 20 boxes meant 20 decodes of a 12MP photo,
    // 5-15 seconds of frozen UI with no loading state on the button at all.
    const crops = new Map<string, string>();
    if (mode === 'sheet' && sheetImageDataUrl) {
      setIsDetecting(true);
      try {
        const cropper = await createCropper(sheetImageDataUrl);
        for (const [i, d] of selected.entries()) {
          setCropProgress(`Cropping ${i + 1} of ${selected.length}`);
          crops.set(d.id, cropper.crop(d.boundingBox));
          // Yield so the frame loop keeps running and the progress text paints.
          if (i % 4 === 3) await nextFrame();
        }
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Could not crop the photo',
          message: err instanceof Error ? err.message : undefined,
        });
        setIsDetecting(false);
        setCropProgress(null);
        return;
      }
      setIsDetecting(false);
      setCropProgress(null);
    } else {
      for (const d of selected) crops.set(d.id, d.croppedImageUrl);
    }

    animateTransition('identification');
    const results: Partial<Stamp>[] = [];

    for (const [idx, target] of selected.entries()) {
      if (controller.signal.aborted) break;
      session.setIdentifyIndex(idx);
      session.setIdentifyStatus(target.id, 'running');
      const image = crops.get(target.id) ?? target.croppedImageUrl;

      try {
        const ident = await identifyStamp(image, controller.signal);
        const pricing = isIdentified(ident)
          ? ((await lookupPricing(ident, { signal: controller.signal })) as Stamp['pricing'] | null)
          : null;
        results.push(buildIdentifiedStamp({ ident, imageDataUrl: image, pricing, index: idx, now }));
        session.setIdentifyStatus(target.id, 'done');
      } catch (err) {
        if (controller.signal.aborted) break;
        const message = err instanceof Error ? err.message : 'Unknown error';
        results.push(buildFailedStamp({ imageDataUrl: image, message, index: idx, now }));
        session.setIdentifyStatus(target.id, 'error');
      }
      session.setIdentified([...results]);
      // NOTE: the previous 800ms artificial delay per stamp is gone. On a
      // 20-stamp batch it added 16 seconds of pure waiting.
    }

    abortRef.current = null;
    if (!controller.signal.aborted) animateTransition('complete');
  }, [selected, mode, sheetImageDataUrl, session, addToast, animateTransition]);

  const handleCancelIdentification = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    addToast({ type: 'info', title: 'Identification cancelled' });
    animateTransition('select');
  }, [addToast, animateTransition]);

  /* ── Save ──────────────────────────────────────────────────────────────── */

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    const now = new Date().toISOString();
    try {
      for (const partial of identified) {
        // A real thumbnail. Previously the full multi-MB crop data URL was
        // stored in BOTH imageUrl and thumbnailUrl, which blew Safari's ~5MB
        // localStorage quota after two or three photos — and zustand's persist
        // middleware swallowed the QuotaExceededError, so the app navigated
        // away and the stamps were simply gone on reload.
        const thumbnailUrl = partial.imageUrl
          ? await makeThumbnail(partial.imageUrl)
          : '/mock/stamps/no-image.svg';
        addStamp(toFullStamp(partial, { userId: 'local', thumbnailUrl, now }));
      }
      session.reset();
      router.push('/collection');
    } catch (err) {
      // Stay put and keep the results. Never navigate away from unsaved work.
      addToast({
        type: 'error',
        title: 'Could not save your stamps',
        message: `${err instanceof Error ? err.message : 'Unknown error'}. Nothing was lost — try again.`,
      });
    } finally {
      setIsSaving(false);
    }
  }, [identified, addStamp, session, router, addToast]);

  const handleUpdateStamp = useCallback(
    (index: number, updated: Partial<Stamp>) => {
      const copy = [...identified];
      copy[index] = updated;
      session.setIdentified(copy);
    },
    [identified, session],
  );

  const handleDeleteStamp = useCallback(
    (index: number) => {
      session.setIdentified(identified.filter((_, i) => i !== index));
    },
    [identified, session],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    session.reset();
  }, [session]);

  const handleBack = useCallback(() => {
    if (step === 'select') animateTransition('upload');
    else if (step === 'identification') handleCancelIdentification();
    else if (step === 'complete') animateTransition('select');
  }, [step, animateTransition, handleCancelIdentification]);

  /* Selection-step callbacks, bound to the store. */
  const handleAdjust = useCallback((id: string, box: BoundingBox) => session.adjust(id, box), [session]);
  const handleAddBox = useCallback((box: BoundingBox) => session.addBox(box), [session]);

  if (!hasHydrated) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Upload Stamps</h1>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Upload Stamps</h1>

      <div className={styles.steps}>
        {STEPS.map((s, index) => {
          const isCompleted = index < stepIndex;
          const isActive = index === stepIndex;
          const circleClass = isCompleted
            ? styles.stepCircleCompleted
            : isActive
              ? styles.stepCircleActive
              : styles.stepCirclePending;
          const labelClass = isCompleted
            ? styles.stepLabelCompleted
            : isActive
              ? styles.stepLabelActive
              : styles.stepLabelPending;

          return (
            <React.Fragment key={s.key}>
              {index > 0 && (
                <div
                  className={
                    isCompleted || isActive ? styles.connectorCompleted : styles.connectorPending
                  }
                />
              )}
              <div className={styles.step} aria-current={isActive ? 'step' : undefined}>
                <div className={circleClass}>{isCompleted ? '✓' : index + 1}</div>
                <span className={labelClass}>{s.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className={styles.content} ref={contentRef}>
        {step === 'upload' && (
          <div className={styles.stepContent}>
            <DropZone onFilesSelected={handleFilesSelected} />

            {segmentError && (
              <div className={styles.errorPanel} role="alert">
                <p className={styles.errorText}>{describeSegmentFailure(segmentError)}</p>
                <div className={styles.errorActions}>
                  <button type="button" className={styles.errorBtn} onClick={handleProceedToSelect}>
                    Try again
                  </button>
                  <button type="button" className={styles.errorBtn} onClick={handleDrawMyself}>
                    Draw the box myself
                  </button>
                </div>
              </div>
            )}

            {files.length > 0 && (
              <div className={styles.modeSelection}>
                <span className={styles.modeLabel} id="upload-mode-label">
                  Upload Mode
                </span>
                <div className={styles.modeButtons} role="radiogroup" aria-labelledby="upload-mode-label">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === 'sheet'}
                    className={mode === 'sheet' ? styles.modeButtonActive : styles.modeButton}
                    onClick={() => session.setMode('sheet')}
                  >
                    🔍 Sheet — find stamps in one photo
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === 'batch'}
                    className={mode === 'batch' ? styles.modeButtonActive : styles.modeButton}
                    onClick={() => session.setMode('batch')}
                  >
                    📦 Batch — one stamp per photo
                  </button>
                </div>
              </div>
            )}

            {files.length > 0 && (
              <div className={styles.nav}>
                <div />
                <GoldButton onClick={handleProceedToSelect} loading={isDetecting}>
                  {isDetecting
                    ? (cropProgress ?? 'Finding stamps…')
                    : mode === 'batch'
                      ? 'Prepare photos →'
                      : 'Find stamps →'}
                </GoldButton>
              </div>
            )}
          </div>
        )}

        {step === 'select' && (
          <div className={styles.stepContent}>
            <StampSelectStep
              mode={mode}
              imageUrl={sheetImageDataUrl}
              detections={detections}
              canUndo={session.canUndo()}
              busy={isDetecting}
              busyLabel={cropProgress ?? undefined}
              onToggle={session.toggle}
              onSelectAll={session.selectAll}
              onSelectNone={session.selectNone}
              onAdjust={handleAdjust}
              onAddBox={handleAddBox}
              onRemoveBox={session.removeBox}
              onGestureStart={session.pushHistory}
              onUndo={session.undo}
              onBack={handleBack}
              onContinue={handleIdentify}
            />
          </div>
        )}

        {step === 'identification' && (
          <div className={styles.stepContent}>
            <IdentificationProgress
              stamps={selected}
              identifiedStamps={identified}
              currentIndex={identifyIndex}
            />
            <div className={styles.nav}>
              <button type="button" className={styles.navBackBtn} onClick={handleCancelIdentification}>
                Cancel
              </button>
              <div />
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className={styles.stepContent}>
            <UploadSummary
              stamps={identified}
              onSave={handleSave}
              onCancel={handleCancel}
              onUpdateStamp={handleUpdateStamp}
              onDeleteStamp={handleDeleteStamp}
            />
            {isSaving && <p className={styles.savingNote}>Saving your stamps…</p>}
          </div>
        )}
      </div>
    </div>
  );
}
