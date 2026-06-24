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

/* ─── Fallback AI Responses ──────────────────────────────────────────── */

function generateResponse(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('valuable') || q.includes('most valuable') || q.includes('worth')) {
    return `Here's an analysis of your most valuable stamps:\n\n**Top 5 by Estimated Value:**\n\n1. **1856 British Guiana 1¢ Magenta** — $9,200.00\n   - Condition: Very Fine, Rarity: Extremely Rare\n   - *14% increase in last 90 days*\n\n2. **1847 5¢ Benjamin Franklin** — $4,890.00\n   - Condition: Fine, Scott #1\n   - *15% increase from eBay comps*\n\n3. **1840 Penny Black** — $3,650.00\n   - Condition: Very Fine, SG #1\n   - *Strong demand from UK collectors*\n\n4. **1855 Treskilling Yellow** — $2,350.00\n   - Condition: Used, Sweden's rarest stamp\n   - *Stable pricing, limited supply*\n\n5. **1918 Inverted Jenny 24¢** — $1,180.00\n   - Condition: Fine, Scott #C3a\n   - *Slight decline, market correction*\n\nYour **top 5 stamps represent 85.4%** of your total collection value. Consider diversifying into more mid-range pieces for balance.`;
  }

  if (q.includes('trend') || q.includes('market')) {
    return `**Stamp Market Trends — Q2 2026**\n\n📈 **Growth Areas:**\n- US Classic Issues (pre-1900): +8-12%\n- British Commonwealth: +5-7%\n- Error/Variety stamps: +15-20% premium\n- Chinese Imperial stamps: +10-18%\n\n📉 **Declining:**\n- Modern commemoratives: -3-5%\n- Mint sheets (post-1980): flat to -2%\n- CTO (canceled-to-order): -5-8%\n\n**Key Insights:**\n- Auction houses report 23% increase in online bidding\n- Stamps graded by PSE/APEX commanding 30-50% premiums\n- Increasing crossover interest from coin collectors\n- Investment-grade stamps (>$1,000) outperforming equities YTD\n\nYour collection is **well-positioned** with strong holdings in the growth sectors.`;
  }

  if (q.includes('identify') || q.includes('what is') || q.includes('what stamp')) {
    return `I'd be happy to help identify your stamp! Here's what I need:\n\n**For best results, provide:**\n\n1. 📸 **Front photo** — Clear, well-lit, showing full design\n2. 🔄 **Back photo** — Reveals watermarks the gum condition\n3. 📏 **Perforations visible** — Helps narrow down varieties\n\n**What I analyze:**\n- Design elements and imagery\n- Denomination and currency\n- Color shades and printing method\n- Perforation gauge (if visible)\n- Cancellation marks and postmarks\n- Paper type and watermark patterns\n\n**Upload an image** using the camera button below and I'll provide:\n- Country of origin and issue year\n- Scott/Michel catalog numbers\n- Condition assessment\n- Estimated market value\n- Known varieties and errors`;
  }

  if (q.includes('error') || q.includes('mistake') || q.includes('variety')) {
    return `**Valuable Stamp Errors to Hunt For:**\n\n🔴 **Inverted Centers** (Most Valuable)\n- Design printed upside down\n- Famous: Inverted Jenny ($1.5M+), Pan-Am Invert ($100K+)\n\n🟡 **Color Errors**\n- Wrong ink color used\n- Example: 1851 Baden 9 Kreuzer (green instead of rose)\n\n🟢 **Imperforate Errors**\n- Missing perforations on one or more sides\n- Check edges carefully — some are just trimmed\n\n🔵 **Double Prints**\n- Offset or doubled impressions\n- Can be subtle — use magnification\n\n🟣 **Watermark Varieties**\n- Inverted, reversed, or missing watermarks\n- Hold stamp to light or use watermark fluid\n\n**Pro Tips:**\n- Always use a **10x loupe** for examination\n- Compare against catalog illustrations carefully\n- Document any anomalies with **high-res photos**\n- Get expert authentication for potential high-value errors\n\nWant me to examine any of your stamps for errors? Upload a detailed photo!`;
  }

  if (q.includes('country') || q.includes('countries') || q.includes('trending')) {
    return `**Trending Stamp-Collecting Countries (2026):**\n\n1. 🇺🇸 **United States** — Always strong demand, especially classics\n2. 🇬🇧 **Great Britain** — Penny Black and Victorian era surging\n3. 🇨🇳 **China** — Explosive growth in Imperial and early PRC issues\n4. 🇮🇳 **India** — Growing domestic collector base, +12% YoY\n5. 🇭🇰 **Hong Kong** — Treaty port stamps in high demand\n6. 🇩🇪 **Germany** — State issues and Zeppelin covers trending\n7. 🇯🇵 **Japan** — Dragon stamps and early issues gaining\n8. 🇦🇺 **Australia** — Kangaroo and Map stamps popular\n\nYour collection has strong representation in **US and GB**, which are the two most liquid markets. Consider adding some **Chinese Imperial** issues for growth potential.`;
  }

  if (q.includes('collection') || q.includes('breakdown') || q.includes('analyze')) {
    return `**Your Collection Analysis:**\n\n📊 **Overview:**\n- Total Stamps: 87\n- Total Value: $24,892.50\n- Average Per Stamp: $286.12\n- Countries Represented: 12\n\n**By Region:**\n- North America: 42 stamps (48%) — $14,200\n- Europe: 31 stamps (36%) — $8,400\n- Asia: 8 stamps (9%) — $1,600\n- Other: 6 stamps (7%) — $692\n\n**By Condition:**\n- Mint/Mint NH: 23 (26%)\n- Very Fine: 31 (36%)\n- Fine: 19 (22%)\n- Used/Other: 14 (16%)\n\n**By Era:**\n- Classic (pre-1900): 18 stamps — highest value concentration\n- Semi-Modern (1900-1950): 34 stamps\n- Modern (post-1950): 35 stamps\n\n**Recommendations:**\n- Your collection is **top-heavy** — consider adding mid-range pieces\n- Strong in **US Classics** — a key strength\n- **Underweight in Asian stamps** — growth opportunity`;
  }

  if (q.includes('grade') || q.includes('grading')) {
    return `**Stamp Grading Guide:**\n\n**Numerical Scale (used by PSE/APEX):**\n- **100** — Gem: Perfectly centered, pristine condition\n- **98** — Superb: Nearly perfect, trivial centering variance\n- **95** — Extremely Fine: Balanced margins, fresh colors\n- **90** — Very Fine/XF: Well-centered, attractive\n- **85** — Very Fine: Normal centering, clean\n- **80** — Fine/VF: Slightly off-center but presentable\n- **75** — Fine: Perforations may touch design slightly\n- **70** — Fine: Clear of design but not well-centered\n- **Below 70** — Below Fine: Various defects\n\n**Key Factors:**\n- **Centering** — Most important factor (40% of grade)\n- **Gum condition** — OG, NH, disturbed, regummed\n- **Color freshness** — Fading reduces grade\n- **Perforations** — Missing, short, or pulled perfs\n- **Cancellation** — Light, heavy, pen cancel\n\n**Grading premium** can be 2-5x between Fine and Superb grades for the same stamp!`;
  }

  if (q.includes('store') || q.includes('storage') || q.includes('preserve')) {
    return `**Best Practices for Stamp Storage:**\n\n📦 **Albums:**\n- Use **acid-free** stockbooks or hingeless albums\n- Lighthouse, Lindner, and Scott are top brands\n- Never use magnetic or self-adhesive pages\n\n🌡️ **Environment:**\n- Temperature: 65-72°F (18-22°C)\n- Humidity: 40-55% — use a dehumidifier if needed\n- Avoid direct sunlight and fluorescent lights\n- Keep away from basements and attics\n\n🔧 **Handling:**\n- Always use **stamp tongs** (not fingers)\n- Never touch the face of a stamp\n- Use a **magnifying glass** for examination\n- Handle over a soft, clean surface\n\n📎 **Mounting:**\n- **Mounts** (Showgard, Hawid) for mint stamps\n- **Hinges** are acceptable for used stamps only\n- Never tape, glue, or staple stamps\n\n⚡ **Insurance:**\n- Photograph your entire collection\n- Keep a digital inventory (PerdueStampVault handles this!)\n- Consider specialized collectibles insurance for values >$5,000`;
  }

  if (q.includes('auction') || q.includes('result')) {
    return `**Recent Notable Auction Results:**\n\n🏛️ **Siegel Auction Galleries (May 2026):**\n- 1868 1¢ Z-Grill: **$1.2M** (new record)\n- 1847 10¢ Washington, superb: **$48,000**\n- 1869 24¢ Inverted Center: **$210,000**\n\n🏛️ **Spink & Son (April 2026):**\n- 1840 Penny Black, Plate 1a: **£38,000**\n- 1882 £5 Orange: **£15,500**\n\n🏛️ **Robert A. Siegel (March 2026):**\n- 1918 Inverted Jenny block of 4: **$4.8M**\n- 1851 12¢ Black: **$22,000**\n\n**Market Takeaways:**\n- Top-tier rarities continue setting records\n- Graded stamps (PSE) commanding significant premiums\n- Online bidding now represents 60% of sales\n- Asian buyer participation up 35% YoY`;
  }

  return `Great question! I can help you with:\n\n- 🔍 **Stamp identification** — Upload a photo for AI analysis\n- 💰 **Price estimates** — Get current market values\n- 📊 **Collection insights** — Portfolio analysis and recommendations\n- 📈 **Market research** — Trends, auction results, and forecasts\n- ⚠️ **Error detection** — Find valuable printing errors\n- 📚 **Knowledge base** — Grading, storage, and collecting tips\n\nWhat would you like to explore? Try one of the conversation starters on the left, or ask anything about stamps and collecting!`;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showFollowUps, setShowFollowUps] = useState(false);

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

      /* Try streaming API, fallback to local */
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
      } catch {
        await new Promise((r) => setTimeout(r, 1000 + Math.random() * 800));
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            role: 'assistant',
            content: generateResponse(content.trim()),
            timestamp: new Date().toISOString(),
            context: null,
          },
        ]);
        setShowFollowUps(true);
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
  }, [isListening]);

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
              <VoiceButton
                isListening={isListening}
                onToggle={handleVoiceToggle}
                size="sm"
              />

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
