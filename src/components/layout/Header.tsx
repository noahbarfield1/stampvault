'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import styles from './Header.module.css';

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/collection': 'Collection',
  '/upload': 'Upload',
  '/prices': 'Price Tracker',
  '/assistant': 'AI Assistant',
  '/settings': 'Settings',
};

export function Header() {
  const pathname = usePathname();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const globalSearchQuery = useUIStore((s) => s.globalSearchQuery);
  const setGlobalSearchQuery = useUIStore((s) => s.setGlobalSearchQuery);
  const voiceSession = useUIStore((s) => s.voiceSession);
  const startVoiceSession = useUIStore((s) => s.startVoiceSession);
  const endVoiceSession = useUIStore((s) => s.endVoiceSession);
  const startTour = useUIStore((s) => s.startTour);

  const pageTitle = useMemo(() => {
    for (const [route, title] of Object.entries(routeTitles)) {
      if (pathname === route || pathname.startsWith(route + '/')) {
        return title;
      }
    }
    return 'Perdue Stamp Vault';
  }, [pathname]);

  const isListening = voiceSession.isActive || voiceSession.isListening || false;

  const handleVoiceToggle = () => {
    if (isListening) {
      endVoiceSession();
    } else {
      startVoiceSession();
    }
  };

  return (
    <header
      className={`${styles.header} ${collapsed ? styles.headerCollapsed : ''}`}
    >
      {/* Left: Page Title */}
      <div className={styles.titleSection}>
        <h1 className={styles.pageTitle}>{pageTitle}</h1>
      </div>

      {/* Center: Search */}
      <div className={styles.searchSection}>
        <div className={styles.searchWrapper}>
          <svg
            className={styles.searchIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search stamps, collections, prices..."
            value={globalSearchQuery}
            onChange={(e) => setGlobalSearchQuery(e.target.value)}
            aria-label="Global search"
          />
          <div className={styles.searchShortcut}>
            <span className={styles.kbd}>⌘</span>
            <span className={styles.kbd}>K</span>
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className={styles.actionsSection}>
        {/* Help/Tour Button */}
        <button
          className={styles.iconButton}
          onClick={startTour}
          aria-label="Start guided tour"
          title="Guided Product Tour"
        >
          <svg
            className={styles.iconButtonSvg}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>

        {/* Voice Button */}
        <button
          className={`${styles.iconButton} ${isListening ? styles.voiceListening : ''}`}
          onClick={handleVoiceToggle}
          aria-label={isListening ? 'Stop listening' : 'Start voice input'}
        >
          <svg
            className={styles.iconButtonSvg}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>

        {/* Notifications */}
        <button
          className={styles.iconButton}
          aria-label="Notifications"
        >
          <svg
            className={styles.iconButtonSvg}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <span className={styles.notificationDot} />
        </button>
      </div>
    </header>
  );
}
