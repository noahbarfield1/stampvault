/* ──────────────────────────────────────────────────────────────────────────────
 * Upload session state.
 *
 * Previously every piece of this lived in `useState` inside the upload page. On
 * a phone that meant an iOS edge-swipe, an incoming call, or Safari reclaiming
 * a backgrounded tab discarded the entire in-progress session — after the user
 * had adjusted 20 crops and waited through minutes of AI calls.
 *
 * Persisted to sessionStorage, not localStorage: an abandoned upload should not
 * resurrect a week later, but it must survive a reload or a backgrounded tab.
 * ────────────────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Stamp } from '@/types/stamp';
import type { BoundingBox, DetectedStamp } from '@/types/upload';

export type UploadStep = 'upload' | 'select' | 'identification' | 'complete';
export type UploadMode = 'sheet' | 'batch';

export const STEPS: { key: UploadStep; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'select', label: 'Select' },
  { key: 'identification', label: 'Identify' },
  { key: 'complete', label: 'Done' },
];

/** Boxes below this confidence are flagged in the UI but stay selected. */
export const LOW_CONFIDENCE = 0.5;

/** Undo depth. Deep enough to recover from a fumble, shallow enough to persist. */
const HISTORY_LIMIT = 20;

/**
 * A ~2000px JPEG data URL is 1-2MB and sessionStorage caps around 5MB, so the
 * sheet image is only persisted when it comfortably fits.
 */
const MAX_PERSISTED_IMAGE_CHARS = 3_000_000;

export type IdentifyStatus = 'pending' | 'running' | 'done' | 'error';

interface UploadSessionState {
  step: UploadStep;
  mode: UploadMode;

  /**
   * The sheet photo as a data URL.
   *
   * Deliberately NOT a `blob:` object URL: those are dead after a reload, so
   * persisting one restores a broken image. This is the downscaled data URL,
   * used for display AND as the crop source.
   */
  sheetImageDataUrl: string | null;
  /** Original files. Not persisted — File objects cannot be serialized. */
  files: File[];

  detections: DetectedStamp[];
  history: DetectedStamp[][];

  identified: Partial<Stamp>[];
  identifyIndex: number;
  identifyStatus: Record<string, IdentifyStatus>;

  /** True once the persisted session has been read back. */
  hasHydrated: boolean;
  /** Set when a session was restored but its image could not be. */
  restoreWarning: string | null;

  setStep: (step: UploadStep) => void;
  setMode: (mode: UploadMode) => void;
  setFiles: (files: File[]) => void;
  setSheetImage: (dataUrl: string | null) => void;
  setDetections: (detections: DetectedStamp[]) => void;

