'use client';

/* ──────────────────────────────────────────────────────────────────────────────
 * The "More" bottom sheet.
 *
 * Exists because /settings was genuinely unreachable on a phone: it lived only
 * in the Sidebar, which is `display: none` below 860px, while MobileNav had
 * five tabs and none of them was Settings — and the upload page told the user
 * to go there.
 * ────────────────────────────────────────────────────────────────────────────── */

import React, { useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import { useStampsStore } from '@/store/stamps';
import styles from './MoreSheet.module.css';

interface Entry {
  href?: string;
  icon: string;
  label: string;
  sub?: string;
  onSelect?: () => void;
}

export default function MoreSheet() {
  const open = useUIStore((s) => s.moreSheetOpen);
  const setOpen = useUIStore((s) => s.setMoreSheetOpen);
  const startTour = useUIStore((s) => s.startTour);
  const resetHints = useUIStore((s) => s.resetHints);
  const addToast = useUIStore((s) => s.addToast);
  const stamps = useStampsStore((s) => s.stamps);
  const pathname = usePathname();
  const router = useRouter();
  const sheetRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setOpen(false), [setOpen]);

  /* Escape to close, and lock the page behind the sheet so it cannot scroll. */
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.querySelector<HTMLElement>('a,button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, close]);

  /* Close on navigation, or the sheet stays over the page it just opened. */
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  const handleExport = useCallback(() => {
    close();
    if (stamps.length === 0) {
      addToast({ type: 'info', title: 'Nothing to export yet', message: 'Add a stamp first.' });
      return;
    }
    const blob = new Blob([JSON.stringify(stamps, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stampvault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({
      type: 'success',
      title: 'Backup downloaded',
      message: `${stamps.length} stamp${stamps.length === 1 ? '' : 's'} saved to your device.`,
    });
  }, [stamps, close, addToast]);

  if (!open) return null;

  const navigation: Entry[] = [
    { href: '/assistant', icon: '✧', label: 'AI Assistant', sub: 'Ask about a stamp' },
    { href: '/settings', icon: '⚙', label: 'Settings', sub: 'Services and preferences' },
  ];

  const help: Entry[] = [
    { href: '/tutorial', icon: '?', label: 'How it works', sub: 'What the app can and cannot do' },
    {
      icon: '➤',
      label: 'Replay the guided tour',
      onSelect: () => {
        close();
        router.push('/dashboard');
        startTour();
      },
    },
    {
      icon: '↺',
      label: 'Show all tips again',
      sub: 'Bring back dismissed suggestions',
      onSelect: () => {
        resetHints();
        close();
        addToast({ type: 'success', title: 'Tips reset', message: 'Suggestions will show again.' });
      },
    },
  ];

  const data: Entry[] = [
    {
      icon: '↓',
      label: 'Export collection',
      sub: `${stamps.length} stamp${stamps.length === 1 ? '' : 's'} as JSON`,
      onSelect: handleExport,
    },
  ];

  const renderEntry = (e: Entry) => {
    const body = (
      <>
        <span className={styles.icon} aria-hidden="true">
          {e.icon}
        </span>
        <span className={styles.itemBody}>
          <span>{e.label}</span>
          {e.sub && <span className={styles.itemSub}>{e.sub}</span>}
        </span>
      </>
    );

    if (e.href) {
      const active = pathname === e.href;
      return (
        <Link
          key={e.label}
          href={e.href}
          className={active ? styles.itemActive : styles.item}
          onClick={close}
          aria-current={active ? 'page' : undefined}
        >
          {body}
        </Link>
      );
    }
    return (
      <button key={e.label} type="button" className={styles.item} onClick={e.onSelect}>
        {body}
      </button>
    );
  };

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="More options"
      >
        <span className={styles.grabber} aria-hidden="true" />

        <span className={styles.heading}>Go to</span>
        {navigation.map(renderEntry)}

        <span className={styles.divider} />
        <span className={styles.heading}>Help</span>
        {help.map(renderEntry)}

        <span className={styles.divider} />
        <span className={styles.heading}>Your data</span>
        {data.map(renderEntry)}

        <button type="button" className={styles.close} onClick={close}>
          Close
        </button>
      </div>
    </div>
  );
}
