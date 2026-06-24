'use client';

import React, { useRef, useState, useCallback } from 'react';
import styles from './SegmentationOverlay.module.css';

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface BoundingBox {
  x: number; // percentage 0-100
  y: number;
  width: number;
  height: number;
}

export interface DetectedStamp {
  id: string;
  boundingBox: BoundingBox;
  confidence: number;
  croppedImageUrl: string;
  description: string;
  confirmed: boolean;
  rejected: boolean;
}

interface SegmentationOverlayProps {
  imageUrl: string;
  detectedStamps: DetectedStamp[];
  onAdjust: (index: number, box: BoundingBox) => void;
}

type Corner = 'TL' | 'TR' | 'BL' | 'BR';

const MIN_SIZE = 5; // minimum 5% width/height

export default function SegmentationOverlay({
  imageUrl,
  detectedStamps,
  onAdjust,
}: SegmentationOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [resizingIndex, setResizingIndex] = useState<number | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const originalBox = useRef<BoundingBox | null>(null);

  /* ── Coordinate helper ───────────────────────────────────────────── */

  const getRelativePosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * 100,
        y: ((clientY - rect.top) / rect.height) * 100,
      };
    },
    []
  );

  /* ── Clamp helper ────────────────────────────────────────────────── */

  const clamp = (val: number, min: number, max: number) =>
    Math.max(min, Math.min(max, val));

  /* ── Drag logic (shared between mouse & touch) ───────────────────── */

  const startDrag = useCallback(
    (clientX: number, clientY: number, index: number) => {
      setDraggingIndex(index);
      const pos = getRelativePosition(clientX, clientY);
      dragStart.current = pos;
      originalBox.current = { ...detectedStamps[index].boundingBox };

      const handleMove = (cx: number, cy: number) => {
        if (originalBox.current === null) return;
        const current = getRelativePosition(cx, cy);
        const dx = current.x - dragStart.current.x;
        const dy = current.y - dragStart.current.y;
        onAdjust(index, {
          ...originalBox.current,
          x: clamp(originalBox.current.x + dx, 0, 100 - originalBox.current.width),
          y: clamp(originalBox.current.y + dy, 0, 100 - originalBox.current.height),
        });
      };

      const handleEnd = () => {
        setDraggingIndex(null);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
      };

      const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
      const onMouseUp = () => handleEnd();
      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      };
      const onTouchEnd = () => handleEnd();

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
    },
    [detectedStamps, getRelativePosition, onAdjust]
  );

  /* ── Resize logic (shared between mouse & touch) ─────────────────── */

  const startResize = useCallback(
    (clientX: number, clientY: number, index: number, corner: Corner) => {
      setResizingIndex(index);
      const pos = getRelativePosition(clientX, clientY);
      dragStart.current = pos;
      originalBox.current = { ...detectedStamps[index].boundingBox };

      const handleMove = (cx: number, cy: number) => {
        if (originalBox.current === null) return;
        const current = getRelativePosition(cx, cy);
        const dx = current.x - dragStart.current.x;
        const dy = current.y - dragStart.current.y;
        const ob = originalBox.current;

        let newX = ob.x;
        let newY = ob.y;
        let newW = ob.width;
        let newH = ob.height;

        switch (corner) {
          case 'TL':
            newX = ob.x + dx;
            newY = ob.y + dy;
            newW = ob.width - dx;
            newH = ob.height - dy;
            break;
          case 'TR':
            newY = ob.y + dy;
            newW = ob.width + dx;
            newH = ob.height - dy;
            break;
          case 'BL':
            newX = ob.x + dx;
            newW = ob.width - dx;
            newH = ob.height + dy;
            break;
          case 'BR':
            newW = ob.width + dx;
            newH = ob.height + dy;
            break;
        }

        // Enforce minimum size
        if (newW < MIN_SIZE) {
          if (corner === 'TL' || corner === 'BL') {
            newX = ob.x + ob.width - MIN_SIZE;
          }
          newW = MIN_SIZE;
        }
        if (newH < MIN_SIZE) {
          if (corner === 'TL' || corner === 'TR') {
            newY = ob.y + ob.height - MIN_SIZE;
          }
          newH = MIN_SIZE;
        }

        // Enforce 0-100 bounds
        newX = clamp(newX, 0, 100 - MIN_SIZE);
        newY = clamp(newY, 0, 100 - MIN_SIZE);
        newW = clamp(newW, MIN_SIZE, 100 - newX);
        newH = clamp(newH, MIN_SIZE, 100 - newY);

        onAdjust(index, { x: newX, y: newY, width: newW, height: newH });
      };

      const handleEnd = () => {
        setResizingIndex(null);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
      };

      const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
      const onMouseUp = () => handleEnd();
      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      };
      const onTouchEnd = () => handleEnd();

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
    },
    [detectedStamps, getRelativePosition, onAdjust]
  );

  /* ── Mouse event handlers ────────────────────────────────────────── */

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      startDrag(e.clientX, e.clientY, index);
    },
    [startDrag]
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, index: number, corner: Corner) => {
      e.preventDefault();
      e.stopPropagation();
      startResize(e.clientX, e.clientY, index, corner);
    },
    [startResize]
  );

  /* ── Touch event handlers ────────────────────────────────────────── */

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY, index);
    },
    [startDrag]
  );

  const handleResizeTouchStart = useCallback(
    (e: React.TouchEvent, index: number, corner: Corner) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];
      startResize(touch.clientX, touch.clientY, index, corner);
    },
    [startResize]
  );

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div ref={containerRef} className={styles.container}>
      <img
        className={styles.image}
        src={imageUrl}
        alt="Album page with detected stamps"
        draggable={false}
      />

      <div className={styles.overlay}>
        {detectedStamps.map((stamp, index) => {
          const { boundingBox, confidence } = stamp;
          const opacity = Math.max(0.4, confidence);
          const isDragging = draggingIndex === index;
          const isResizing = resizingIndex === index;
          const isActive = isDragging || isResizing;

          const boxClasses = [
            styles.box,
            isDragging ? styles.dragging : '',
            isResizing ? styles.resizing : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={stamp.id}
              className={boxClasses}
              style={{
                left: `${boundingBox.x}%`,
                top: `${boundingBox.y}%`,
                width: `${boundingBox.width}%`,
                height: `${boundingBox.height}%`,
                borderColor: `rgba(212, 165, 116, ${opacity})`,
                boxShadow: isActive
                  ? 'inset 0 0 30px rgba(212, 165, 116, 0.2)'
                  : undefined,
              }}
              onMouseDown={(e) => handleMouseDown(e, index)}
              onTouchStart={(e) => handleTouchStart(e, index)}
            >
              <span className={styles.boxLabel}>{index + 1}</span>
              <span className={styles.confidenceBadge}>
                {Math.round(confidence * 100)}%
              </span>

              {/* Resize handles */}
              {(['TL', 'TR', 'BL', 'BR'] as Corner[]).map((corner) => (
                <span
                  key={corner}
                  className={`${styles.handle} ${styles[`handle${corner}`]}`}
                  onMouseDown={(e) => handleResizeMouseDown(e, index, corner)}
                  onTouchStart={(e) => handleResizeTouchStart(e, index, corner)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
