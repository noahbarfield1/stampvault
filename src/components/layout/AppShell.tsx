'use client';

import { useUIStore } from '@/store/ui';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import ChatPanel from '@/components/chat/ChatPanel';
import GuidedTour from '@/components/layout/GuidedTour';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div
        className={`${styles.mainArea} ${collapsed ? styles.mainAreaCollapsed : ''}`}
      >
        <Header />
        <main className={styles.pageContent}>
          {children}
        </main>
      </div>
      <MobileNav />
      <ChatPanel />
      <GuidedTour />
    </div>
  );
}
