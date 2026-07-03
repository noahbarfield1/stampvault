'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore, useToasts } from '@/store/ui';
import styles from './ToastContainer.module.css';

const ICONS: Record<string, string> = {
  success: 'M20 6L9 17l-5-5',
  error: 'M18 6L6 18M6 6l12 12',
  warning: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  info: 'M12 16v-4m0-4h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0z',
};

/**
 * Global toast renderer. Reads the toast queue from the UI store and renders a
 * stacked, auto-dismissing notification list. Mounted once in AppShell.
 */
export function ToastContainer() {
  const toasts = useToasts();
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div className={styles.container} role="region" aria-live="polite" aria-label="Notifications">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            className={`${styles.toast} ${styles[toast.type]}`}
            role="status"
            layout
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={ICONS[toast.type] ?? ICONS.info} />
            </svg>
            <div className={styles.body}>
              <p className={styles.title}>{toast.title}</p>
              {toast.message && <p className={styles.message}>{toast.message}</p>}
            </div>
            <button
              className={styles.close}
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default ToastContainer;
