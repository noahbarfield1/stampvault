'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
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
};

export default function DropZone({ onFilesSelected }: DropZoneProps) {
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newPreviews = acceptedFiles.map((file) => ({
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
    [onFilesSelected]
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    multiple: true,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={isDragActive ? styles.zoneActive : styles.zone}
      >
        <input {...getInputProps()} />
        <span className={styles.icon}>{isDragActive ? '📥' : '☁️'}</span>
        <h3 className={styles.title}>
          {isDragActive ? 'Drop your images here' : 'Upload Stamp Images'}
        </h3>
        <p className={styles.subtitle}>
          Drag and drop your stamp images, album pages, or click to browse
        </p>
        <p className={styles.formats}>
          Accepted: JPEG, PNG, WebP
        </p>

        {/* Camera button for mobile */}
        <button
          className={styles.cameraBtn}
          onClick={(e) => {
            e.stopPropagation();
            cameraRef.current?.click();
          }}
          type="button"
        >
          📷 Take Photo
        </button>
        <input
          ref={cameraRef}
          className={styles.cameraInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={handleCameraCapture}
        />
      </div>

      {/* Previews */}
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
