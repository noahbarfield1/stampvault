'use client';

/* ──────────────────────────────────────────────────────────────────────────────
 * The merged selection step.
 *
 * Replaces the old two-screen `segmentation` -> `review` flow, where you dragged
 * boxes on one screen and then tapped Confirm on ~32px buttons on a second
 * screen, once per stamp. A correct 20-stamp detection cost 20 taps.
 *
 * Now: detections arrive already selected, a tap toggles one off, and the count
 * plus the primary action are always visible in sticky bars.
 * ────────────────────────────────────────────────────────────────────────────── */

import React, { useCallback, useMemo, useState } from 'react';
import type { BoundingBox, DetectedStamp } from '@/types/upload';
import GoldButton from '@/components/ui/GoldButton';
import SelectionCanvas from './SelectionCanvas';
import { MIN_BOX_PERCENT } from './usePointerGestures';
import styles from './StampSelectStep.module.css';

/** How far one nudge tap moves or resizes a box, in percent. */
const NUDGE = 0.5;

interface Props {
  mode: 'sheet' | 'batch';
  imageUrl: string | null;
  detections: DetectedStamp[];
  canUndo: boolean;
  busy: boolean;
  busyLabel?: string;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onAdjust: (id: string, box: BoundingBox) => void;
  onAddBox: (box: BoundingBox) => string;
  onRemoveBox: (id: string) => void;
  onGestureStart: () => void;
  onUndo: () => void;
  onBack: () => void;
  onContinue: () => void;
}

