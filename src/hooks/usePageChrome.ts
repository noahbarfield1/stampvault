'use client';

import { useEffect } from 'react';
import { useUIStore, type PageChrome } from '@/store/ui';

/**
 * Declare this page's header chrome — title, back affordance, overflow actions.
 *
 * Set on mount, cleared on unmount, so no page can leak its title onto the next
 * one. Pass a stable `deps` array when the chrome depends on page state (a
 * wizard step, a fetched record title); otherwise it is set once.
 *
 * ```ts
 * usePageChrome({ title: 'Collection' });
 * usePageChrome({ title: step, onBack: handleBack }, [step, handleBack]);
 * ```
 */
export function usePageChrome(chrome: PageChrome, deps: unknown[] = []) {
  const setPageChrome = useUIStore((s) => s.setPageChrome);

  useEffect(() => {
    setPageChrome(chrome);
    return () => setPageChrome(null);
    // `chrome` is an object literal at every call site, so it is intentionally
    // not a dependency — the caller controls invalidation through `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPageChrome, ...deps]);
}
