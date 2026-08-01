'use client';

/* ──────────────────────────────────────────────────────────────────────────────
 * Two small explanation primitives.
 *
 *   <Tooltip>       an inline "?" you can TAP to read a short explanation
 *   <DismissibleHint> a one-time suggestion that stays dismissed
 *
 * Both are touch-first. A CSS :hover tooltip is invisible on a phone, and this
 * app is used primarily on one, so the trigger is a real focusable button that
 * toggles on tap; hover is only a desktop convenience.
 * ────────────────────────────────────────────────────────────────────────────── */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useUIStore } from '@/store/ui';
import styles from './InfoHint.module.css';

/* ── Tooltip ───────────────────────────────────────────────────────────── */

interface TooltipProps {
  /** Short heading shown in bold above the body. */
  title?: string;
  /** The explanation itself. Keep it to a sentence or two. */
  children: React.ReactNode;
  /** Accessible name for the trigger, e.g. "What does confidence mean?". */
  label: string;
}

export function Tooltip({ title, children, label }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [below, setBelow] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  /* Flip under the trigger when there is not enough room above it. */
  useEffect(() => {
    if (!open || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setBelow(rect.top < 140);
  }, [open]);

  /* Tap anywhere else, or press Escape, to close. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      {open && (
        <span id={id} role="tooltip" className={below ? styles.bubbleBelow : styles.bubble}>
          {title && <strong className={styles.bubbleTitle}>{title}</strong>}
          {children}
        </span>
      )}
    </span>
  );
}

/* ── Dismissible suggestion ────────────────────────────────────────────── */

interface HintProps {
  /**
   * Stable id. Dismissal is persisted against this, so changing it makes the
   * hint reappear for everyone who had already dismissed it.
   */
  id: string;
  title: string;
  children: React.ReactNode;
  icon?: string;
  /** Optional call to action. */
  action?: { label: string; href?: string; onSelect?: () => void };
  /** Render only when this is true — e.g. only suggest a backup once there is data. */
  when?: boolean;
}

export function DismissibleHint({
  id,
  title,
  children,
  icon = '💡',
  action,
  when = true,
}: HintProps) {
  const dismissedHints = useUIStore((s) => s.dismissedHints);
  const dismissHint = useUIStore((s) => s.dismissHint);
  const [mounted, setMounted] = useState(false);

  // dismissedHints is hydrated from localStorage, so rendering it during SSR
  // would mismatch. Wait for the client before deciding.
  useEffect(() => setMounted(true), []);

  const dismiss = useCallback(() => dismissHint(id), [dismissHint, id]);

  if (!mounted || !when || dismissedHints.includes(id)) return null;

  return (
    <div className={styles.hint} role="note">
      <span className={styles.hintIcon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.hintBody}>
        <span className={styles.hintTitle}>{title}</span>
        <p className={styles.hintText}>{children}</p>
        {action && (
          <div className={styles.hintActions}>
            {action.href ? (
              <Link href={action.href} className={styles.hintAction} onClick={dismiss}>
                {action.label}
              </Link>
            ) : (
              <button
                type="button"
                className={styles.hintAction}
                onClick={() => {
                  action.onSelect?.();
                  dismiss();
                }}
              >
                {action.label}
              </button>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        className={styles.hintDismiss}
        onClick={dismiss}
        aria-label={`Dismiss tip: ${title}`}
      >
        ✕
      </button>
    </div>
  );
}
