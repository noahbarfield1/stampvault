/* ──────────────────────────────────────────────────────────────────────────────
 * StampVault – Voice Integration
 *
 * Browser-side voice I/O using:
 *   - Web Speech API (SpeechRecognition) for speech-to-text
 *   - SpeechSynthesis API for text-to-speech (fallback)
 *   - Vertex AI TTS endpoint for high-quality voice output
 *   - Command classification for routing voice input
 *
 * Every function is guarded with `typeof window` checks so this module can
 * be safely imported in SSR / server components without crashing.
 * ────────────────────────────────────────────────────────────────────────────── */

import type { VoiceCommand, VoiceSession } from '@/types/chat';

// ── Types ───────────────────────────────────────────────────────────────────

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

type SpeechRecognitionErrorEvent = Event & {
  error: string;
  message: string;
};

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

// ── Module State ────────────────────────────────────────────────────────────

let recognitionInstance: SpeechRecognitionInstance | null = null;
let currentSession: VoiceSession = {
  isListening: false,
  isProcessing: false,
  isSpeaking: false,
  transcript: '',
};

// ── Speech Recognition ──────────────────────────────────────────────────────

/**
 * Check if Web Speech API is available in the current environment.
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition
  );
}

/**
 * Initialize the SpeechRecognition instance.
 * Returns the instance or null if not supported.
 */
export function initSpeechRecognition(): SpeechRecognitionInstance | null {
  if (typeof window === 'undefined') return null;

  const SpeechRecognitionCtor =
    (window as unknown as Record<string, new () => SpeechRecognitionInstance>)
      .SpeechRecognition ||
    (window as unknown as Record<string, new () => SpeechRecognitionInstance>)
      .webkitSpeechRecognition;

  if (!SpeechRecognitionCtor) return null;

  const recognition = new SpeechRecognitionCtor();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognitionInstance = recognition;
  return recognition;
}

/**
 * Start listening for voice input.
 *
 * @param onResult   Called with the final transcript when the user stops speaking.
 * @param onInterim  Called with interim (partial) transcripts while speaking.
 * @param onError    Called if recognition encounters an error.
 * @returns The current VoiceSession state.
 */
export function startListening(
  onResult: (transcript: string) => void,
  onError: (error: string) => void,
  onInterim?: (transcript: string) => void,
): VoiceSession {
  if (typeof window === 'undefined') {
    return { ...currentSession, error: 'Voice not available on server' };
  }

  if (!recognitionInstance) {
    const instance = initSpeechRecognition();
    if (!instance) {
      return {
        ...currentSession,
        error: 'Speech recognition not supported in this browser',
      };
    }
  }

  const recognition = recognitionInstance!;

  recognition.onstart = () => {
    currentSession = {
      ...currentSession,
      isListening: true,
      isProcessing: false,
      transcript: '',
      error: undefined,
    };
  };

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      } else {
        interimTranscript += result[0].transcript;
      }
    }

    if (interimTranscript && onInterim) {
      currentSession = { ...currentSession, transcript: interimTranscript };
      onInterim(interimTranscript);
    }

    if (finalTranscript) {
      currentSession = {
        ...currentSession,
        transcript: finalTranscript,
        isProcessing: true,
        isListening: false,
      };
      onResult(finalTranscript);
    }
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    const errorMessage = mapSpeechError(event.error);
    currentSession = {
      ...currentSession,
      isListening: false,
      isProcessing: false,
      error: errorMessage,
    };
    onError(errorMessage);
  };

  recognition.onend = () => {
    currentSession = {
      ...currentSession,
      isListening: false,
    };
  };

  try {
    recognition.start();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to start recognition';
    currentSession = { ...currentSession, error: message };
    onError(message);
  }

  return currentSession;
}

/**
 * Stop the current speech recognition session.
 */
export function stopListening(): void {
  if (recognitionInstance) {
    try {
      recognitionInstance.stop();
    } catch {
      // May throw if not currently recognizing
    }
  }
  currentSession = {
    ...currentSession,
    isListening: false,
  };
}

/**
 * Get the current voice session state.
 */
export function getVoiceSession(): VoiceSession {
  return { ...currentSession };
}

// ── Text-to-Speech ──────────────────────────────────────────────────────────

/**
 * Speak text using the browser's SpeechSynthesis API (fallback) or
 * Vertex AI TTS for higher quality.
 *
 * @param text       The text to speak.
 * @param useVertex  If true, attempt Vertex AI TTS first (server-side only).
 */
export async function textToSpeech(
  text: string,
  useVertex = false,
): Promise<void> {
  if (typeof window === 'undefined') return;

  currentSession = { ...currentSession, isSpeaking: true };

  if (useVertex) {
    try {
      await vertexTTS(text);
      currentSession = { ...currentSession, isSpeaking: false };
      return;
    } catch {
      // Fall through to browser TTS
    }
  }

  return browserTTS(text);
}

