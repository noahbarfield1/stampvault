/* ──────────────────────────────────────────────────────────────────────────────
 * Shared types for the upload / selection flow.
 *
 * These previously lived in src/components/upload/SegmentationOverlay.tsx, so
 * the page, the review grid and the progress component all imported types from
 * a component that renders UI. Moving them here lets that component be replaced
 * without touching every importer.
 * ────────────────────────────────────────────────────────────────────────────── */

/** A detection box in percentage-of-image space. */
export interface BoundingBox {
  /** Left edge, 0-100. */
  x: number;
  /** Top edge, 0-100. */
  y: number;
  /** Width, 0-100. */
  width: number;
  /** Height, 0-100. */
  height: number;
}

export interface DetectedStamp {
  id: string;
  boundingBox: BoundingBox;
  /**
   * Detection confidence, 0-1.
   *
   * `null` means "nobody computed this" — which is the honest value for a whole
   * photo in batch mode, where no segmentation pass has run. Rendering a
   * confidence meter for a number nobody measured is itself a fabrication, so
   * consumers must check for null rather than defaulting it.
   */
  confidence: number | null;
  /** Data URL of the cropped region. Empty until the crop pass runs. */
  croppedImageUrl: string;
  description: string;
  /** Whether this stamp is selected for identification. */
  confirmed: boolean;
  /**
   * Retained for source compatibility with the older two-screen review flow.
   * Selection is now driven solely by `confirmed`; a tap includes or excludes,
   * and there is no third state.
   */
  rejected: boolean;
  /** Where the box came from. User-drawn boxes have no meaningful confidence. */
  source?: 'ai' | 'user';
}

/** Convert an API detection (x1/y1/x2/y2) into the UI's x/y/width/height box. */
export function toBoundingBox(api: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}): BoundingBox {
  return {
    x: api.x1,
    y: api.y1,
    width: api.x2 - api.x1,
    height: api.y2 - api.y1,
  };
}
