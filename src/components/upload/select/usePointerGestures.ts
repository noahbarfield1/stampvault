/* ──────────────────────────────────────────────────────────────────────────────
 * Pointer-gesture disambiguation for the stamp selection canvas.
 *
 * Replaces the old split mouse/touch handler pair in SegmentationOverlay, which
 * had three problems on a phone:
 *
 *   1. `onTouchStart` called `preventDefault()` unconditionally and every box
 *      set `touch-action: none`. With 15-25 boxes tiling the photo there was
 *      nowhere left to start a scroll, so the page appeared frozen.
 *   2. Any touch that landed on a box immediately began DRAGGING it, so a user
 *      trying to scroll past the image silently destroyed a good AI crop.
 *   3. It read `e.touches[0]` exclusively, so a second finger corrupted every
 *      delta instead of starting a pinch.
 *
 * The rule that fixes all three: a pointerdown on a box commits to nothing. It
 * becomes a tap, a drag, or a scroll depending on what happens next.
 *
 *   move <= TAP_SLOP           -> still undecided, candidate tap
 *   move  > TAP_SLOP, adjusting-> capture the pointer and drag the box
 *   move  > TAP_SLOP, else     -> release entirely; `touch-action: pan-y` scrolls
 *   up, unmoved, < LONG_PRESS  -> tap: toggle selection
 *   LONG_PRESS elapsed, unmoved-> enter adjust mode
 *   second pointer             -> abort any drag, revert the box, start pinching
 * ────────────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoundingBox } from '@/types/upload';

/** Movement under this (CSS px) is treated as a tap, not a drag. */
export const TAP_SLOP = 10;
/** Hold this long without moving to enter adjust mode. */
export const LONG_PRESS_MS = 500;
/** Minimum box size in percent. 5% made small stamps unadjustable. */
export const MIN_BOX_PERCENT = 1.5;

export const MIN_SCALE = 1;
export const MAX_SCALE = 6;

export type Corner = 'TL' | 'TR' | 'BL' | 'BR';

export interface Transform {
  scale: number;
  /** Translation in CSS px, applied after scaling about the centre. */
  x: number;
  y: number;
}

export const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

interface Options {
  /** The element the boxes are positioned against (the TRANSFORMED one). */
  surfaceRef: React.RefObject<HTMLElement | null>;
  onTap: (id: string) => void;
  onLongPress: (id: string) => void;
  onAdjust: (id: string, box: BoundingBox) => void;
  /** Called once per gesture, before the first mutation, for undo. */
  onGestureStart: () => void;
  getBox: (id: string) => BoundingBox | undefined;
  /** Id currently in adjust mode, or null. Only this box can be dragged. */
  adjustingId: string | null;
}

interface DragState {
  pointerId: number;
  id: string;
  corner: Corner | null;
  startClient: { x: number; y: number };
  startPercent: { x: number; y: number };
  originalBox: BoundingBox;
  moved: boolean;
  committed: boolean;
  longPressTimer: ReturnType<typeof setTimeout> | null;
}