export default function StampSelectStep({
  mode,
  imageUrl,
  detections,
  canUndo,
  busy,
  busyLabel,
  onToggle,
  onSelectAll,
  onSelectNone,
  onAdjust,
  onAddBox,
  onRemoveBox,
  onGestureStart,
  onUndo,
  onBack,
  onContinue,
}: Props) {
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  const selectedCount = useMemo(
    () => detections.filter((d) => d.confirmed).length,
    [detections],
  );

  const adjusting = detections.find((d) => d.id === adjustingId) ?? null;
  const adjustingIndex = detections.findIndex((d) => d.id === adjustingId);

  const nudge = useCallback(
    (dx: number, dy: number, dw: number, dh: number) => {
      if (!adjusting) return;
      const b = adjusting.boundingBox;
      onGestureStart();
      const width = Math.max(MIN_BOX_PERCENT, Math.min(100, b.width + dw));
      const height = Math.max(MIN_BOX_PERCENT, Math.min(100, b.height + dh));
      onAdjust(adjusting.id, {
        x: Math.max(0, Math.min(100 - width, b.x + dx)),
        y: Math.max(0, Math.min(100 - height, b.y + dy)),
        width,
        height,
      });
    },
    [adjusting, onAdjust, onGestureStart],
  );

  const handleAdd = useCallback(() => {
    onGestureStart();
    // Placed centrally at a size that is easy to grab and then refine.
    const id = onAddBox({ x: 35, y: 35, width: 30, height: 30 });
    setAdjustingId(id);
  }, [onAddBox, onGestureStart]);

  const handleDelete = useCallback(() => {
    if (!adjusting) return;
    onGestureStart();
    onRemoveBox(adjusting.id);
    setAdjustingId(null);
  }, [adjusting, onGestureStart, onRemoveBox]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.count} aria-live="polite">
          <span className={styles.countNumber}>{selectedCount}</span> of {detections.length}{' '}
          selected
        </span>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.chip}
            onClick={onSelectAll}
            disabled={selectedCount === detections.length}
          >
            All
          </button>
          <button
            type="button"
            className={styles.chip}
            onClick={onSelectNone}
            disabled={selectedCount === 0}
          >
            None
          </button>
          {mode === 'sheet' && (
            <button type="button" className={styles.chip} onClick={handleAdd}>
              + Add
            </button>
          )}
          <button
            type="button"
            className={styles.chip}
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo the last change"
          >
            ↶
          </button>
        </div>
      </div>

      <p className={styles.hint}>
        {mode === 'sheet'
          ? 'Tap a stamp to include or exclude it. Tap ✎ (or press and hold) to resize its box. Pinch to zoom.'
          : 'Tap a photo to include or exclude it.'}
      </p>

      {detections.some((d) => d.confirmed && d.confidence !== null && d.confidence < 0.5) && (
        <p className={styles.warning}>
          Boxes marked ? are low-confidence detections. They are still included — check them
          before continuing.
        </p>
      )}

      {mode === 'sheet' && imageUrl ? (
        <SelectionCanvas
          imageUrl={imageUrl}
          detections={detections}
          adjustingId={adjustingId}
          onToggle={onToggle}
          onEnterAdjust={setAdjustingId}
          onAdjust={onAdjust}
          onGestureStart={onGestureStart}
        />
      ) : (
        <div className={styles.batchGrid}>
          {detections.map((d, i) => (
            <button
              key={d.id}
              type="button"
              role="checkbox"
              aria-checked={d.confirmed}
              aria-label={`${d.description}, ${d.confirmed ? 'included' : 'excluded'}`}
              className={d.confirmed ? styles.cardSelected : styles.cardDeselected}
              onClick={() => onToggle(d.id)}
            >
              {d.croppedImageUrl ? (
                <img className={styles.cardImage} src={d.croppedImageUrl} alt="" />
              ) : (
                <div className={styles.cardImage} />
              )}
              <span className={styles.cardBody}>
                <span className={d.confirmed ? styles.cardCheck : styles.cardCheckOff}>✓</span>
                <span className={styles.cardLabel}>{d.description || `Photo ${i + 1}`}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {adjusting && (
        <div className={styles.adjustSheet}>
          <span className={styles.adjustTitle}>
            Adjusting stamp {adjustingIndex + 1}
          </span>
          <div className={styles.nudgeGrid}>
            <span className={styles.nudgeLabel}>Move</span>
            <button type="button" className={styles.nudgeBtn} onClick={() => nudge(-NUDGE, 0, 0, 0)} aria-label="Move left">←</button>
            <button type="button" className={styles.nudgeBtn} onClick={() => nudge(NUDGE, 0, 0, 0)} aria-label="Move right">→</button>
            <button type="button" className={styles.nudgeBtn} onClick={() => nudge(0, -NUDGE, 0, 0)} aria-label="Move up">↑</button>
            <button type="button" className={styles.nudgeBtn} onClick={() => nudge(0, NUDGE, 0, 0)} aria-label="Move down">↓</button>
            <span className={styles.nudgeLabel}>Resize</span>
            <button type="button" className={styles.nudgeBtn} onClick={() => nudge(0, 0, -NUDGE, 0)} aria-label="Narrower">◧</button>
            <button type="button" className={styles.nudgeBtn} onClick={() => nudge(0, 0, NUDGE, 0)} aria-label="Wider">◨</button>
            <button type="button" className={styles.nudgeBtn} onClick={() => nudge(0, 0, 0, -NUDGE)} aria-label="Shorter">▤</button>
            <button type="button" className={styles.nudgeBtn} onClick={() => nudge(0, 0, 0, NUDGE)} aria-label="Taller">▥</button>
          </div>
          <div className={styles.adjustActions}>
            <button type="button" className={styles.deleteBtn} onClick={handleDelete}>
              Delete box
            </button>
            <button type="button" className={styles.doneBtn} onClick={() => setAdjustingId(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      <div className={styles.actionBar}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          ← Back
        </button>
        <div className={styles.actionBarPrimary}>
          <GoldButton
            onClick={onContinue}
            disabled={selectedCount === 0 || busy}
            loading={busy}
            fullWidth
          >
            {busy
              ? (busyLabel ?? 'Working…')
              : `Identify ${selectedCount} stamp${selectedCount === 1 ? '' : 's'} →`}
          </GoldButton>
        </div>
      </div>

      {selectedCount === 0 && (
        <p className={styles.disabledReason}>
          Tap at least one stamp to continue.
        </p>
      )}
    </div>
  );
}
