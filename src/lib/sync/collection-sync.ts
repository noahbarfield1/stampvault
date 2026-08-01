/* ──────────────────────────────────────────────────────────────────────────────
 * Collection sync — Firestore mirror of the local collection.
 *
 * ── Shape ────────────────────────────────────────────────────────────────────
 *   users/{uid}/stamps/{stampId}              metadata + thumbnail  (~20-40KB)
 *   users/{uid}/stamps/{stampId}/media/full   the full-resolution crop
 *
 * Splitting the full crop out is deliberate. Listing the collection then reads
 * only the small docs, so opening the app does not pull every full-size image
 * over cellular — and on the Spark plan it does not burn the daily read budget
 * either. The detail page fetches the media doc lazily, for one stamp.
 *
 * ── Why not Firebase Storage ─────────────────────────────────────────────────
 * Storage would be the natural home for images, but it requires the Blaze
 * (paid) plan to provision a bucket, and this project is on Spark with no
 * bucket. Firestore documents cap at 1 MiB, and a 1024px JPEG crop at q0.85 is
 * roughly 80-200KB — comfortably inside. If the project is upgraded later,
 * moving `media/full` to Storage is an isolated change to this file.
 *
 * ── Model ────────────────────────────────────────────────────────────────────
 * Offline-first. localStorage stays the immediate source of truth so the UI
 * never waits on the network; Firestore is the durable mirror. Conflicts
 * resolve last-write-wins on `updatedAt`, which is right for a single owner on
 * a couple of devices and needs no coordination.
 * ────────────────────────────────────────────────────────────────────────────── */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import type { Stamp } from '@/types/stamp';
import { getDb } from '@/lib/firebase/config';

/** A stamp as stored remotely: everything except the full-resolution image. */
type RemoteStamp = Omit<Stamp, 'imageUrl'> & { imageUrl: null };

const stampsCol = (uid: string) => {
  const db = getDb();
  if (!db) throw new Error('Cloud sync is not configured.');
  return collection(db, 'users', uid, 'stamps');
};

const mediaDoc = (uid: string, stampId: string) => {
  const db = getDb();
  if (!db) throw new Error('Cloud sync is not configured.');
  return doc(db, 'users', uid, 'stamps', stampId, 'media', 'full');
};

/** Firestore rejects `undefined`; strip it rather than letting a write fail. */
function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (v === undefined ? null : v)));
}

const timeOf = (s: { updatedAt?: string | null }) =>
  s.updatedAt ? Date.parse(s.updatedAt) || 0 : 0;

export interface SyncResult {
  pushed: number;
  pulled: number;
  /** Stamps present remotely but not locally, i.e. recovered from another device. */
  recovered: number;
}

/**
 * Reconcile local and remote in one pass.
 *
 * Union of both sides, keeping whichever copy has the newer `updatedAt`. A
 * stamp missing from one side is treated as "not yet synced there" rather than
 * "deleted", because a genuine delete goes through `deleteRemoteStamp` and
 * removes it from both. That asymmetry is intentional: silently deleting a
 * collection because a device had stale state would be unforgivable.
 */
export async function syncCollection(
  uid: string,
  local: Stamp[],
): Promise<{ merged: Stamp[]; result: SyncResult }> {
  const snapshot = await getDocs(stampsCol(uid));

  const remote = new Map<string, RemoteStamp>();
  snapshot.forEach((d) => remote.set(d.id, d.data() as RemoteStamp));

  const localById = new Map(local.map((s) => [s.id, s]));
  const merged: Stamp[] = [];
  const toPush: Stamp[] = [];
  let pulled = 0;
  let recovered = 0;

  for (const id of new Set([...localById.keys(), ...remote.keys()])) {
    const l = localById.get(id);
    const r = remote.get(id);

    if (l && !r) {
      merged.push(l);
      toPush.push(l);
      continue;
    }
    if (!l && r) {
      // Only on this device's remote — recovered from another device. The full
      // image is not fetched here; the detail page loads it on demand.
      merged.push({ ...(r as unknown as Stamp), imageUrl: r.thumbnailUrl ?? '' });
      pulled++;
      recovered++;
      continue;
    }
    if (l && r) {
      if (timeOf(r) > timeOf(l)) {
        // Keep the local full-resolution image: it is not stored on the doc.
        merged.push({ ...(r as unknown as Stamp), imageUrl: l.imageUrl });
        pulled++;
      } else {
        merged.push(l);
        if (timeOf(l) > timeOf(r)) toPush.push(l);
      }
    }
  }

  if (toPush.length > 0) await pushStamps(uid, toPush);

  merged.sort((a, b) => timeOf(b) - timeOf(a));
  return { merged, result: { pushed: toPush.length, pulled, recovered } };
}

/** Write stamps upward. Batched at 400 — Firestore's limit is 500 operations. */
export async function pushStamps(uid: string, stamps: Stamp[]): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Cloud sync is not configured.');

  for (let i = 0; i < stamps.length; i += 400) {
    const batch = writeBatch(db);
    for (const stamp of stamps.slice(i, i + 400)) {
      const { imageUrl, ...rest } = stamp;
      batch.set(doc(stampsCol(uid), stamp.id), stripUndefined({ ...rest, imageUrl: null }));
      // Only store a full image when it is a real data URL. A path like
      // /mock/stamps/no-image.svg is not worth a document.
      if (imageUrl?.startsWith('data:')) {
        batch.set(mediaDoc(uid, stamp.id), { imageUrl, updatedAt: stamp.updatedAt });
      }
    }
    await batch.commit();
  }
}

export async function pushStamp(uid: string, stamp: Stamp): Promise<void> {
  await pushStamps(uid, [stamp]);
}

/** Remove a stamp from the cloud. Called only on an explicit user delete. */
export async function deleteRemoteStamp(uid: string, stampId: string): Promise<void> {
  await deleteDoc(doc(stampsCol(uid), stampId));
  try {
    await deleteDoc(mediaDoc(uid, stampId));
  } catch {
    // The media doc is optional — its absence is not a failure.
  }
}

/** Fetch the full-resolution crop for one stamp, or null if it was never stored. */
export async function fetchStampImage(
  uid: string,
  stampId: string,
): Promise<string | null> {
  const snap = await getDoc(mediaDoc(uid, stampId));
  if (!snap.exists()) return null;
  const data = snap.data() as { imageUrl?: string };
  return data.imageUrl ?? null;
}