export function usePointerGestures({
  surfaceRef,
  onTap,
  onLongPress,
  onAdjust,
  onGestureStart,
  getBox,
  adjustingId,
}: Options) {
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const [activeId, setActiveId] = useState<string | null>(null);

  const drag = useRef<DragState | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; centre: { x: number; y: number }; start: Transform } | null>(
    null,
  );
  // Read inside window listeners, which capture their closure once.
  const adjustingRef = useRef(adjustingId);
  adjustingRef.current = adjustingId;
  const transformRef = useRef(transform);
  transformRef.current = transform;

  /** Convert client coordinates into percentage-of-surface coordinates. */
  const toPercent = useCallback(
    (clientX: number, clientY: number) => {
      const el = surfaceRef.current;
      if (!el) return { x: 0, y: 0 };
      // getBoundingClientRect() is POST-transform, so this stays correct at any
      // zoom level with no extra maths. Measuring an untransformed ancestor
      // instead would silently scale every delta by 1/scale.
      const r = el.getBoundingClientRect();
      return {
        x: ((clientX - r.left) / r.width) * 100,
        y: ((clientY - r.top) / r.height) * 100,
      };
    },
    [surfaceRef],
  );

  const cancelLongPress = () => {
    if (drag.current?.longPressTimer) {
      clearTimeout(drag.current.longPressTimer);
      drag.current.longPressTimer = null;
    }
  };

  const endDrag = useCallback(() => {
    cancelLongPress();
    drag.current = null;
    setActiveId(null);
  }, []);

  /** Abort an in-flight drag and restore the box it was moving. */
  const abortDrag = useCallback(() => {
    const d = drag.current;
    if (d?.committed) onAdjust(d.id, d.originalBox);
    endDrag();
  }, [onAdjust, endDrag]);

  const applyDrag = useCallback(
    (clientX: number, clientY: number) => {
      const d = drag.current;
      if (!d) return;
      const cur = toPercent(clientX, clientY);
      const dx = cur.x - d.startPercent.x;
      const dy = cur.y - d.startPercent.y;
      const ob = d.originalBox;

      if (d.corner === null) {
        onAdjust(d.id, {
          ...ob,
          x: clamp(ob.x + dx, 0, 100 - ob.width),
          y: clamp(ob.y + dy, 0, 100 - ob.height),
        });
        return;
      }

      let { x, y, width: w, height: h } = ob;
      if (d.corner === 'TL') {
        x = ob.x + dx;
        y = ob.y + dy;
        w = ob.width - dx;
        h = ob.height - dy;
      } else if (d.corner === 'TR') {
        y = ob.y + dy;
        w = ob.width + dx;
        h = ob.height - dy;
      } else if (d.corner === 'BL') {
        x = ob.x + dx;
        w = ob.width - dx;
        h = ob.height + dy;
      } else {
        w = ob.width + dx;
        h = ob.height + dy;
      }

      if (w < MIN_BOX_PERCENT) {
        if (d.corner === 'TL' || d.corner === 'BL') x = ob.x + ob.width - MIN_BOX_PERCENT;
        w = MIN_BOX_PERCENT;
      }
      if (h < MIN_BOX_PERCENT) {
        if (d.corner === 'TL' || d.corner === 'TR') y = ob.y + ob.height - MIN_BOX_PERCENT;
        h = MIN_BOX_PERCENT;
      }

      x = clamp(x, 0, 100 - MIN_BOX_PERCENT);
      y = clamp(y, 0, 100 - MIN_BOX_PERCENT);
      onAdjust(d.id, {
        x,
        y,
        width: clamp(w, MIN_BOX_PERCENT, 100 - x),
        height: clamp(h, MIN_BOX_PERCENT, 100 - y),
      });
    },
    [onAdjust, toPercent],
  );

  /* ── Window-level listeners ─────────────────────────────────────────────
     Registered on the window so a fast drag that leaves the element still
     tracks, and torn down on unmount. */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (pointers.current.has(e.pointerId)) {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // Two or more pointers: pinch wins, unconditionally.
      if (pointers.current.size >= 2) {
        if (drag.current) abortDrag();
        const [p1, p2] = [...pointers.current.values()];
        const d = dist(p1, p2);
        const c = mid(p1, p2);
        if (!pinch.current) {
          pinch.current = { dist: d, centre: c, start: transformRef.current };
          return;
        }
        const p = pinch.current;
        if (p.dist <= 0) return;
        const nextScale = clamp((d / p.dist) * p.start.scale, MIN_SCALE, MAX_SCALE);
        const growth = nextScale / p.start.scale;
        // Keep the pinch midpoint anchored. The old ZoomableImage captured a
        // centre and never used it, so zoom always jumped to the middle.
        setTransform({
          scale: nextScale,
          x: c.x - p.centre.x + (p.start.x - 0) * growth,
          y: c.y - p.centre.y + (p.start.y - 0) * growth,
        });
        return;
      }

      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;

      if (!d.moved) {
        const moved = dist({ x: e.clientX, y: e.clientY }, d.startClient) > TAP_SLOP;
        if (!moved) return;
        d.moved = true;
        cancelLongPress();

        // Only a box already in adjust mode may be dragged. Otherwise let go so
        // the browser scrolls the page — this is the scroll-trap fix.
        if (adjustingRef.current !== d.id) {
          endDrag();
          return;
        }
        d.committed = true;
        onGestureStart();
        setActiveId(d.id);
      }

      if (d.committed) {
        e.preventDefault();
        applyDrag(e.clientX, e.clientY);
      }
    };

    const onUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;

      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;

      if (!d.moved && !d.committed) onTap(d.id);
      endDrag();
    };

    const onCancel = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      if (drag.current && e.pointerId === drag.current.pointerId) abortDrag();
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [abortDrag, applyDrag, endDrag, onGestureStart, onTap]);

  /** Attach to a box (corner === null) or one of its resize handles. */
  const onPointerDown = useCallback(
    (e: React.PointerEvent, id: string, corner: Corner | null = null) => {
      // Ignore secondary mouse buttons but never call preventDefault here — the
      // browser must stay free to scroll if this turns out not to be a drag.
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.stopPropagation();

      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size >= 2) {
        abortDrag();
        return;
      }

      const box = getBox(id);
      if (!box) return;

      const timer = setTimeout(() => {
        const d = drag.current;
        if (d && !d.moved) {
          d.longPressTimer = null;
          navigator.vibrate?.(10);
          onLongPress(id);
        }
      }, LONG_PRESS_MS);

      drag.current = {
        pointerId: e.pointerId,
        id,
        corner,
        startClient: { x: e.clientX, y: e.clientY },
        startPercent: toPercent(e.clientX, e.clientY),
        originalBox: { ...box },
        moved: false,
        // A handle is only reachable in adjust mode, so it drags immediately —
        // no slop threshold, no tap ambiguity.
        committed: corner !== null,
        longPressTimer: timer,
      };

      if (corner !== null) {
        onGestureStart();
        setActiveId(id);
      }
    },
    [abortDrag, getBox, onGestureStart, onLongPress, toPercent],
  );

  const resetTransform = useCallback(() => setTransform(IDENTITY), []);

  const zoomBy = useCallback((factor: number) => {
    setTransform((t) => {
      const scale = clamp(t.scale * factor, MIN_SCALE, MAX_SCALE);
      return scale === MIN_SCALE ? IDENTITY : { ...t, scale };
    });
  }, []);

  return {
    transform,
    setTransform,
    resetTransform,
    zoomBy,
    onPointerDown,
    /** Id being actively dragged, for styling. */
    activeId,
    isZoomed: transform.scale > MIN_SCALE,
  };
}
