'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUIStore } from '@/store/ui';
import styles from './DropZone.module.css';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
}

interface FilePreview {
  file: File;
  url: string;
}

const ACCEPTED_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],
};

/** Thrown when a HEIC photo cannot be decoded in this browser. */
export class HeicConversionError extends Error {
  constructor(public fileName: string) {
    super(
      `Could not read ${fileName}. Open it in Photos and share it as a JPEG, or set ` +
        `Camera → Formats → Most Compatible on your iPhone.`,
    );
    this.name = 'HeicConversionError';
  }
}

const isHeic = (file: File) => {
  const n = file.name.toLowerCase();
  return (
    n.endsWith('.heic') ||
    n.endsWith('.heif') ||
    file.type === 'image/heic' ||
    file.type === 'image/heif'
  );
};

/**
 * Convert an iPhone HEIC photo to JPEG.
 *
 * Throws on failure — deliberately. The previous implementation had two
 * fallbacks that were far worse than an error:
 *
 *   1. It matched the FILENAME against the catalog and substituted a completely
 *      different stamp's reference photo as if it were the user's own. That
 *      image then flowed into segmentation AND identification, so the app would
 *      confidently identify and price a stamp the user does not own.
 *   2. It drew a gradient card reading "HEIC Image Preview" and returned that
 *      as the photo, which the AI would then be asked to identify.
 *
 * A visible error the user can act on beats a silent, confident wrong answer.
 */
const convertHeicFile = async (file: File): Promise<File> => {
  if (!isHeic(file)) return file;

  let converted: Blob | Blob[] | null = null;
  try {
    const heic2any = (await import('heic2any')).default;
    converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
  } catch (e) {
    console.error('[DropZone] heic2any failed:', e);
    throw new HeicConversionError(file.name);
  }

  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!blob) throw new HeicConversionError(file.name);

  return new File([blob], file.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' });
};

export default function DropZone({ onFilesSelected }: DropZoneProps) {
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [converting, setConverting] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const addToast = useUIStore((s) => s.addToast);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // heic2any decodes on the main thread and takes seconds on a 12MP photo,
      // so the picker used to appear to hang with no feedback at all.
      setConverting(acceptedFiles.length);
      const accepted: File[] = [];
      const rejected: string[] = [];

      for (const file of acceptedFiles) {
        try {
          accepted.push(await convertHeicFile(file));
        } catch (err) {
          rejected.push(err instanceof Error ? err.message : `Could not read ${file.name}`);
        }
      }
      setConverting(0);

      // Reject the file rather than substituting anything in its place.
      for (const message of rejected) {
        addToast({ type: 'error', title: 'Photo could not be read', message });
      }
      if (accepted.length === 0) return;

      const newPreviews = accepted.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }));
      setPreviews((prev) => {
        const updated = [...prev, ...newPreviews];
        queueMicrotask(() => {
          onFilesSelected(updated.map((p) => p.file));
        });
        return updated;
      });
    },
    [onFilesSelected, addToast]
  );

  const removeFile = useCallback(
    (index: number) => {
      setPreviews((prev) => {
        URL.revokeObjectURL(prev[index].url);
        const updated = prev.filter((_, i) => i !== index);
        queueMicrotask(() => {
          onFilesSelected(updated.map((p) => p.file));
        });
        return updated;
      });
    },
    [onFilesSelected]
  );

  const handleCameraCapture = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const files = Array.from(e.target.files);
        onDrop(files);
      }
    },
    [onDrop]
  );

  const loadTestStamps = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const testStampNames = [
        'stamp-4.png',
        'IMG_4184.heic',
        'stamp-2.png',
        'stamp-3.png',
        'screenshot.png',
        'inverted-jenny.jpg',
      ];

      const loadedFiles: File[] = [];
      for (const name of testStampNames) {
        try {
          const response = await fetch(`/test-stamps/${encodeURIComponent(name)}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${name}`);
          }
          const blob = await response.blob();

          let mimeType = 'image/png';
          if (name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg')) {
            mimeType = 'image/jpeg';
          } else if (name.toLowerCase().endsWith('.heic')) {
            mimeType = 'image/heic';
          }

          const file = new File([blob], name, { type: mimeType });
          loadedFiles.push(file);
        } catch (error) {
          console.error(`Error loading test stamp ${name}:`, error);
        }
      }

      if (loadedFiles.length > 0) {
        onDrop(loadedFiles);
      }
    },
    [onDrop]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    multiple: true,
    noClick: true,
  });

  return (
    <div>
      {/* Hidden camera input — OUTSIDE getRootProps to avoid dropzone click conflicts */}
      <input
        ref={cameraRef}
        className={styles.cameraInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        onChange={handleCameraCapture}
      />

      {/* Drag-and-drop zone (noClick — users use action buttons below) */}
      <div
        {...getRootProps()}
        className={isDragActive ? styles.zoneActive : styles.zone}
      >
        <input {...getInputProps()} />
        <span className={styles.icon}>{isDragActive ? '📥' : '☁️'}</span>
        <h3 className={styles.title}>
          {isDragActive ? 'Drop your images here' : 'Upload Stamp Images'}
        </h3>
        
        <div className={styles.modeCards}>
          <div className={styles.modeCard}>
            <span className={styles.modeIcon}>📄</span>
            <div className={styles.modeText}>
              <strong>Single & Sheet Mode</strong>
              <span>Upload 1 photo. We'll automatically detect and crop all stamps on the page.</span>
            </div>
          </div>
          <div className={styles.modeCard}>
            <span className={styles.modeIcon}>📚</span>
            <div className={styles.modeText}>
              <strong>Batch Mode</strong>
              <span>Upload multiple photos. We'll process them all at once into your collection.</span>
            </div>
          </div>
        </div>

        <p className={styles.formats}>
          Drag and drop your stamp images, or use the buttons below. Accepted: JPEG, PNG, WebP, HEIC
        </p>
      </div>

      {/* Action buttons — outside dropzone for clean event handling */}
      <div className={styles.actionRow}>
        <button
          className={styles.cameraBtn}
          onClick={(e) => {
            e.stopPropagation();
            cameraRef.current?.click();
          }}
          type="button"
        >
          <span className={styles.actionIcon}>📷</span>
          <span>Take Photo</span>
        </button>

        <button
          className={styles.galleryBtn}
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
          type="button"
        >
          <span className={styles.actionIcon}>📁</span>
          <span>Browse Gallery</span>
        </button>
      </div>

      {process.env.NODE_ENV !== 'production' && (
        <div className={styles.secondaryRow}>
          <button
            className={styles.loadBtn}
            onClick={loadTestStamps}
            type="button"
          >
            🧪 Load 5 Test Stamps
          </button>
        </div>
      )}

      {/* Previews */}
      {converting > 0 && (
        <p className={styles.convertingNote} role="status" aria-live="polite">
          Converting {converting} photo{converting === 1 ? '' : 's'} from HEIC… this can take a
          few seconds.
        </p>
      )}

      {previews.length > 0 && (
        <div className={styles.previews}>
          {previews.map((preview, index) => (
            <div key={`${preview.file.name}-${index}`} className={styles.preview}>
              <img
                className={styles.previewImage}
                src={preview.url}
                alt={preview.file.name}
              />
              <button
                className={styles.previewRemove}
                data-touch-reveal
                onClick={() => removeFile(index)}
                type="button"
                aria-label={`Remove ${preview.file.name}`}
              >
                ✕
              </button>
              <div className={styles.previewName}>{preview.file.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
