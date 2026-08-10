/* ──────────────────────────────────────────────────────────────────────────────
 * Firestore adapter for the durable price cache. SERVER ONLY.
 *
 * Writes go through the Admin SDK rather than the client SDK on purpose: this
 * is a SHARED collection, not user-scoped data. If the browser could write to
 * it, anyone could poison every collector's fallback price. `firestore.rules`
 * therefore denies the client all access to `priceCache/**`, and the Admin SDK
 * bypasses rules by design.
 *
 * Degrades to a no-op when FIREBASE_SERVICE_ACCOUNT_JSON is absent, so the app
 * behaves exactly as it did before this file existed. Every function swallows
 * its own failures: a cache is an optimisation, and must never be able to take
 * a price lookup down with it.
 * ────────────────────────────────────────────────────────────────────────────── */

// NOTE: intentionally not importing 'server-only' — it is not a dependency of
// this project. Keep this module out of client components by hand: it is
// imported only by src/app/api/pricing/lookup/route.ts.
import type { App } from 'firebase-admin/app';
import type { Firestore } from 'firebase-admin/firestore';
import type { CachedPriceRecord } from './price-cache';

const COLLECTION = 'priceCache';

let app: App | null = null;
let db: Firestore | null = null;
let initAttempted = false;
let warnedMissingCredentials = false;

export function hasPriceCacheCredentials(): boolean {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return !!raw && raw.trim().length > 0 && !raw.trim().startsWith('your-');
}

/**
 * Lazily initialise the Admin app.
 *
 * Returns null — rather than throwing — whenever credentials are missing or
 * malformed, because "no durable cache" is a supported configuration.
 */
async function getDb(): Promise<Firestore | null> {
  if (db) return db;
  if (initAttempted) return null;
  initAttempted = true;

  if (!hasPriceCacheCredentials()) {
    if (!warnedMissingCredentials) {
      console.warn(
        '[price-cache] FIREBASE_SERVICE_ACCOUNT_JSON not set — durable price cache disabled.',
      );
      warnedMissingCredentials = true;
    }
    return null;
  }

  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON as string);

    // Reuse an existing app across hot reloads and warm lambda invocations;
    // initializeApp throws on a duplicate name.
    const existing = getApps();
    app = existing.length ? existing[0] : initializeApp({ credential: cert(serviceAccount) });
    db = getFirestore(app);
    return db;
  } catch (err) {
    console.error('[price-cache] failed to initialise Firebase Admin:', err);
    return null;
  }
}

/** Read a remembered price. Returns null on miss, misconfiguration, or error. */
export async function readCachedPrice(key: string): Promise<CachedPriceRecord | null> {
  try {
    const firestore = await getDb();
    if (!firestore) return null;

    const snap = await firestore.collection(COLLECTION).doc(key).get();
    if (!snap.exists) return null;
    return (snap.data() as CachedPriceRecord) ?? null;
  } catch (err) {
    console.error(`[price-cache] read failed for ${key}:`, err);
    return null;
  }
}

/**
 * Remember a price. Fire-and-forget by contract — callers must not await this
 * on the critical path, and it resolves rather than rejects on failure.
 */
export async function writeCachedPrice(
  key: string,
  record: CachedPriceRecord,
): Promise<void> {
  try {
    const firestore = await getDb();
    if (!firestore) return;

    await firestore
      .collection(COLLECTION)
      .doc(key)
      .set({ ...record, updatedAt: record.fetchedAt }, { merge: false });
  } catch (err) {
    console.error(`[price-cache] write failed for ${key}:`, err);
  }
}
