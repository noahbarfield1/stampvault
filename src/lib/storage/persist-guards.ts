/* ──────────────────────────────────────────────────────────────────────────────
 * Size guards for anything crossing into localStorage.
 *
 * Reported 2026-08-09 from a phone: "Could not save your stamps — The quota has
 * been exceeded." on a batch of fewer than five stamps. That wording is Safari's
 * verbatim localStorage message.
 *
 * A correctly-built record measures ~22.8KB (a 240px/0.7 JPEG thumbnail plus
 * metadata), so roughly 224 fit in Safari's ~5MB cap. Five stamps should not
 * have come close.
 *
 * The blowup came from `makeThumbnail`:
 *
 *     const out = drawToDataUrl(...);
 *     return out ?? dataUrl;      // <- the ORIGINAL 80-200KB crop
 *
 * `drawToDataUrl` returns null when `canvas.getContext('2d')` fails, which iOS
 * Safari does routinely under memory pressure — and decoding several 12MP
 * photos in one batch is how you get there. The caller received a full-
 * resolution image believing it was a thumbnail, and `partialize` persisted it
 * verbatim. A ~10x blowup per stamp, silently.
 *
 * That specific fallback is fixed at the source. This module is the second
 * layer: the store owns the storage constraint, so the store enforces it, and
 * no future upstream bug can put an oversized value into localStorage again.
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Largest thumbnail we will persist.
 *
 * A real 240px/0.7 JPEG measures 12-25KB. 48KB leaves generous headroom for an
 * unusually detailed stamp while still rejecting a full crop, which starts
 * around 80KB. Being wrong in the permissive direction costs a little space;
 * being wrong in the strict direction drops legitimate thumbnails.
 */
export const MAX_PERSISTED_THUMBNAIL_CHARS = 48 * 1024;

/**
 * A thumbnail safe to persist, or '' when it is too large to be one.
 *
 * Returns '' rather than throwing: this runs inside zustand's persist
 * middleware, where an exception aborts the whole save. Dropping one
 * thumbnail costs a placeholder image; throwing costs the user their stamps.
 * The full crop is still in IndexedDB, so nothing is actually lost.
 */
export function safeThumbnail(value: string | null | undefined): string {
  if (!value) return '';
  return value.length <= MAX_PERSISTED_THUMBNAIL_CHARS ? value : '';
}
