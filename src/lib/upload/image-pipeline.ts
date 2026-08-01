/* ──────────────────────────────────────────────────────────────────────────────
 * Client-side image pipeline for the upload flow.
 *
 * Extracted from src/app/upload/page.tsx so the sizing rules live in one place
 * and the page component is left with UI concerns only.
 *
 * ── The size budget ──────────────────────────────────────────────────────────
 * A 12MP phone photo is 3-5MB binary, which base64 inflates by ~1.37x. Vercel
 * hard-caps serverless request bodies at 4.5MB, so an un-downscaled sheet photo
 * 413s before it ever reaches Gemini. (next.config.ts's `bodySizeLimit: '10mb'`
 * applies only to Server Actions, NOT to route handlers, so it does not help.)
 *
 *   capture (12MP, 3-5MB)        held in memory only, never uploaded raw
 *     -> segment upload          SEGMENT_MAX_DIMENSION 1600 @ 0.8  ~250-450KB
 *     -> crop                    cropped at full res, then downscaled
 *     -> identify upload         CROP_MAX_DIMENSION 1024 @ 0.85    ~80-200KB
 *     -> persisted thumbnail     THUMBNAIL_MAX_DIMENSION 240 @ 0.7 ~12-25KB
 *
 * Gemini tiles images at roughly 768px internally, so 1600 is already generous
 * for detection and 1024 is generous for a single stamp.
 * ────────────────────────────────────────────────────────────────────────────── */

import type { BoundingBox } from '@/types/upload';

/** Max edge for the whole-page image sent to /api/stamps/segment. */
export const SEGMENT_MAX_DIMENSION = 1600;
export const SEGMENT_QUALITY = 0.8;

/** Max edge for a single cropped stamp sent to /api/stamps/identify. */
export const CROP_MAX_DIMENSION = 1024;
export const CROP_QUALITY = 0.85;

/** Max edge for the thumbnail kept in the collection list. */
export const THUMBNAIL_MAX_DIMENSION = 240;
export const THUMBNAIL_QUALITY = 0.7;

/**
 * Vercel's serverless request body cap. Checked client-side so an oversized
 * payload produces an actionable message instead of an opaque 413.
 */
export const MAX_UPLOAD_BYTES = 4_000_000;

const DATA_URL_RE = /^data:(image\/[\w+.-]+);base64,/;

/** Read the declared mime type out of a data URL, if it has one. */
export function dataUrlMimeType(dataUrl: string): string | null {
  return DATA_URL_RE.exec(dataUrl)?.[1] ?? null;
}

/** Approximate decoded byte size of a base64 data URL, without allocating it. */
export function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
  });
}

/** Decode a data URL into an HTMLImageElement. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = src;
  });
}

function drawToDataUrl(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  quality: number,
): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(dw));
  canvas.height = Math.max(1, Math.round(dh));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Downscale a File to a JPEG data URL bounded by `maxDimension`.
 *
 * Note: when the image is already smaller than the bound, the ORIGINAL data URL
 * is returned untouched — so the result is not guaranteed to be JPEG. Callers
 * that pass a mime type onward must read it with `dataUrlMimeType` rather than
 * assuming image/jpeg.
 */
export async function resizeImageForUpload(
  file: File,
  maxDimension = SEGMENT_MAX_DIMENSION,
  quality = SEGMENT_QUALITY,
): Promise<string> {
  const original = await fileToDataUrl(file);
  let img: HTMLImageElement;
  try {
    img = await loadImage(original);
  } catch {
    return original;
  }

  const scale = Math.min(
    1,
    maxDimension / Math.max(img.naturalWidth, img.naturalHeight),
  );
  if (scale >= 1) return original;

  const out = drawToDataUrl(
    img,
    0,
    0,
    img.naturalWidth,
    img.naturalHeight,
    img.naturalWidth * scale,
    img.naturalHeight * scale,
    quality,
  );
  return out ?? original;
}

/** Produce a small thumbnail from an existing image data URL. */
export async function makeThumbnail(
  dataUrl: string,
  maxDimension = THUMBNAIL_MAX_DIMENSION,
  quality = THUMBNAIL_QUALITY,
): Promise<string> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(
    1,
    maxDimension / Math.max(img.naturalWidth, img.naturalHeight),
  );
  const out = drawToDataUrl(
    img,
    0,
    0,
    img.naturalWidth,
    img.naturalHeight,
    img.naturalWidth * scale,
    img.naturalHeight * scale,
    quality,
  );
  return out ?? dataUrl;
}

/**
 * A cropper bound to one decoded source image.
 *
 * The previous implementation constructed `new Image()` and awaited a full
 * decode inside the per-box loop, so cropping 20 boxes decoded a 12MP photo 20
 * times — several seconds of blocked main thread with no feedback. Decoding
 * once and reusing the element is safe: `drawImage` does not mutate its source.
 */
export interface Cropper {
  /** Crop a percentage-space box, downscaled to `CROP_MAX_DIMENSION`. */
  crop(box: BoundingBox): string;
  readonly width: number;
  readonly height: number;
}

export async function createCropper(srcUrl: string): Promise<Cropper> {
  const img = await loadImage(srcUrl);

  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    crop(box: BoundingBox): string {
      const sx = (box.x / 100) * img.naturalWidth;
      const sy = (box.y / 100) * img.naturalHeight;
      const sw = Math.max(1, (box.width / 100) * img.naturalWidth);
      const sh = Math.max(1, (box.height / 100) * img.naturalHeight);

      // Crop at full source resolution, then bound the OUTPUT. Cropping from a
      // pre-downscaled source would throw away detail the model needs.
      const scale = Math.min(1, CROP_MAX_DIMENSION / Math.max(sw, sh));
      const out = drawToDataUrl(img, sx, sy, sw, sh, sw * scale, sh * scale, CROP_QUALITY);
      if (!out) throw new Error('Canvas 2D context not available');
      return out;
    },
  };
}

/** Yield to the browser so a long crop loop cannot freeze the frame loop. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}
