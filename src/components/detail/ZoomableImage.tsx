'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ZoomableImage.module.css';

interface ZoomableImageProps {
  src: string;
  alt: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.3;

export default function ZoomableImage({ src, alt }: ZoomableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTranslate, setLastTranslate] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
  }, [src]);

  /* Pinch zoom state */
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

  const clampTranslate = useCallback(
    (tx: number, ty: number, s: number) => {
      if (s <= 1) return { x: 0, y: 0 };
      const container = containerRef.current;
      if (!container) return { x: tx, y: ty };
      const rect = container.getBoundingClientRect();
      const maxX = (rect.width * (s - 1)) / 2;
      const maxY = (rect.height * (s - 1)) / 2;
      return {
        x: Math.max(-maxX, Math.min(maxX, tx)),
        y: Math.max(-maxY, Math.min(maxY, ty)),
      };
    },
    []
  );

  /* Mouse wheel zoom */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setScale((prev) => {
        const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev + delta));
        if (next <= 1) {
          setTranslate({ x: 0, y: 0 });
        } else {
          setTranslate((t) => clampTranslate(t.x, t.y, next));
        }
        return next;
      });
    },
    [clampTranslate]
  );

  /* Double click toggle */
  const handleDoubleClick = useCallback(() => {
    if (scale > 1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    } else {
      setScale(2.5);
    }
  }, [scale]);

  /* Mouse drag */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (scale <= 1) return;
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setLastTranslate(translate);
    },
    [scale, translate]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setTranslate(
        clampTranslate(lastTranslate.x + dx, lastTranslate.y + dy, scale)
      );
    },
    [isDragging, dragStart, lastTranslate, scale, clampTranslate]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  /* Touch handlers for pinch zoom */
  const getTouchDistance = (touches: React.TouchList): number => {
    const [t1, t2] = [touches[0], touches[1]];
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  };

  const getTouchCenter = (
    touches: React.TouchList
  ): { x: number; y: number } => {
    const [t1, t2] = [touches[0], touches[1]];
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };
  };

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        lastTouchDistance.current = getTouchDistance(e.touches);
        lastTouchCenter.current = getTouchCenter(e.touches);
      } else if (e.touches.length === 1 && scale > 1) {
        setIsDragging(true);
        setDragStart({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        });
        setLastTranslate(translate);
      }
    },
    [scale, translate]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDistance.current !== null) {
        e.preventDefault();
        const dist = getTouchDistance(e.touches);
        const ratio = dist / lastTouchDistance.current;
        setScale((prev) =>
          Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev * ratio))
        );
        lastTouchDistance.current = dist;
      } else if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - dragStart.x;
        const dy = e.touches[0].clientY - dragStart.y;
        setTranslate(
          clampTranslate(lastTranslate.x + dx, lastTranslate.y + dy, scale)
        );
      }
    },
    [isDragging, dragStart, lastTranslate, scale, clampTranslate]
  );

  const handleTouchEnd = useCallback(() => {
    lastTouchDistance.current = null;
    lastTouchCenter.current = null;
    setIsDragging(false);
    if (scale <= 1) {
      setTranslate({ x: 0, y: 0 });
    }
  }, [scale]);

  /* Zoom controls */
  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(MAX_SCALE, prev + ZOOM_STEP * 2));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => {
      const next = Math.max(MIN_SCALE, prev - ZOOM_STEP * 2);
      if (next <= 1) setTranslate({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className={styles.container}
        /* Driven from state. At scale 1 the page must still scroll: this image
           is the first element on the detail page, so an unconditional
           `touch-action: none` made the whole page feel frozen to a first swipe. */
        style={{ touchAction: scale > 1 ? 'none' : 'pan-y' }}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loadError ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '280px',
              fontSize: 'var(--text-3xl)',
              color: 'var(--color-text-tertiary)',
              background: 'rgba(0, 0, 0, 0.15)',
            }}
          >
            🔍
          </div>
        ) : (
          <img
            ref={imgRef}
            className={styles.imageCanvas}
            src={src}
            alt={alt}
            draggable={false}
            onError={() => setLoadError(true)}
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transformOrigin: 'center center',
            }}
          />
        )}

        {/* Zoom indicator */}
        {scale > 1 && (
          <div className={styles.zoomIndicator}>
            {Math.round(scale * 100)}%
          </div>
        )}

        {/* Controls */}
        <div className={styles.controls}>
          <button
            className={styles.controlBtn}
            onClick={(e) => {
              e.stopPropagation();
              zoomIn();
            }}
            title="Zoom in"
            type="button"
          >
            +
          </button>
          <button
            className={styles.controlBtn}
            onClick={(e) => {
              e.stopPropagation();
              zoomOut();
            }}
            title="Zoom out"
            type="button"
          >
            −
          </button>
          <button
            className={styles.controlBtn}
            onClick={(e) => {
              e.stopPropagation();
              resetZoom();
            }}
            title="Reset zoom"
            type="button"
          >
            ⟲
          </button>
          <button
            className={styles.controlBtn}
            onClick={(e) => {
              e.stopPropagation();
              setIsFullscreen(true);
            }}
            title="Fullscreen"
            type="button"
          >
            ⛶
          </button>
        </div>
      </div>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            className={styles.fullscreenBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsFullscreen(false)}
          >
            <div className={styles.fullscreenContent}>
              <img
                className={styles.fullscreenImage}
                src={src}
                alt={alt}
              />
            </div>
            <button
              className={styles.fullscreenClose}
              onClick={() => setIsFullscreen(false)}
              type="button"
              aria-label="Close fullscreen"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
