/* ──────────────────────────────────────────────────────────────────────────────
 * Firebase Authentication.
 *
 * Sign-in exists for one reason: to give the collection an owner, so it can be
 * stored under users/{uid} and protected by security rules. There is no
 * paywall, no profile, and nothing is shared.
 *
 * Google sign-in is the only method offered — one tap on a phone, no password
 * to type into a 16px field, and no password for this app to handle.
 * ────────────────────────────────────────────────────────────────────────────── */

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from './config';

export interface SyncUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export function toSyncUser(user: User): SyncUser {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

/** Human-readable reason sign-in is unavailable, or null when it is available. */
export function signInUnavailableReason(): string | null {
  if (!isFirebaseConfigured()) {
    return 'Cloud sync is not configured for this build.';
  }
  return null;
}

/**
 * Map Firebase's error codes onto something a person can act on.
 *
 * `auth/configuration-not-found` is the one that matters here: it means
 * Authentication has never been enabled in the Firebase console for this
 * project, which is a one-time setup step no amount of client code can do.
 */
export function describeAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
      return 'Cloud sync is not switched on for this project yet. Enable Authentication → Google in the Firebase console, then try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site, or try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/network-request-failed':
      return 'Could not reach Google. Check your connection and try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorised for sign-in. Add it under Authentication → Settings → Authorized domains.';
    default:
      return err instanceof Error ? err.message : 'Sign-in failed.';
  }
}

/**
 * Start Google sign-in.
 *
 * Popups are unreliable on mobile Safari — they are frequently blocked and can
 * be dismissed by a stray tap — so touch devices get the redirect flow instead.
 */
export async function signIn(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Cloud sync is not configured for this build.');

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const prefersRedirect =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  if (prefersRedirect) {
    await signInWithRedirect(auth, provider);
    return;
  }
  await signInWithPopup(auth, provider);
}

export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) await fbSignOut(auth);
}

/**
 * Subscribe to auth state. Returns an unsubscribe function, and a no-op
 * unsubscribe when Firebase is not configured, so callers need no special case.
 */
export function watchAuth(cb: (user: SyncUser | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => cb(user ? toSyncUser(user) : null));
}
