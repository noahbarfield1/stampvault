/* ──────────────────────────────────────────────────────────────────────────────
 * StampVault – Firebase Storage Operations
 *
 * Handles image uploads (stamps + album pages), thumbnail generation via
 * client-side canvas, and cleanup.
 * ────────────────────────────────────────────────────────────────────────────── */

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from './config';

// ── Constants ───────────────────────────────────────────────────────────────

const THUMBNAIL_SIZE = 200;
const JPEG_QUALITY = 0.85;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a deterministic-looking but unique path segment. */
function uid(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Resize an image File to a 200×200 JPEG thumbnail using an offscreen canvas.
 * Returns the thumbnail as a Blob.
 */
async function generateThumbnail(file: File): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Determine crop region (center-crop to square)
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = THUMBNAIL_SIZE;
      canvas.height = THUMBNAIL_SIZE;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      ctx.drawImage(img, sx, sy, size, size, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob returned null'));
        },
        'image/jpeg',
        JPEG_QUALITY,
      );
    };
    img.onerror = () => reject(new Error('Failed to load image for thumbnail'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Extract the Storage path from a full download URL so we can call
 * deleteObject on it later.
 */
function pathFromUrl(downloadUrl: string): string {
  const decoded = decodeURIComponent(downloadUrl);
  const match = decoded.match(/\/o\/(.+?)\?/);
  if (!match) throw new Error('Unable to parse storage path from URL');
  return match[1];
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Upload a stamp image and its auto-generated thumbnail.
 * Returns both download URLs.
 */
export async function uploadStampImage(
  file: File,
): Promise<{ imageUrl: string; thumbnailUrl: string }> {
  const id = uid();
  const ext = file.name.split('.').pop() ?? 'jpg';

  // Upload full-size image
  const imageRef = ref(storage, `stamps/${id}/original.${ext}`);
  const snapshot = await uploadBytes(imageRef, file, {
    contentType: file.type || 'image/jpeg',
    customMetadata: { originalName: file.name },
  });
  const imageUrl = await getDownloadURL(snapshot.ref);

  // Generate & upload thumbnail
  const thumbBlob = await generateThumbnail(file);
  const thumbRef = ref(storage, `stamps/${id}/thumb.jpg`);
  const thumbSnap = await uploadBytes(thumbRef, thumbBlob, {
    contentType: 'image/jpeg',
  });
  const thumbnailUrl = await getDownloadURL(thumbSnap.ref);

  return { imageUrl, thumbnailUrl };
}

/**
 * Upload an album / stock-page scan.
 * Returns the download URL.
 */
export async function uploadAlbumPage(file: File): Promise<string> {
  const id = uid();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const pageRef = ref(storage, `albumPages/${id}.${ext}`);
  const snapshot = await uploadBytes(pageRef, file, {
    contentType: file.type || 'image/jpeg',
    customMetadata: { originalName: file.name },
  });
  return getDownloadURL(snapshot.ref);
}

/**
 * Delete a stamp image (and its thumbnail sibling) from Storage.
 * Silently ignores "object-not-found" errors for idempotency.
 */
export async function deleteStampImage(imageUrl: string): Promise<void> {
  try {
    const imagePath = pathFromUrl(imageUrl);
    await deleteObject(ref(storage, imagePath));

    // Attempt to also remove the thumbnail
    const thumbPath = imagePath.replace(/\/original\.\w+$/, '/thumb.jpg');
    if (thumbPath !== imagePath) {
      try {
        await deleteObject(ref(storage, thumbPath));
      } catch {
        // Thumbnail may not exist; swallow silently.
      }
    }
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'storage/object-not-found') return;
    throw err;
  }
}

/**
 * Get the download URL for an arbitrary storage path.
 */
export async function getDownloadUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path));
}
