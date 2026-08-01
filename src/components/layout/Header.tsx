'use client';

import { useMemo, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import { useStampsStore } from '@/store/stamps';
import styles from './Header.module.css';

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/collection': 'Collection',
  '/upload': 'Upload',
  '/prices': 'Price Tracker',
  '/assistant': 'AI Assistant',
  '/settings': 'Settings',
  '/tutorial': 'How it works',
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const globalSearchQuery = useUIStore((s) => s.globalSearchQuery);
  const setGlobalSearchQuery = useUIStore((s) => s.setGlobalSearchQuery);
  const startTour = useUIStore((s) => s.startTour);
  const pageChrome = useUIStore((s) => s.pageChrome);
  const setMoreOpen = useUIStore((s) => s.setMoreSheetOpen);

  const routeTitle = useMemo(() => {
    for (const [route, title] of Object.entries(routeTitles)) {
      if (pathname === route || pathname.startsWith(route + '/')) {
        return title;
      }
    }
    return 'Perdue Stamp Vault';
  }, [pathname]);

  // A page can override the route-derived title (e.g. the upload wizard shows
  // its current step) via usePageChrome().
  const pageTitle = pageChrome?.title ?? routeTitle;
  const showBack = Boolean(pageChrome?.onBack || pageChrome?.backHref);

  const runSearch = () => {
    useStampsStore.getState().setFilters({ search: globalSearchQuery.trim() });
    router.push('/collection');
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    runSearch();
  };

  return (
    <header
      className={`${styles.header} ${collapsed ? styles.headerCollapsed : ''}`}
    >
      {/* Left: contextual back + page title */}
      <div className={styles.titleSection}>
        {showBack &&
          (pageChrome?.onBack ? (
            <button
              type="button"
              className={styles.backButton}
              onClick={pageChrome.onBack}
              aria-label="Go back"
            >
              ←
            </button>
          ) : (
            <Link
              href={pageChrome!.backHref!}
              className={styles.backButton}
              aria-label="Go back"
            >
              ←
            </Link>
          ))}
        <h1 className={styles.pageTitle}>{pageTitle}</h1>
      </div>

      {/* Center: Search */}
      <div className={styles.searchSection}>
        <form className={styles.searchWrapper} onSubmit={handleSearchSubmit}>
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                runSearch();
              }
            }}
            aria-label="Global search"
          />
          <div className={styles.searchShortcut}>
            <span className={styles.kbd}>⌘</span>
            <span className={styles.kbd}>K</span>
          </div>
        </form>
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

        {/* Overflow. On desktop this is the only route to the More sheet, since
            the mobile tab bar is hidden above 860px. */}
        <button
          className={styles.iconButton}
          onClick={() => setMoreOpen(true)}
          aria-label="More options"
          aria-haspopup="dialog"
          title="More"
        >
          <svg
            className={styles.iconButtonSvg}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="5" cy="12" r="1" fill="currentColor" />
            <circle cx="12" cy="12" r="1" fill="currentColor" />
            <circle cx="19" cy="12" r="1" fill="currentColor" />
          </svg>
        </button>
      </div>
    </header>
  );
}
