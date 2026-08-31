'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/store/ui';
import { useSyncStore } from '@/store/sync';
import { onQuotaExceeded } from '@/lib/storage/persisted-storage';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import MoreSheet from '@/components/layout/MoreSheet';
import ChatPanel from '@/components/chat/ChatPanel';
import GuidedTour from '@/components/layout/GuidedTour';
import { ToastContainer } from '@/components/ui/ToastContainer';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const initSync = useSyncStore((s) => s.init);
  const addToast = useUIStore((s) => s.addToast);

  // Watch Firebase auth for the lifetime of the app, so a signed-in session is
  // picked up on load (including after the mobile redirect sign-in flow returns)
  // rather than only when Settings happens to be open. No-ops when sync is
  // unconfigured.
  useEffect(() => initSync(), [initSync]);

  // Only the upload wizard ever caught a failed save. Every other write —
  // the cloud-sync merge, JSON import, and all nineteen updateStamp call
  // sites — threw straight out of a click handler with nothing on screen.
  // One subscription covers them all without touching any of them.
  useEffect(
    () =>
      onQuotaExceeded(() => {
        addToast({
          type: 'error',
          title: 'This device is out of storage',
          message:
            'That change could not be saved. Turn on cloud sync in Settings, or ' +
            'remove some stamps, and try again.',
          duration: 12000,
        });
      }),
    [addToast],
  );

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
      <MoreSheet />
      <ChatPanel />
      <GuidedTour />
      <ToastContainer />
    </div>
  );
}
