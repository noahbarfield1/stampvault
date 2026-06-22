'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { ChatMessage } from '@/types/chat';
import styles from './MessageBubble.module.css';

/* ─── Props ──────────────────────────────────────────────────────────── */

interface MessageBubbleProps {
  message: ChatMessage;
}

/* ─── Markdown Renderer ──────────────────────────────────────────────── */

interface ParsedSegment {
  type: 'text' | 'bold' | 'italic' | 'code' | 'link' | 'codeblock';
  content: string;
  href?: string;
}

function parseInlineMarkdown(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      segments.push({ type: 'bold', content: match[2] });
    } else if (match[3]) {
      segments.push({ type: 'italic', content: match[4] });
    } else if (match[5]) {
      segments.push({ type: 'code', content: match[6] });
    } else if (match[7]) {
      segments.push({ type: 'link', content: match[8], href: match[9] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments;
}

function renderInline(segments: ParsedSegment[]): React.ReactNode[] {
  return segments.map((seg, i) => {
    switch (seg.type) {
      case 'bold':
        return <strong key={i}>{seg.content}</strong>;
      case 'italic':
        return <em key={i}>{seg.content}</em>;
      case 'code':
        return <code key={i}>{seg.content}</code>;
      case 'link':
        return (
          <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer">
            {seg.content}
          </a>
        );
      default:
        return <span key={i}>{seg.content}</span>;
    }
  });
}

function renderMarkdown(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent = '';
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const Tag = listType;
      elements.push(
        <Tag key={`list-${elements.length}`}>
          {listItems.map((item, li) => (
            <li key={li}>{renderInline(parseInlineMarkdown(item))}</li>
          ))}
        </Tag>
      );
      listItems = [];
      listType = null;
    }
  };

  lines.forEach((line, idx) => {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${idx}`}>
            <code>{codeBlockContent}</code>
          </pre>
        );
        codeBlockContent = '';
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockContent += (codeBlockContent ? '\n' : '') + line;
      return;
    }

    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    const olMatch = line.match(/^\d+\.\s+(.+)$/);

    if (ulMatch) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listItems.push(ulMatch[1]);
      return;
    }

    if (olMatch) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listItems.push(olMatch[1]);
      return;
    }

    flushList();

    if (line.trim() === '') return;

    elements.push(
      <p key={`p-${idx}`}>{renderInline(parseInlineMarkdown(line))}</p>
    );
  });

  flushList();

  return elements;
}

/* ─── Citation Extractor ─────────────────────────────────────────────── */

interface Citation {
  index: number;
  url: string;
}

function extractCitations(content: string): Citation[] {
  const citations: Citation[] = [];
  const regex = /\[(\d+)\]\((.+?)\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    citations.push({ index: parseInt(match[1], 10), url: match[2] });
  }

  return citations;
}

/* ─── Image Detection ────────────────────────────────────────────────── */

function extractImageUrl(content: string): string | null {
  const match = content.match(/!\[.*?\]\((.+?)\)/);
  return match ? match[1] : null;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export default function MessageBubble({ message }: MessageBubbleProps) {
  const roleClass = styles[message.role] || styles.user;

  const citations = useMemo(
    () => extractCitations(message.content),
    [message.content]
  );

  const imageUrl = useMemo(
    () => extractImageUrl(message.content),
    [message.content]
  );

  const contentWithoutImage = useMemo(() => {
    if (!imageUrl) return message.content;
    return message.content.replace(/!\[.*?\]\(.+?\)/g, '').trim();
  }, [message.content, imageUrl]);

  const renderedContent = useMemo(
    () => renderMarkdown(contentWithoutImage),
    [contentWithoutImage]
  );

  const formattedTime = useMemo(() => {
    const d = new Date(message.timestamp);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, [message.timestamp]);

  return (
    <motion.div
      className={roleClass}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30, duration: 0.3 }}
    >
      {/* Role label */}
      {message.role !== 'system' && (
        <div
          className={
            message.role === 'user'
              ? styles.roleLabelUser
              : styles.roleLabelAssistant
          }
        >
          {message.role === 'assistant' && (
            <svg className={styles.roleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-1a3 3 0 0 1 3-3V6a4 4 0 0 1 4-4z" />
              <path d="M9 18l-1 4" />
              <path d="M15 18l1 4" />
            </svg>
          )}
          {message.role === 'user' ? 'You' : 'StampVault AI'}
        </div>
      )}

      {/* Content */}
      <div className={styles.content}>{renderedContent}</div>

      {/* Image */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Attached image"
          className={styles.imageThumbnail}
          loading="lazy"
        />
      )}

      {/* Citations */}
      {citations.length > 0 && (
        <div className={styles.citations}>
          {citations.map((c) => (
            <a
              key={c.index}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.citation}
              title={c.url}
            >
              {c.index}
            </a>
          ))}
        </div>
      )}

      {/* Timestamp */}
      <div className={styles.timestamp}>{formattedTime}</div>
    </motion.div>
  );
}