  toggle: (id: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  adjust: (id: string, box: BoundingBox) => void;
  addBox: (box: BoundingBox) => string;
  removeBox: (id: string) => void;
  setCroppedImage: (id: string, dataUrl: string) => void;

  pushHistory: () => void;
  undo: () => void;
  canUndo: () => boolean;

  setIdentified: (stamps: Partial<Stamp>[]) => void;
  setIdentifyIndex: (index: number) => void;
  setIdentifyStatus: (id: string, status: IdentifyStatus) => void;

  clearRestoreWarning: () => void;
  reset: () => void;
}

const initialState = {
  step: 'upload' as UploadStep,
  mode: 'sheet' as UploadMode,
  sheetImageDataUrl: null,
  files: [] as File[],
  detections: [] as DetectedStamp[],
  history: [] as DetectedStamp[][],
  identified: [] as Partial<Stamp>[],
  identifyIndex: 0,
  identifyStatus: {} as Record<string, IdentifyStatus>,
  restoreWarning: null as string | null,
};

let userBoxCounter = 0;

export const useUploadSession = create<UploadSessionState>()(
  persist(
    (set, get) => ({
      ...initialState,
      hasHydrated: false,

      setStep: (step) => set({ step }),
      setMode: (mode) => set({ mode }),
      setFiles: (files) => set({ files }),
      setSheetImage: (sheetImageDataUrl) => set({ sheetImageDataUrl }),
      setDetections: (detections) => set({ detections, history: [] }),

      toggle: (id) =>
        set((s) => ({
          detections: s.detections.map((d) =>
            d.id === id ? { ...d, confirmed: !d.confirmed, rejected: false } : d,
          ),
        })),

      selectAll: () =>
        set((s) => ({
          detections: s.detections.map((d) => ({ ...d, confirmed: true, rejected: false })),
        })),

      selectNone: () =>
        set((s) => ({
          detections: s.detections.map((d) => ({ ...d, confirmed: false })),
        })),

      adjust: (id, box) =>
        set((s) => ({
          detections: s.detections.map((d) =>
            d.id === id ? { ...d, boundingBox: box } : d,
          ),
        })),

      addBox: (box) => {
        const id = `user-box-${++userBoxCounter}-${get().detections.length}`;
        set((s) => ({
          detections: [
            ...s.detections,
            {
              id,
              boundingBox: box,
              // A user-drawn box has no model confidence. null is honest;
              // 1.0 would be a fabricated measurement.
              confidence: null,
              croppedImageUrl: '',
              description: 'Added by you',
              confirmed: true,
              rejected: false,
              source: 'user',
            },
          ],
        }));
        return id;
      },

      removeBox: (id) =>
        set((s) => ({ detections: s.detections.filter((d) => d.id !== id) })),

      setCroppedImage: (id, dataUrl) =>
        set((s) => ({
          detections: s.detections.map((d) =>
            d.id === id ? { ...d, croppedImageUrl: dataUrl } : d,
          ),
        })),

      // Snapshot BEFORE a mutation. Callers must invoke this once per gesture
      // (on pointerdown), never per pointermove, or one drag floods the stack.
      pushHistory: () =>
        set((s) => ({
          history: [...s.history, s.detections].slice(-HISTORY_LIMIT),
        })),

      undo: () =>
        set((s) => {
          if (s.history.length === 0) return s;
          const previous = s.history[s.history.length - 1];
          return { detections: previous, history: s.history.slice(0, -1) };
        }),

      canUndo: () => get().history.length > 0,

      setIdentified: (identified) => set({ identified }),
      setIdentifyIndex: (identifyIndex) => set({ identifyIndex }),
      setIdentifyStatus: (id, status) =>
        set((s) => ({ identifyStatus: { ...s.identifyStatus, [id]: status } })),

      clearRestoreWarning: () => set({ restoreWarning: null }),

      reset: () => set({ ...initialState, hasHydrated: true }),
    }),
    {
      name: 'stampvault-upload-session',
      storage: createJSONStorage(() => {
        // Guard for SSR and for Safari private mode, where accessing
        // sessionStorage can throw outright.
        try {
          if (typeof window === 'undefined') throw new Error('no window');
          const s = window.sessionStorage;
          return {
            getItem: (k) => s.getItem(k),
            setItem: (k, v) => {
              try {
                s.setItem(k, v);
              } catch {
                // Quota exceeded. Degrade to metadata-only rather than throwing
                // inside the middleware, which would take the render down.
                try {
                  const thin = JSON.parse(v);
                  if (thin?.state) thin.state.sheetImageDataUrl = null;
                  s.setItem(k, JSON.stringify(thin));
                } catch {
                  /* give up silently; the session is in-memory only */
                }
              }
            },
            removeItem: (k) => s.removeItem(k),
          };
        } catch {
          const mem = new Map<string, string>();
          return {
            getItem: (k) => mem.get(k) ?? null,
            setItem: (k, v) => void mem.set(k, v),
            removeItem: (k) => void mem.delete(k),
          };
        }
      }),
      // `files` holds File objects, which cannot be serialized. Crops are
      // regenerable from the sheet image, so they are dropped too.
      partialize: (s) => ({
        step: s.step,
        mode: s.mode,
        sheetImageDataUrl:
          s.sheetImageDataUrl && s.sheetImageDataUrl.length < MAX_PERSISTED_IMAGE_CHARS
            ? s.sheetImageDataUrl
            : null,
        detections: s.detections.map((d) => ({ ...d, croppedImageUrl: '' })),
        identifyIndex: s.identifyIndex,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // A step past 'upload' with no image is unrecoverable — the crop source
        // is gone. Bounce to the start with an explanation rather than
        // rendering a broken canvas.
        if (state.step !== 'upload' && !state.sheetImageDataUrl) {
          state.step = 'upload';
          state.detections = [];
          state.restoreWarning =
            'Your previous upload could not be restored — the photo was too large to save. Please pick it again.';
        }
        state.hasHydrated = true;
      },
    },
  ),
);
