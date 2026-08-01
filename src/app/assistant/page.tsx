'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MessageBubble from '@/components/chat/MessageBubble';
import VoiceButton from '@/components/chat/VoiceButton';
import type { ChatMessage } from '@/types/chat';
import styles from './assistant.module.css';

/* ─── ID Generator ───────────────────────────────────────────────────── */

let msgCounter = 0;
function genId(): string {
  msgCounter += 1;
  return `amsg-${Date.now()}-${msgCounter}`;
}

/* ─── Conversation Starters ──────────────────────────────────────────── */

const STARTERS = [
  { icon: '💎', text: 'Tell me about my most valuable stamps' },
  { icon: '📈', text: 'Research stamp market trends' },
  { icon: '🔍', text: 'Help me identify a stamp' },
  { icon: '⚠️', text: 'What errors should I look for?' },
  { icon: '🌍', text: 'Which countries are trending?' },
  { icon: '📊', text: 'Analyze my collection breakdown' },
];

/* ─── Follow-up Suggestions ──────────────────────────────────────────── */

const FOLLOW_UPS = [
  'What makes a stamp valuable?',
  'Show me recent auction results',
  'How should I store my stamps?',
  'What are the rarest US stamps?',
  'Tell me about stamp grading',
];

/* ─── Component ──────────────────────────────────────────────────────── */

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('stampvault-settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.voiceEnabled === 'boolean') {
          setVoiceEnabled(parsed.voiceEnabled);
        }
      }
    } catch {
      // ignore malformed/unavailable storage
    }
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  /* ── Auto-scroll ────────────────────────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  /* ── Textarea auto-resize ───────────────────────────────────────────── */
  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    },
    []
  );

  /* ── Send Message ───────────────────────────────────────────────────── */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMessage: ChatMessage = {
        id: genId(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString(),
        context: null,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');
      setIsTyping(true);
      setShowFollowUps(false);

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (response.ok && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let assistantContent = '';
          const assistantId = genId();

          setIsTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              id: assistantId,
              role: 'assistant',
              content: '',
              timestamp: new Date().toISOString(),
              context: null,
            },
          ]);

          let done = false;
          while (!done) {
            const result = await reader.read();
            done = result.done;
            if (result.value) {
              assistantContent += decoder.decode(result.value, { stream: true });
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: assistantContent } : m
                )
              );
            }
          }
          setShowFollowUps(true);
        } else {
          throw new Error('API unavailable');
        }
      } catch (err) {
        console.error('[Assistant] Chat request failed:', err);
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            role: 'assistant',
            content:
              "Sorry, I couldn't reach the AI assistant just now. Please try again in a moment.",
            timestamp: new Date().toISOString(),
            context: null,
          },
        ]);
      }
    },
    [messages]
  );

  /* ── Handlers ───────────────────────────────────────────────────────── */
  const handleSubmit = useCallback(() => {
    sendMessage(inputValue);
  }, [inputValue, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleStarterClick = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  const handleFollowUp = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setShowFollowUps(false);
    setInputValue('');
  }, []);

  /* ── Voice ──────────────────────────────────────────────────────────── */
  const handleVoiceToggle = useCallback(() => {
    if (!voiceEnabled) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputValue(transcript);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, voiceEnabled]);

  /* ── Image Upload ───────────────────────────────────────────────────── */
  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        sendMessage(
          `![Stamp image](${reader.result})\n\nPlease identify this stamp and estimate its value.`
        );
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [sendMessage]
  );

  /* ── Follow-up suggestions (randomized subset) ──────────────────────── */
  const currentFollowUps = useMemo(() => {
    const shuffled = [...FOLLOW_UPS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }, [showFollowUps]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSend = inputValue.trim().length > 0 && !isTyping;

  return (
    <div className={styles.page}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div>
          <h1 className={styles.sidebarTitle}>AI Research Assistant</h1>
          <p className={styles.sidebarSubtitle}>
            Your expert philatelist, powered by AI. Ask anything about stamps,
            pricing, identification, or collecting.
          </p>
        </div>

        <p className={styles.startersLabel}>Conversation Starters</p>

        <div className={styles.starters}>
          {STARTERS.map((s) => (
            <motion.button
              key={s.text}
              className={styles.starterButton}
              onClick={() => handleStarterClick(s.text)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="button"
            >
              <span className={styles.starterIcon}>{s.icon}</span>
              <span className={styles.starterText}>{s.text}</span>
            </motion.button>
          ))}
        </div>

        <div className={styles.sidebarFooter}>
          <button
            className={styles.newChatButton}
            onClick={handleNewChat}
            type="button"
          >
            <svg
              className={styles.newChatIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Conversation
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className={styles.main}>
        {/* Messages */}
        <div className={styles.messages}>
          {messages.length === 0 && !isTyping && (
            <motion.div
              className={styles.welcomeState}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className={styles.welcomeEmoji}>🔬</span>
              <h2 className={styles.welcomeTitle}>
                PerdueStampVault Research Assistant
              </h2>
              <p className={styles.welcomeDescription}>
                I can identify stamps from photos, research market values, analyze
                your collection, and answer any philately questions. Choose a
                starter or type your question below.
              </p>
            </motion.div>
          )}

          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div
              className={styles.typingIndicator}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className={styles.typingDots}>
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Follow-up Suggestions */}
        <AnimatePresence>
          {showFollowUps && messages.length > 0 && (
            <motion.div
              className={styles.followUps}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3 }}
            >
              {currentFollowUps.map((text) => (
                <button
                  key={text}
                  className={styles.followUpButton}
                  onClick={() => handleFollowUp(text)}
                  type="button"
                >
                  {text}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <div className={styles.inputArea}>
          <div className={styles.inputWrapper}>
            <textarea
              ref={textareaRef}
              className={styles.textInput}
              value={inputValue}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about stamps, pricing, or identification…"
              rows={1}
              aria-label="Message input"
            />

            <div className={styles.inputActions}>
              {/* Image upload */}
              <button
                className={styles.inputButton}
                onClick={() => fileInputRef.current?.click()}
                type="button"
                aria-label="Upload image"
              >
                <svg
                  className={styles.inputIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className={styles.uploadInput}
                onChange={handleImageUpload}
              />

              {/* Voice */}
              {voiceEnabled && (
                <VoiceButton
                  isListening={isListening}
                  onToggle={handleVoiceToggle}
                  size="sm"
                />
              )}

              {/* Send */}
              <button
                className={styles.sendButton}
                onClick={handleSubmit}
                disabled={!canSend}
                type="button"
                aria-label="Send message"
              >
                <svg
                  className={styles.inputIcon}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
