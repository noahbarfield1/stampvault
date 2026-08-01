/* ──────────────────────────────────────────────────────────────────────────────
 * Firebase client SDK — lazy, optional initialisation.
 *
 * Cloud sync is OPTIONAL. The app stays fully usable with no Firebase config at
 * all: the collection lives in localStorage and sync simply never turns on.
 * Nothing here may therefore throw or run at import time — the previous version
 * called initializeApp() at module scope with possibly-undefined values, which
 * is also why it had to be dead code to be safe.
 * ────────────────────────────────────────────────────────────────────────────── */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Whether enough config exists to talk to Firebase at all.
 *
 * These are NEXT_PUBLIC_ and therefore inlined into the client bundle. That is
 * expected for the Firebase web SDK — the API key is not a secret, it only
 * identifies the project. Actual access is controlled by the security rules,
 * which is precisely why firestore.rules matters.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
  );
}

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId ?? null;

let cachedApp: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (cachedApp) return cachedApp;
  cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return cachedApp;
}

export function getDb(): Firestore | null {
  const app = getFirebaseApp();
  return app ? getFirestore(app) : null;
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
}
