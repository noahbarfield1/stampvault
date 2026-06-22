'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import styles from './VoiceNoteRecorder.module.css';

/* ─── Props ──────────────────────────────────────────────────────────── */

interface VoiceNoteRecorderProps {
  onSave: (text: string) => void;
  className?: string;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export default function VoiceNoteRecorder({
  onSave,
  className = '',
}: VoiceNoteRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [duration, setDuration] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /* ── Duration Timer ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (isRecording) {
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  /* ── Format Duration ────────────────────────────────────────────────── */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /* ── Start Recording ────────────────────────────────────────────────── */
  const startRecording = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setTranscript(
        'Voice recognition is not supported in this browser. Please type your note manually.'
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript((finalTranscript + interim).trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Recognition error:', event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, []);

  /* ── Stop Recording ─────────────────────────────────────────────────── */
  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  /* ── Toggle ─────────────────────────────────────────────────────────── */
  const handleToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  /* ── Save ───────────────────────────────────────────────────────────── */
  const handleSave = useCallback(() => {
    if (transcript.trim()) {
      onSave(transcript.trim());
      setTranscript('');
      setDuration(0);
    }
  }, [transcript, onSave]);

  /* ── Clear ──────────────────────────────────────────────────────────── */
  const handleClear = useCallback(() => {
    setTranscript('');
    setDuration(0);
  }, []);

  return (
    <div className={`${styles.container} ${className}`}>
      {/* Controls Row */}
      <div className={styles.controls}>
        <button
          className={isRecording ? styles.recordButtonActive : styles.recordButton}
          onClick={handleToggle}
          type="button"
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isRecording ? (
            <div className={styles.stopIcon} />
          ) : (
            <svg
              className={styles.recordIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="1" width="6" height="12" rx="3" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        <span className={isRecording ? styles.statusRecording : styles.statusText}>
          {isRecording
            ? 'Recording… Speak your note'
            : transcript
              ? 'Review and edit your transcription'
              : 'Tap to record a voice note'}
        </span>

        {(isRecording || duration > 0) && (
          <span className={styles.duration}>{formatDuration(duration)}</span>
        )}
      </div>

      {/* Transcript Area */}
      {(transcript || isRecording) && (
        <div className={styles.transcriptArea}>
          <label className={styles.transcriptLabel} htmlFor="voiceTranscript">
            Transcription
          </label>
          <textarea
            id="voiceTranscript"
            className={styles.transcriptInput}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Transcribed text will appear here…"
            rows={3}
            disabled={isRecording}
          />

          <div className={styles.actions}>
            <button
              className={styles.clearButton}
              onClick={handleClear}
              type="button"
              disabled={isRecording}
            >
              Clear
            </button>
            <button
              className={styles.saveButton}
              onClick={handleSave}
              type="button"
              disabled={!transcript.trim() || isRecording}
            >
              Save Note
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
