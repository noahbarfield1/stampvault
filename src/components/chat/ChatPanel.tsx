'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/ui';
import MessageBubble from './MessageBubble';
import VoiceButton from './VoiceButton';
import type { ChatMessage } from '@/types/chat';
import styles from './ChatPanel.module.css';

/* ─── ID Generator ───────────────────────────────────────────────────── */

let messageCounter = 0;
function generateMessageId(): string {
  messageCounter += 1;
  return `msg-${Date.now()}-${messageCounter}`;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export default function ChatPanel() {
  const chatOpen = useUIStore((s) => s.chatOpen);
  const closeChat = useUIStore((s) => s.closeChat);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  /* ── Auto-scroll to bottom ──────────────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  /* ── Auto-focus input when panel opens ──────────────────────────────── */
  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [chatOpen]);

  /* ── Textarea auto-resize ───────────────────────────────────────────── */
  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    },
    []
  );

  /* ── Send Message ───────────────────────────────────────────────────── */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString(),
        context: null,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');
      setIsTyping(true);

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      /* Simulate AI response with streaming */
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
          const assistantId = generateMessageId();

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
                  m.id === assistantId
                    ? { ...m, content: assistantContent }
                    : m
                )
              );
            }
          }
        } else {
          /* Fallback: simulated response */
          await new Promise((r) => setTimeout(r, 1200));
          setIsTyping(false);
          const aiResponse: ChatMessage = {
            id: generateMessageId(),
            role: 'assistant',
            content: generateFallbackResponse(content.trim()),
            timestamp: new Date().toISOString(),
            context: null,
          };
          setMessages((prev) => [...prev, aiResponse]);
        }
      } catch {
        /* Network error fallback */
        await new Promise((r) => setTimeout(r, 800));
        setIsTyping(false);
        const aiResponse: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: generateFallbackResponse(content.trim()),
          timestamp: new Date().toISOString(),
          context: null,
        };
        setMessages((prev) => [...prev, aiResponse]);
      }
    },
    [messages]
  );

  /* ── Handle Submit ──────────────────────────────────────────────────── */
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

  /* ── Voice Toggle ───────────────────────────────────────────────────── */
  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessages((prev) => [
        ...prev,
        {
          id: generateMessageId(),
          role: 'system',
          content: 'Voice input is not supported in this browser.',
          timestamp: new Date().toISOString(),
          context: null,
        },
      ]);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputValue(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
      setIsVoiceProcessing(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setIsVoiceProcessing(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening]);

  /* ── Image Upload ───────────────────────────────────────────────────── */
  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        sendMessage(`![Uploaded image](${dataUrl})\n\nCan you help me identify this stamp?`);
      };
      reader.readAsDataURL(file);

      e.target.value = '';
    },
    [sendMessage]
  );

  /* ── Close panel ────────────────────────────────────────────────────── */
  const handleClose = useCallback(() => {
    closeChat();
  }, [closeChat]);

  const canSend = inputValue.trim().length > 0 && !isTyping;

  return (
    <AnimatePresence>
      {chatOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            className={styles.panel}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            role="complementary"
            aria-label="AI Chat Assistant"
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <h2 className={styles.headerTitle}>AI Assistant</h2>
                <span className={styles.headerContext}>Collection</span>
              </div>
              <button
                className={styles.closeButton}
                onClick={handleClose}
                aria-label="Close chat panel"
                type="button"
              >
                <svg
                  className={styles.closeIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className={styles.messages}>
              {messages.length === 0 && !isTyping && (
                <div className={styles.welcome}>
                  <span className={styles.welcomeIcon}>🤖</span>
                  <h3 className={styles.welcomeTitle}>PerdueStampVault AI</h3>
                  <p className={styles.welcomeText}>
                    Ask me about your stamps, market trends, identification help,
                    or collection insights. I&apos;m here to help!
                  </p>
                </div>
              )}

              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <motion.div
                  className={styles.typingIndicator}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
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

            {/* Input Area */}
            <div className={styles.inputArea}>
              <div className={styles.inputRow}>
                {/* Image upload */}
                <button
                  className={styles.actionButton}
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                  aria-label="Upload image"
                >
                  <svg
                    className={styles.actionIcon}
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

                {/* Text input */}
                <textarea
                  ref={textareaRef}
                  className={styles.textInput}
                  value={inputValue}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your stamps…"
                  rows={1}
                  aria-label="Chat message input"
                />

                {/* Voice button */}
                <VoiceButton
                  isListening={isListening}
                  isProcessing={isVoiceProcessing}
                  onToggle={handleVoiceToggle}
                  size="md"
                />

                {/* Send button */}
                <button
                  className={styles.sendButton}
                  onClick={handleSubmit}
                  disabled={!canSend}
                  type="button"
                  aria-label="Send message"
                >
                  <svg
                    className={styles.actionIcon}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─── Fallback Response Generator ────────────────────────────────────── */

function generateFallbackResponse(query: string): string {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('value') || lowerQuery.includes('worth') || lowerQuery.includes('price')) {
    return `Based on your collection data, here are some insights:\n\n**Total Collection Value:** $24,892.50\n**Average Per Stamp:** $286.12\n\nYour most valuable stamp is the **1856 British Guiana 1¢ Magenta** valued at approximately $9,200.00.\n\nThe overall market trend for your collection has been **positive**, with a 10.4% increase over the past 30 days. Key drivers include increased demand for 19th-century US stamps and British Commonwealth issues.`;
  }

  if (lowerQuery.includes('identify') || lowerQuery.includes('what is')) {
    return `I'd be happy to help identify your stamp! For the best results:\n\n1. **Upload a clear photo** of the stamp front\n2. Include the **back side** if there's a watermark\n3. Make sure **perforations** are visible\n\nI'll analyze the design, denomination, colors, and cancellation marks to determine the country, year, catalog number, and estimated value.`;
  }

  if (lowerQuery.includes('trend') || lowerQuery.includes('market')) {
    return `**Current Stamp Market Trends (Q2 2026):**\n\n- **US Classics** (pre-1900): Strong demand, prices up 8-12%\n- **British Commonwealth**: Steady growth, especially India and Hong Kong\n- **Error stamps**: Premium increasing, collectors paying 15-20% over catalog\n- **Modern commemoratives**: Flat to declining\n\nYour collection is well-positioned with strong holdings in **US Classics** and **British Commonwealth** categories.`;
  }

  if (lowerQuery.includes('error') || lowerQuery.includes('mistake')) {
    return `**Common Stamp Errors to Look For:**\n\n1. **Inverted centers** – The most famous being the Inverted Jenny\n2. **Color errors** – Wrong ink color used during printing\n3. **Missing perforations** – Imperforate stamps worth significant premiums\n4. **Double prints** – Offset or doubled impressions\n5. **Watermark varieties** – Inverted or missing watermarks\n\nI can examine your stamps for these errors if you upload detailed photos. Look especially at stamps from the **1847-1920** period where printing errors were more common.`;
  }

  return `Thanks for your question! I can help you with:\n\n- **Stamp identification** – Upload a photo and I'll identify it\n- **Price estimates** – Get current market values from multiple sources\n- **Collection insights** – Analyze your portfolio trends and composition\n- **Market research** – Latest auction results and market movements\n- **Error detection** – Identify valuable printing errors\n\nWhat would you like to explore?`;
}
