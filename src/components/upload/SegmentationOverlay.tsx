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

export default function SegmentationOverlay({
  imageUrl,
  detectedStamps,
  onAdjust,
}: SegmentationOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const originalBox = useRef<BoundingBox | null>(null);

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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingIndex(index);
      const pos = getRelativePosition(e.clientX, e.clientY);
      dragStart.current = pos;
      originalBox.current = { ...detectedStamps[index].boundingBox };

      const handleMove = (moveEvent: MouseEvent) => {
        if (originalBox.current === null) return;
        const current = getRelativePosition(
          moveEvent.clientX,
          moveEvent.clientY
        );
        const dx = current.x - dragStart.current.x;
        const dy = current.y - dragStart.current.y;
        onAdjust(index, {
          ...originalBox.current,
          x: Math.max(0, Math.min(100 - originalBox.current.width, originalBox.current.x + dx)),
          y: Math.max(0, Math.min(100 - originalBox.current.height, originalBox.current.y + dy)),
        });
      };

      const handleUp = () => {
        setDraggingIndex(null);
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [detectedStamps, getRelativePosition, onAdjust]
  );

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

          return (
            <div
              key={stamp.id}
              className={styles.box}
              style={{
                left: `${boundingBox.x}%`,
                top: `${boundingBox.y}%`,
                width: `${boundingBox.width}%`,
                height: `${boundingBox.height}%`,
                borderColor: `rgba(212, 165, 116, ${opacity})`,
                boxShadow:
                  draggingIndex === index
                    ? 'inset 0 0 30px rgba(212, 165, 116, 0.2)'
                    : undefined,
              }}
              onMouseDown={(e) => handleMouseDown(e, index)}
            >
              <span className={styles.boxLabel}>{index + 1}</span>
              <span className={styles.confidenceBadge}>
                {Math.round(confidence * 100)}%
              </span>

              {/* Resize handles */}
              <span className={`${styles.handle} ${styles.handleTL}`} />
              <span className={`${styles.handle} ${styles.handleTR}`} />
              <span className={`${styles.handle} ${styles.handleBL}`} />
              <span className={`${styles.handle} ${styles.handleBR}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
