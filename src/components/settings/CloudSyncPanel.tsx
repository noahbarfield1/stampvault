'use client';

/* ──────────────────────────────────────────────────────────────────────────────
 * Cloud sync control panel.
 *
 * States it has to represent honestly:
 *   unconfigured  — no Firebase config in this build
 *   signed-out    — configured, collection is local only
 *   syncing       — a reconcile is in flight
 *   synced        — mirrored, with a real timestamp
 *   error         — including "Authentication is not enabled on this project",
 *                   which is a console step no client code can perform
 * ────────────────────────────────────────────────────────────────────────────── */

import React, { useCallback, useEffect, useState } from 'react';
import { useSyncStore } from '@/store/sync';
import { useStampsStore } from '@/store/stamps';
import { useUIStore } from '@/store/ui';
import { FIREBASE_PROJECT_ID } from '@/lib/firebase/config';
import { storageEstimate, requestPersistentStorage } from '@/lib/storage/image-store';
import styles from './CloudSyncPanel.module.css';

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return 'never';
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

export default function CloudSyncPanel() {
  const status = useSyncStore((s) => s.status);
  const user = useSyncStore((s) => s.user);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const lastError = useSyncStore((s) => s.lastError);
  const connect = useSyncStore((s) => s.connect);
  const disconnect = useSyncStore((s) => s.disconnect);
  const syncNow = useSyncStore((s) => s.syncNow);
  const init = useSyncStore((s) => s.init);

  const stamps = useStampsStore((s) => s.stamps);
  const setStamps = useStampsStore((s) => s.setStamps);
  const addToast = useUIStore((s) => s.addToast);
  const [busy, setBusy] = useState(false);

  useEffect(() => init(), [init]);

  /* Device storage, so filling it up is visible rather than a surprise. */
  const [storage, setStorage] = useState<{ usageMB: number; quotaMB: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    void storageEstimate().then(setStorage);
    if (typeof navigator !== 'undefined') {
      void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    }
  }, [stamps.length]);

  const handleSync = useCallback(async () => {
    setBusy(true);
    const outcome = await syncNow(stamps);
    setBusy(false);
    if (!outcome) return;
    setStamps(outcome.merged);
    const { pushed, pulled, recovered } = outcome.result;
    addToast({
      type: 'success',
      title: 'Collection synced',
      message:
        recovered > 0
          ? `${recovered} stamp${recovered === 1 ? '' : 's'} restored from the cloud, ${pushed} uploaded.`
          : `${pushed} uploaded, ${pulled} updated from the cloud.`,
    });
  }, [stamps, syncNow, setStamps, addToast]);

  const handleConnect = useCallback(async () => {
    setBusy(true);
    try {
      await connect();
      // Popup flow lands here already signed in; redirect flow navigates away.
      const merged = await syncNow(useStampsStore.getState().stamps);
      if (merged) setStamps(merged.merged);
    } catch {
      /* connect() already recorded a human-readable lastError */
    } finally {
      setBusy(false);
    }
  }, [connect, syncNow, setStamps]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    addToast({
      type: 'info',
      title: 'Cloud sync turned off',
      message: 'Your collection is still on this device — nothing was removed.',
    });
  }, [disconnect, addToast]);

  /* ── Unconfigured ─────────────────────────────────────────────────────── */
  if (status === 'unconfigured') {
    return (
      <div className={styles.panel}>
        <span className={styles.status}>Not configured</span>
        <p className={styles.explain}>
          Cloud sync is off in this build. Your collection is stored in this browser only —
          clearing site data will remove it, so keep an occasional export.
        </p>
      </div>
    );
  }

  const statusClass =
    status === 'synced'
      ? styles.statusOn
      : status === 'error'
        ? styles.statusError
        : status === 'syncing' || status === 'signing-in'
          ? styles.statusBusy
          : styles.status;

  const statusLabel =
    status === 'synced'
      ? '● Synced'
      : status === 'syncing'
        ? '◌ Syncing…'
        : status === 'signing-in'
          ? '◌ Signing in…'
          : status === 'error'
            ? '▲ Sync problem'
            : '○ Not signed in';

  /* Firebase reports this when Authentication has never been switched on. */
  const needsConsoleSetup = lastError?.includes('not switched on for this project');

  return (
    <div className={styles.panel}>
      <span className={statusClass}>{statusLabel}</span>

      {user ? (
        <>
          <div className={styles.row}>
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.avatar} src={user.photoURL} alt="" />
            ) : (
              <span className={styles.avatar} aria-hidden="true" />
            )}
            <span className={styles.identity}>
              <span className={styles.name}>{user.displayName ?? 'Signed in'}</span>
              <span className={styles.meta}>{user.email}</span>
            </span>
          </div>
          <p className={styles.explain}>
            {stamps.length} stamp{stamps.length === 1 ? '' : 's'} mirrored to your Google
            account. Last synced {relativeTime(lastSyncedAt)}. Sign in on another device to
            see the same collection.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={handleSync}
              disabled={busy || status === 'syncing'}
            >
              {busy || status === 'syncing' ? 'Syncing…' : 'Sync now'}
            </button>
            <button type="button" className={styles.secondary} onClick={handleDisconnect}>
              Turn off sync
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.explain}>
            Your collection currently lives in this browser only. Sign in with Google to
            mirror it to the cloud, so it survives a cleared cache or a lost phone and
            follows you to other devices.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={handleConnect}
              disabled={busy || status === 'signing-in'}
            >
              {busy || status === 'signing-in' ? 'Opening Google…' : 'Sign in with Google'}
            </button>
          </div>
        </>
      )}

      {storage && (
        <p className={styles.explain}>
          Using {storage.usageMB < 1 ? '<1' : storage.usageMB.toFixed(0)}MB of roughly{' '}
          {storage.quotaMB.toFixed(0)}MB available on this device.
          {persisted === false && (
            <>
              {' '}
              <button
                type="button"
                className={styles.linkButton}
                onClick={async () => {
                  const ok = await requestPersistentStorage();
                  setPersisted(ok);
                  addToast({
                    type: ok ? 'success' : 'info',
                    title: ok ? 'Storage protected' : 'Browser declined',
                    message: ok
                      ? 'This browser will no longer evict your collection automatically.'
                      : 'Keep cloud sync on, or export a backup now and then.',
                  });
                }}
              >
                Ask the browser to protect it
              </button>
            </>
          )}
        </p>
      )}

      {lastError && <p className={styles.error}>{lastError}</p>}

      {needsConsoleSetup && (
        <div className={styles.setup}>
          <p className={styles.explain}>
            <strong>One-time setup.</strong> Authentication has never been enabled on the
            Firebase project <code>{FIREBASE_PROJECT_ID}</code>. This has to be done in the
            console — no amount of app code can do it:
          </p>
          <ol>
            <li>
              <a
                className={styles.setupLink}
                href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Authentication ↗
              </a>{' '}
              and press <strong>Get started</strong>.
            </li>
            <li>
              <a
                className={styles.setupLink}
                href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Sign-in method ↗
              </a>{' '}
              → choose <strong>Google</strong> → toggle Enable → pick a support email → Save.
              Firebase creates the OAuth client for you.
            </li>
            <li>
              <a
                className={styles.setupLink}
                href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Check Authorized domains ↗
              </a>{' '}
              — add the domain you deploy to. <code>localhost</code> is already there.
            </li>
            <li>Come back and press Sign in with Google. Nothing else changes.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
