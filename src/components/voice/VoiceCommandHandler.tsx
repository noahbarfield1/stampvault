'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import { useStampsStore } from '@/store/stamps';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface VoiceCommand {
  pattern: RegExp;
  action: (match: RegExpMatchArray) => void;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export default function VoiceCommandHandler() {
  const router = useRouter();
  const voiceSession = useUIStore((s) => s.voiceSession);
  const updateVoiceSession = useUIStore((s) => s.updateVoiceSession);
  const openChat = useUIStore((s) => s.openChat);
  const setFilters = useStampsStore((s) => s.setFilters);
  const stamps = useStampsStore((s) => s.stamps);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const setVoiceListening = useCallback(
    (isListening: boolean) => {
      updateVoiceSession({ isListening });
    },
    [updateVoiceSession]
  );

  const setVoiceTranscript = useCallback(
    (transcript: string) => {
      updateVoiceSession({ transcript });
    },
    [updateVoiceSession]
  );

  const setChatPanelOpen = useCallback(
    (open: boolean) => {
      if (open) openChat();
    },
    [openChat]
  );

  const getTotalValue = useCallback(() => {
    return stamps.reduce(
      (sum, stamp) => sum + (stamp.pricing?.estimatedValue ?? 0),
      0
    );
  }, [stamps]);

  /* ── Speak feedback ─────────────────────────────────────────────────── */
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined') return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = synth.getVoices();
    const preferred = voices.find(
      (v) =>
        v.name.includes('Google') ||
        v.name.includes('Samantha') ||
        v.name.includes('Daniel')
    );
    if (preferred) utterance.voice = preferred;

    synth.speak(utterance);
  }, []);

  /* ── Command Definitions ────────────────────────────────────────────── */
  const getCommands = useCallback((): VoiceCommand[] => [
    {
      pattern: /^(?:show\s+me|search\s+for|find)\s+(.+)$/i,
      action: (match) => {
        const query = match[1];
        setFilters({ search: query });
        router.push('/collection');
        speak(`Searching for ${query}`);
      },
    },
    {
      pattern: /^(?:open|go\s+to|navigate\s+to)\s+(dashboard|home)$/i,
      action: () => {
        router.push('/');
        speak('Opening dashboard');
      },
    },
    {
      pattern: /^(?:open|go\s+to|navigate\s+to)\s+collection$/i,
      action: () => {
        router.push('/collection');
        speak('Opening collection');
      },
    },
    {
      pattern: /^(?:open|go\s+to|navigate\s+to)\s+(upload|add\s+stamps?)$/i,
      action: () => {
        router.push('/upload');
        speak('Opening upload');
      },
    },
    {
      pattern: /^(?:open|go\s+to|navigate\s+to)\s+(prices?|price\s+tracker)$/i,
      action: () => {
        router.push('/prices');
        speak('Opening price tracker');
      },
    },
    {
      pattern: /^(?:open|go\s+to|navigate\s+to)\s+(settings|preferences)$/i,
      action: () => {
        router.push('/settings');
        speak('Opening settings');
      },
    },
    {
      pattern: /^(?:open|go\s+to|navigate\s+to)\s+(assistant|chat|ai)$/i,
      action: () => {
        router.push('/assistant');
        speak('Opening AI assistant');
      },
    },
    {
      pattern:
        /^(?:how\s+much\s+is|what(?:'s|\s+is)\s+(?:the\s+value\s+of|my\s+collection\s+worth)).*$/i,
      action: () => {
        const total = getTotalValue();
        const formatted = total.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
        });
        speak(
          `Your collection is currently valued at ${formatted}`
        );
      },
    },
  ], [router, setFilters, getTotalValue, setChatPanelOpen, speak]);

  /* ── Process Transcript ─────────────────────────────────────────────── */
  const processTranscript = useCallback(
    (transcript: string) => {
      const trimmed = transcript.trim();
      if (!trimmed) return;

      setVoiceTranscript(trimmed);

      const commands = getCommands();
      for (const cmd of commands) {
        const match = trimmed.match(cmd.pattern);
        if (match) {
          cmd.action(match);
          return;
        }
      }

      /* Fallback: treat as a chat question */
      setChatPanelOpen(true);
    },
    [getCommands, setVoiceTranscript, setChatPanelOpen]
  );

  /* ── Start/Stop Recognition ─────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    if (voiceSession.isListening && !recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          processTranscript(lastResult[0].transcript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Voice recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setVoiceListening(false);
        }
      };

      recognition.onend = () => {
        /* Restart if still listening (browser may auto-stop) */
        if (voiceSession.isListening && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {
            setVoiceListening(false);
          }
        }
      };

      recognitionRef.current = recognition;

      try {
        recognition.start();
      } catch {
        setVoiceListening(false);
      }
    } else if (!voiceSession.isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [voiceSession.isListening, processTranscript, setVoiceListening]);

  /* This is a logic-only component — no UI rendered */
  return null;
}
