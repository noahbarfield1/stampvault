/* ──────────────────────────────────────────────────────────────────────────────
 * Cloud sync state.
 *
 * Deliberately separate from the collection store. The collection must keep
 * working — reads, writes, everything — whether or not sync is configured,
 * signed in, or online. Sync observes it and mirrors it; it never gates it.
 * ────────────────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Stamp } from '@/types/stamp';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { signIn, signOut, watchAuth, describeAuthError, type SyncUser } from '@/lib/firebase/auth';
import {
  syncCollection,
  pushStamp,
  deleteRemoteStamp,
  type SyncResult,
} from '@/lib/sync/collection-sync';

export type SyncStatus =
  /** No Firebase config in this build — sync cannot be offered. */
  | 'unconfigured'
  /** Configured, but nobody is signed in. The collection is local only. */
  | 'signed-out'
  | 'signing-in'
  | 'syncing'
  | 'synced'
  | 'error';

interface SyncState {
  status: SyncStatus;
  user: SyncUser | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  /** Pending pushes that failed, retried on the next successful sync. */
  dirtyIds: string[];
  initialised: boolean;

  init: () => () => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  syncNow: (local: Stamp[]) => Promise<{ merged: Stamp[]; result: SyncResult } | null>;
  pushOne: (stamp: Stamp) => Promise<void>;
  removeOne: (stampId: string) => Promise<void>;
  markDirty: (id: string) => void;
  clearError: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      status: isFirebaseConfigured() ? 'signed-out' : 'unconfigured',
      user: null,
      lastSyncedAt: null,
      lastError: null,
      dirtyIds: [],
      initialised: false,

      /** Subscribe to auth state. Returns the unsubscribe function. */
      init: () => {
        if (get().initialised) return () => {};
        set({ initialised: true });
        return watchAuth((user) => {
          set({
            user,
            status: user ? 'synced' : isFirebaseConfigured() ? 'signed-out' : 'unconfigured',
          });
        });
      },

      connect: async () => {
        set({ status: 'signing-in', lastError: null });
        try {
          await signIn();
          // On the redirect flow the page navigates away here; on popup the
          // auth listener in init() takes over from this point.
        } catch (err) {
          set({ status: 'error', lastError: describeAuthError(err) });
          throw err;
        }
      },

      disconnect: async () => {
        await signOut();
        // The local collection is untouched. Signing out stops mirroring; it
        // does not remove anything the user can see.
        set({ status: 'signed-out', user: null, lastSyncedAt: null });
      },

      syncNow: async (local) => {
        const { user } = get();
        if (!user) return null;
        set({ status: 'syncing', lastError: null });
        try {
          const outcome = await syncCollection(user.uid, local);
          set({
            status: 'synced',
            lastSyncedAt: new Date().toISOString(),
            dirtyIds: [],
          });
          return outcome;
        } catch (err) {
          set({
            status: 'error',
            lastError: err instanceof Error ? err.message : 'Sync failed.',
          });
          return null;
        }
      },

      pushOne: async (stamp) => {
        const { user } = get();
        if (!user) return;
        try {
          await pushStamp(user.uid, stamp);
          set({ lastSyncedAt: new Date().toISOString() });
        } catch {
          // Never surface a background push failure as a blocking error — the
          // stamp is already saved locally. Queue it for the next full sync.
          get().markDirty(stamp.id);
        }
      },

      removeOne: async (stampId) => {
        const { user } = get();
        if (!user) return;
        try {
          await deleteRemoteStamp(user.uid, stampId);
        } catch {
          /* the local delete already happened; the next sync reconciles */
        }
      },

      markDirty: (id) =>
        set((s) => (s.dirtyIds.includes(id) ? s : { dirtyIds: [...s.dirtyIds, id] })),

      clearError: () => set({ lastError: null }),
    }),
    {
      name: 'stampvault-sync',
      storage: createJSONStorage(() =>
        typeof window === 'undefined'
          ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
          : window.localStorage,
      ),
      // Auth state comes from Firebase on every load; only the breadcrumbs are
      // worth persisting.
      partialize: (s) => ({ lastSyncedAt: s.lastSyncedAt, dirtyIds: s.dirtyIds }),
    },
  ),
);
