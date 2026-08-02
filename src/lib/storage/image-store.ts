/* ──────────────────────────────────────────────────────────────────────────────
 * Full-resolution stamp images, kept in IndexedDB.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * The collection persists to localStorage, which Safari caps around 5MB. The
 * store had no `partialize`, so it wrote its ENTIRE state — including both
 * `stamps` and `filteredStamps`, which are the same records. Every full-size
 * base64 crop was therefore stored TWICE. At roughly 110-270KB per crop that
 * is ~250-550KB per stamp, so the quota blew after only about a dozen stamps,
 * and zustand's persist middleware swallows QuotaExceededError — so saves
 * failed silently.
 *
 * IndexedDB has no such practical cap (browsers grant hundreds of MB), it is
 * async so it never blocks the UI, and it fails loudly instead of silently.
 * localStorage now holds only metadata plus a ~20KB thumbnail per stamp.
 *
 * Hand-rolled rather than pulling in idb: this is ~80 lines and the project has
 * no other need for the dependency.
 * ────────────────────────────────────────────────────────────────────────────── */

const DB_NAME = 'stampvault';
const DB_VERSION = 1;
const STORE = 'images';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open local image storage'));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        // Surface the real error — quota problems must not be swallowed the way
        // the localStorage path swallowed them.
        req.onerror = () => reject(req.error ?? new Error('Image storage write failed'));
        t.onabort = () => reject(t.error ?? new Error('Image storage transaction aborted'));
      }),
  );
}

/** Store one stamp's full-resolution crop. Rejects on quota failure. */
export async function putStampImage(stampId: string, dataUrl: string): Promise<void> {
  await tx('readwrite', (s) => s.put(dataUrl, stampId));
}

/** Read one stamp's full crop, or null if it was never stored / is unavailable. */
export async function getStampImage(stampId: string): Promise<string | null> {
  try {
    const value = await tx<string | undefined>('readonly', (s) => s.get(stampId));
    return value ?? null;
  } catch {
    return null;
  }
}

export async function deleteStampImage(stampId: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(stampId));
  } catch {
    /* best effort — an orphaned image is harmless */
  }
}

/** Load many at once, for rehydrating a whole collection. */
export async function getStampImages(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    ids.map(async (id) => {
      const v = await getStampImage(id);
      if (v) out.set(id, v);
    }),
  );
  return out;
}

/**
 * Ask the browser to make storage persistent, so it is not evicted under
 * pressure. Best-effort: Chrome usually grants it silently for installed or
 * frequently-visited sites, Safari is stricter.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Rough usage figures for the Settings panel. */
export async function storageEstimate(): Promise<{ usageMB: number; quotaMB: number } | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usageMB: usage / 1_048_576, quotaMB: quota / 1_048_576 };
  } catch {
    return null;
  }
}
