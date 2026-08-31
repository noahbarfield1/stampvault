/* ──────────────────────────────────────────────────────────────────────────────
 * The localStorage adapter behind the stamps store.
 *
 * Three jobs, in order of how much they matter:
 *
 *  1. Tell a quota failure apart from every other failure, and record it so
 *     passive callers can react. See ./quota for why nothing did this before.
 *
 *  2. Skip writes that would not change anything. zustand calls `setItem()`
 *     after EVERY action, including ones whose value `partialize` excludes —
 *     `setSelectedStamp` and `setViewMode` both re-serialize and rewrite the
 *     entire collection (up to ~5MB) to store a field that is not persisted.
 *     On a phone that is a main-thread stall per tap, and one more chance to
 *     throw. Comparing the serialized string is far cheaper than writing it.
 *
 *  3. Re-throw. `handleSave` depends on the throw to know a stamp did not
 *     save; swallowing here would recreate the silent-failure bug that this
 *     codebase has already fixed twice.
 *
 * Modelled on the sessionStorage adapter in `src/store/uploadSession.ts`
 * (:205-237), which solved the same problem for the upload session. The
 * difference is deliberate: that one degrades to metadata-only because losing
 * an in-progress photo is recoverable, whereas losing a saved stamp is not, so
 * this one reports instead of degrading.
 * ────────────────────────────────────────────────────────────────────────────── */

import type { StateStorage } from 'zustand/middleware';

import { isQuotaError } from './quota';

export interface QuotaFailure {
  /** Epoch ms of the most recent refusal. */
  at: number;
  /** Size of the value the browser refused, in UTF-16 code units. */
  bytes: number;
}

type QuotaListener = (failure: QuotaFailure) => void;

const listeners = new Set<QuotaListener>();
let lastFailure: QuotaFailure | null = null;

/**
 * The most recent quota refusal, or null if storage has never refused.
 *
 * Read by the storage-pressure hint so it can fire on evidence rather than on
 * an estimate.
 */
export function getQuotaFailure(): QuotaFailure | null {
  return lastFailure;
}

/** Subscribe to quota refusals. Returns an unsubscribe function. */
export function onQuotaExceeded(cb: QuotaListener): () => void {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

function recordQuotaFailure(bytes: number): void {
  lastFailure = { at: Date.now(), bytes };
  for (const cb of listeners) {
    try {
      cb(lastFailure);
    } catch {
      /* a broken listener must not stop the others, or mask the re-throw */
    }
  }
}

/** Test seam. Not used in application code. */
export function __resetQuotaState(): void {
  lastFailure = null;
  listeners.clear();
}

/**
 * A `StateStorage` over localStorage that reports quota failures.
 *
 * Never throws on construction. `createJSONStorage` catches a throwing
 * `getStorage()` and returns `undefined`, which disables persistence
 * altogether — so an SSR render or Safari private mode would silently stop
 * saving. Falling back to an in-memory Map keeps the app working (for the
 * session) instead.
 */
export function createStampStorage(): StateStorage {
  let backing: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

  try {
    if (typeof window === 'undefined') throw new Error('no window');
    // Touching the property is itself what throws in Safari private mode.
    backing = window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    backing = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }

  /** The last value successfully written, per key — for the no-op skip. */
  const lastWritten = new Map<string, string>();

  return {
    getItem: (name) => backing.getItem(name),

    setItem: (name, value) => {
      // (2) Nothing changed, so there is nothing to write. This is the common
      // case for view/selection actions and it is why the collection is no
      // longer re-serialized on every tap.
      if (lastWritten.get(name) === value) return;

      try {
        backing.setItem(name, value);
        lastWritten.set(name, value);
      } catch (err) {
        // The write did not land, so the cache must not claim it did —
        // otherwise a later identical retry would be skipped by (2).
        lastWritten.delete(name);

        if (isQuotaError(err)) {
          recordQuotaFailure(value.length);
        } else {
          // (1) A non-quota failure is a different bug and must not be
          // reported as a full disk.
          console.error('[storage] write failed for', name, err);
        }

        // (3) Always re-throw. Callers decide what a failed save means.
        throw err;
      }
    },

    removeItem: (name) => {
      lastWritten.delete(name);
      backing.removeItem(name);
    },
  };
}
