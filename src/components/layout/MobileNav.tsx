'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './MobileNav.module.css';

interface MobileTab {
  href: string;
  label: string;
  icon: React.ReactNode;
  isUpload?: boolean;
}

const tabs: MobileTab[] = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: (
      <svg className={styles.tabIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/collection',
    label: 'Collection',
    icon: (
      <svg className={styles.tabIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    href: '/upload',
    label: 'Upload',
    isUpload: true,
    icon: (
      <svg className={styles.uploadButtonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4v16m-8-8h16" />
      </svg>
    ),
  },
  {
    href: '/prices',
    label: 'Prices',
    icon: (
      <svg className={styles.tabIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    href: '/assistant',
    label: 'AI',
    icon: (
      <svg className={styles.tabIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.mobileNav} aria-label="Mobile navigation">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');

        if (tab.isUpload) {
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`${styles.tab} ${styles.uploadTab} ${isActive ? styles.uploadTabActive : ''}`}
              aria-label={tab.label}
            >
              <div className={styles.uploadButton}>
                {tab.icon}
              </div>
            </Link>
          );
        }

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
            {isActive && <span className={styles.tabDot} />}
          </Link>
        );
      })}
    </nav>
  );
}
