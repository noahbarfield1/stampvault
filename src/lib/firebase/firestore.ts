/* ─── Firebase Firestore Helpers ─────────────────────────────────────
 *  Data access layer for stamps, pricing, and price history.
 *  Uses Firebase Admin SDK for server-side operations
 *  and Firebase Client SDK for client-side reads.
 * ──────────────────────────────────────────────────────────────────── */

import type { Stamp, PriceData, PriceHistoryEntry } from '@/types/stamp';

/* ─── Server-side: Dynamic import guards ─────────────────────────────
 *  These functions are designed to run server-side (API routes,
 *  server components). The actual Firebase Admin initialization
 *  happens in a separate firebase-admin.ts config file.
 *  For now, we define the Firestore interface contract.
 * ──────────────────────────────────────────────────────────────────── */

interface FirestoreDocument {
  id: string;
  data: Record<string, unknown>;
  exists: boolean;
}

/**
 * Get a stamp document by ID.
 */
export async function getStamp(stampId: string): Promise<Stamp | null> {
  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();
    const doc = await db.collection('stamps').doc(stampId).get();

    if (!doc.exists) return null;

    return { id: doc.id, ...doc.data() } as Stamp;
  } catch (error) {
    console.error('[Firestore] Error getting stamp:', error);
    throw error;
  }
}

/**
 * Update a stamp document with partial data.
 */
export async function updateStamp(
  stampId: string,
  data: Partial<Stamp>
): Promise<void> {
  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();
    await db
      .collection('stamps')
      .doc(stampId)
      .update({
        ...data,
        updatedAt: new Date().toISOString(),
      });
  } catch (error) {
    console.error('[Firestore] Error updating stamp:', error);
    throw error;
  }
}

/**
 * Save price data to the stamp document and append to price history.
 */
export async function savePriceData(
  stampId: string,
  priceData: PriceData
): Promise<void> {
  try {
    const { getFirestore, FieldValue } = await import(
      'firebase-admin/firestore'
    );
    const db = getFirestore();
    const batch = db.batch();

    // Update the stamp's current pricing
    const stampRef = db.collection('stamps').doc(stampId);
    batch.update(stampRef, {
      pricing: priceData,
      updatedAt: new Date().toISOString(),
    });

    // Append to price history subcollection
    const historyRef = db
      .collection('stamps')
      .doc(stampId)
      .collection('priceHistory')
      .doc();
    batch.set(historyRef, {
      date: new Date().toISOString(),
      value: priceData.estimatedValue,
      sources: priceData.sources.length,
    });

    await batch.commit();
  } catch (error) {
    console.error('[Firestore] Error saving price data:', error);
    throw error;
  }
}

/**
 * Save a single price history entry.
 */
export async function savePriceHistory(
  stampId: string,
  entry: PriceHistoryEntry
): Promise<void> {
  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();
    await db
      .collection('stamps')
      .doc(stampId)
      .collection('priceHistory')
      .add(entry);
  } catch (error) {
    console.error('[Firestore] Error saving price history:', error);
    throw error;
  }
}

/**
 * Get price history for a stamp, ordered by date descending.
 */
export async function getPriceHistory(
  stampId: string,
  limit: number = 90
): Promise<PriceHistoryEntry[]> {
  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();
    const snapshot = await db
      .collection('stamps')
      .doc(stampId)
      .collection('priceHistory')
      .orderBy('date', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as PriceHistoryEntry);
  } catch (error) {
    console.error('[Firestore] Error getting price history:', error);
    return [];
  }
}

/**
 * Get cached price data if it exists and is within TTL.
 */
export async function getCachedPriceData(
  stampId: string,
  ttlMs: number = 24 * 60 * 60 * 1000 // 24 hours
): Promise<PriceData | null> {
  const stamp = await getStamp(stampId);
  if (!stamp || !stamp.pricing) return null;

  const lastUpdated = new Date(stamp.pricing.lastUpdated).getTime();
  const age = Date.now() - lastUpdated;

  if (age > ttlMs) return null;

  return stamp.pricing;
}