/**
 * Browser-native SpeechSynthesis fallback.
 */
function browserTTS(text: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      currentSession = { ...currentSession, isSpeaking: false };
      reject(new Error('SpeechSynthesis not available'));
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';

    // Prefer a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Google') ||
          v.name.includes('Natural') ||
          v.name.includes('Neural')),
    );
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => {
      currentSession = { ...currentSession, isSpeaking: false };
      resolve();
    };

    utterance.onerror = (event) => {
      currentSession = { ...currentSession, isSpeaking: false };
      reject(new Error(`Speech synthesis error: ${event.error}`));
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * High-quality TTS via Vertex AI Text-to-Speech API.
 * Calls our own Next.js API route which proxies to Vertex.
 */
async function vertexTTS(text: string): Promise<void> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice: 'en-US-Studio-O',
      speakingRate: 1.0,
    }),
  });

  if (!response.ok) {
    throw new Error(`Vertex TTS failed: ${response.status}`);
  }

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);

  return new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentSession = { ...currentSession, isSpeaking: false };
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      currentSession = { ...currentSession, isSpeaking: false };
      reject(new Error('Audio playback failed'));
    };
    audio.play().catch(reject);
  });
}

/**
 * Stop any currently playing speech.
 */
export function stopSpeaking(): void {
  if (typeof window === 'undefined') return;
  window.speechSynthesis?.cancel();
  currentSession = { ...currentSession, isSpeaking: false };
}

// ── Voice Command Parser ────────────────────────────────────────────────────

/** Navigation keywords → route destinations */
const NAV_MAP: Record<string, string> = {
  home: '/',
  dashboard: '/',
  collection: '/collection',
  stamps: '/collection',
  upload: '/upload',
  scan: '/upload',
  chat: '/chat',
  assistant: '/chat',
  settings: '/settings',
  preferences: '/settings',
  knowledge: '/knowledge',
  'knowledge base': '/knowledge',
};

/** Action keywords */
const ACTION_KEYWORDS = [
  'upload',
  'scan',
  'delete',
  'edit',
  'save',
  'export',
  'print',
  'share',
  'refresh',
  'update prices',
  'identify',
];

/**
 * Parse a voice transcript into a structured VoiceCommand.
 *
 * Classification priority:
 *   1. Navigation ("go to …", "open …", "show me …")
 *   2. Search ("search for …", "find …", "look up …")
 *   3. Action ("upload …", "delete …", "scan …")
 *   4. Query (everything else → treated as a question)
 */
export function parseVoiceCommand(transcript: string): VoiceCommand {
  const normalized = transcript.toLowerCase().trim();

  // ── Navigation ──────────────────────────────────────────────────────────
  const navPatterns = [
    /^(?:go to|navigate to|open|show me|take me to|switch to)\s+(.+)$/i,
    /^(?:show|display)\s+(?:the\s+)?(.+?)(?:\s+page)?$/i,
  ];

  for (const pattern of navPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const destination = match[1].trim();
      const route = NAV_MAP[destination];
      if (route) {
        return { type: 'navigate', destination: route };
      }
      // Check partial matches
      for (const [key, value] of Object.entries(NAV_MAP)) {
        if (destination.includes(key)) {
          return { type: 'navigate', destination: value };
        }
      }
    }
  }

  // ── Search ──────────────────────────────────────────────────────────────
  const searchPatterns = [
    /^(?:search for|find|look up|search|look for)\s+(.+)$/i,
    /^(?:show me|filter by|filter for)\s+(.+?)(?:\s+stamps)?$/i,
  ];

  for (const pattern of searchPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      return { type: 'search', query: match[1].trim() };
    }
  }

  // ── Action ──────────────────────────────────────────────────────────────
  for (const keyword of ACTION_KEYWORDS) {
    if (normalized.startsWith(keyword)) {
      const rest = normalized.slice(keyword.length).trim();
      const params: Record<string, string> = {};
      if (rest) params.target = rest;
      return { type: 'action', action: keyword, params };
    }
  }

  // ── Fallback: Query ─────────────────────────────────────────────────────
  return { type: 'query', question: transcript.trim() };
}

// ── Error Mapping ───────────────────────────────────────────────────────────

function mapSpeechError(error: string): string {
  switch (error) {
    case 'no-speech':
      return 'No speech was detected. Please try again.';
    case 'audio-capture':
      return 'No microphone was found. Please check your audio settings.';
    case 'not-allowed':
      return 'Microphone permission was denied. Please allow microphone access.';
    case 'network':
      return 'A network error occurred. Please check your connection.';
    case 'aborted':
      return 'Speech recognition was aborted.';
    case 'language-not-supported':
      return 'The selected language is not supported.';
    case 'service-not-allowed':
      return 'Speech recognition service is not allowed.';
    default:
      return `Speech recognition error: ${error}`;
  }
}
