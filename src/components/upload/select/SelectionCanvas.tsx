'use client';

/* ──────────────────────────────────────────────────────────────────────────────
 * The stamp selection canvas — the photo with tappable detection boxes.
 *
 * Replaces SegmentationOverlay, which could only move and resize boxes. On a
 * 390px phone an 8%-wide stamp rendered about 29x38 CSS px, with four 44px
 * corner hit areas that completely overlapped both each other and the box body,
 * so which corner you grabbed was a coin flip. Pinch-zoom is the real fix: at
 * 4x that same box is around 120px.
 * ────────────────────────────────────────────────────────────────────────────── */

import React, { useCallback, useRef } from 'react';
import type { BoundingBox, DetectedStamp } from '@/types/upload';
import { LOW_CONFIDENCE } from '@/store/uploadSession';
import {
  usePointerGestures,
  type Corner,
  MAX_SCALE,
  MIN_SCALE,
} from './usePointerGestures';
import styles from './SelectionCanvas.module.css';

const CORNERS: Corner[] = ['TL', 'TR', 'BL', 'BR'];

interface Props {
  imageUrl: string;
  detections: DetectedStamp[];
  adjustingId: string | null;
  onToggle: (id: string) => void;
  onEnterAdjust: (id: string) => void;
  onAdjust: (id: string, box: BoundingBox) => void;
  onGestureStart: () => void;
}

export default function SelectionCanvas({
  imageUrl,
  detections,
  adjustingId,
  onToggle,
  onEnterAdjust,
  onAdjust,
  onGestureStart,
}: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);

  const getBox = useCallback(
    (id: string) => detections.find((d) => d.id === id)?.boundingBox,
    [detections],
  );

  const { transform, onPointerDown, activeId, isZoomed, zoomBy, resetTransform } =
    usePointerGestures({
      surfaceRef,
      onTap: onToggle,
      onLongPress: onEnterAdjust,
      onAdjust,
      onGestureStart,
      getBox,
      adjustingId,
    });

  return (
    <div className={isZoomed ? styles.viewportZoomed : styles.viewport}>
      <div
        ref={surfaceRef}
        className={styles.surface}
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
      >
        <img
          className={styles.image}
          src={imageUrl}
          alt="Your photo, with detected stamps marked"
          draggable={false}
        />

        {detections.map((d, index) => {
          const isAdjusting = adjustingId === d.id;
          const uncertain =
            d.confirmed && d.confidence !== null && d.confidence < LOW_CONFIDENCE;

          const cls = isAdjusting
            ? styles.boxAdjusting
            : !d.confirmed
              ? styles.boxDeselected
              : uncertain
                ? styles.boxUncertain
                : styles.boxSelected;

          const badgeCls = !d.confirmed
            ? styles.badgeOff
            : uncertain
              ? styles.badgeWarn
              : styles.badge;

          const pct =
            d.confidence === null ? 'not scored' : `${Math.round(d.confidence * 100)}% confidence`;

          return (
            <button
              key={d.id}
              type="button"
              // A real checkbox, so the flow is operable by keyboard and
              // announced by a screen reader. The old boxes were bare divs.
              role="checkbox"
              aria-checked={d.confirmed}
              aria-label={`Stamp ${index + 1}, ${d.description}, ${pct}`}
              className={cls}
              style={{
                left: `${d.boundingBox.x}%`,
                top: `${d.boundingBox.y}%`,
                width: `${d.boundingBox.width}%`,
                height: `${d.boundingBox.height}%`,
                // Keep the outline visually constant as the canvas scales.
                borderWidth: `${2 / transform.scale}px`,
                opacity: activeId === d.id ? 0.9 : undefined,
              }}
              onPointerDown={(e) => onPointerDown(e, d.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggle(d.id);
                }
              }}
            >
              <span
                className={badgeCls}
                style={{ transform: `scale(${1 / transform.scale})`, transformOrigin: 'top left' }}
              >
                {d.confirmed ? (uncertain ? '?' : '✓') : ''}
                {index + 1}
              </span>

              {d.confirmed && !isAdjusting && (
                <span
                  className={styles.adjustChip}
                  style={{ transform: `scale(${1 / transform.scale})` }}
                  role="button"
                  tabIndex={-1}
                  aria-label={`Adjust the box around stamp ${index + 1}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onEnterAdjust(d.id);
                  }}
                >
                  ✎
                </span>
              )}

              {isAdjusting &&
                CORNERS.map((corner) => (
                  <span
                    key={corner}
                    className={`${styles.handle} ${styles[`handle${corner}`]}`}
                    style={{ transform: `scale(${1 / transform.scale})` }}
                    onPointerDown={(e) => onPointerDown(e, d.id, corner)}
                  />
                ))}
            </button>
          );
        })}
      </div>

      {transform.scale > MIN_SCALE && (
        <span className={styles.zoomBadge}>{transform.scale.toFixed(1)}×</span>
      )}

      <div className={styles.zoomControls}>
        <button
          type="button"
          className={styles.zoomBtn}
          onClick={() => zoomBy(1.5)}
          disabled={transform.scale >= MAX_SCALE}
          aria-label="Zoom in"
        >
          ＋
        </button>
        <button
          type="button"
          className={styles.zoomBtn}
          onClick={() => zoomBy(1 / 1.5)}
          disabled={transform.scale <= MIN_SCALE}
          aria-label="Zoom out"
        >
          －
        </button>
        <button
          type="button"
          className={styles.zoomBtn}
          onClick={resetTransform}
          disabled={transform.scale <= MIN_SCALE}
          aria-label="Reset zoom"
        >
          ⟲
        </button>
      </div>
    </div>
  );
}
