'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import GoldButton from '@/components/ui/GoldButton';
import Modal from '@/components/ui/Modal';
import styles from './settings.module.css';
import { useStampsStore } from '@/store/stamps';
import { useUIStore } from '@/store/ui';
import { useSyncStore } from '@/store/sync';
import type { Stamp } from '@/types/stamp';
import { usePageChrome } from '@/hooks/usePageChrome';
import CloudSyncPanel from '@/components/settings/CloudSyncPanel';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface SettingsState {
  refreshFrequency: string;
  cacheDuration: string;
  voiceEnabled: boolean;
  ttsVoice: string;
}

interface ServiceStatus {
  vertexAi: boolean;
  firecrawl: boolean;
  ebay: boolean;
  pricingProvider?: { name: string; free: boolean; reason: string };
}

interface SectionConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

/* ─── Section Definitions ────────────────────────────────────────────── */

const SECTIONS: SectionConfig[] = [
  {
    id: 'sync',
    title: 'Cloud Sync',
    description: 'Back up your collection and use it on more than one device',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
      </svg>
    ),
  },
  {
    id: 'api',
    title: 'Service Status',
    description: 'Which AI and pricing services are configured on the server',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
    ),
  },
  {
    id: 'pricing',
    title: 'Price Settings',
    description: 'Configure price refresh and caching behavior',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    id: 'voice',
    title: 'Voice Settings',
    description: 'Voice commands and text-to-speech preferences',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="1" width="6" height="12" rx="3" />
        <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
  },
  {
    id: 'data',
    title: 'Data Management',
    description: 'Export, import, and manage your collection data',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
  {
    id: 'about',
    title: 'About',
    description: 'App version, credits, and links',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
];

/* ─── Component ──────────────────────────────────────────────────────── */

export default function SettingsPage() {
  usePageChrome({ title: 'Settings', backHref: '/dashboard' });
  const stamps = useStampsStore((s) => s.stamps);
  const setStamps = useStampsStore((s) => s.setStamps);
  const addStamp = useStampsStore((s) => s.addStamp);
  const addToast = useUIStore((s) => s.addToast);

  const [settings, setSettings] = useState<SettingsState>({
    refreshFrequency: '24h',
    cacheDuration: '7d',
    voiceEnabled: true,
    ttsVoice: 'default',
  });
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);

  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['api', 'pricing', 'voice', 'data', 'about'])
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  useEffect(() => {
    fetch('/api/settings/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setServiceStatus(data))
      .catch(() => {});
  }, []);

  // handleSave writes to localStorage, but nothing ever read it back — every
  // saved setting (refresh frequency, cache duration, voice toggle, any API
  // keys typed in) silently reset to these defaults on next load. Restore on
  // mount instead of in the initial useState so this stays SSR-safe.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('stampvault-settings');
      if (raw) {
        setSettings((prev) => ({ ...prev, ...JSON.parse(raw) }));
      }
    } catch {
      // ignore malformed/unavailable storage
    }
  }, []);

  /* ── Toggle Section ─────────────────────────────────────────────────── */
  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /* ── Update Setting ─────────────────────────────────────────────────── */
  const updateSetting = useCallback(
    <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  /* ── Save Settings ──────────────────────────────────────────────────── */
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('stampvault-settings', JSON.stringify(settings));
      addToast({
        type: 'success',
        title: 'Settings saved',
        message: 'Your settings have been saved to this browser.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [settings, addToast]);

  /* ── CSV Field Escaping ────────────────────────────────────────────── */
  const escapeCSVField = (value: unknown): string => {
    const str = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  /* ── Export CSV ──────────────────────────────────────────────────────── */
  const handleExportCSV = useCallback(() => {
    if (stamps.length === 0) {
      addToast({
        type: 'info',
        title: 'Nothing to export',
        message: 'Your collection is empty.',
      });
      return;
    }

    const headers = [
      'id',
      'country',
      'year',
      'denomination',
      'scottNumber',
      'condition',
      'rarity',
      'estimatedValue',
      'description',
    ];
    const rows = stamps.map((stamp) =>
      [
        stamp.id,
        stamp.identification.country,
        stamp.identification.year,
        stamp.identification.denomination,
        stamp.identification.scottNumber,
        stamp.identification.condition,
        stamp.identification.rarity,
        stamp.pricing?.estimatedValue,
        stamp.identification.description,
      ]
        .map(escapeCSVField)
        .join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'stampvault-collection.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast({
      type: 'success',
      title: 'Export complete',
      message: `Exported ${stamps.length} stamp${stamps.length === 1 ? '' : 's'} to CSV.`,
    });
  }, [stamps, addToast]);

  /* ── Export JSON ─────────────────────────────────────────────────────── */
  const handleExportJSON = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      stamps,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'stampvault-collection.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast({
      type: 'success',
      title: 'Export complete',
      message: `Exported ${stamps.length} stamp${stamps.length === 1 ? '' : 's'} to JSON.`,
    });
  }, [stamps, addToast]);

  /* ── Import ──────────────────────────────────────────────────────────── */
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(reader.result as string);
        } catch {
          addToast({
            type: 'error',
            title: 'Import failed',
            message: 'That file is not valid JSON.',
          });
          return;
        }

        let candidates: unknown[];
        if (Array.isArray(parsed)) {
          candidates = parsed;
        } else if (
          parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as { stamps?: unknown }).stamps)
        ) {
          candidates = (parsed as { stamps: unknown[] }).stamps;
        } else {
          addToast({
            type: 'error',
            title: 'Import failed',
            message: 'Expected an array of stamps or an object with a "stamps" array.',
          });
          return;
        }

        let importedCount = 0;
        candidates.forEach((entry) => {
          if (
            entry &&
            typeof entry === 'object' &&
            'id' in entry &&
            (entry as { id?: unknown }).id
          ) {
            addStamp(entry as Stamp);
            importedCount += 1;
          }
        });

        if (importedCount === 0) {
          addToast({
            type: 'error',
            title: 'Import failed',
            message: 'No valid stamps were found in the selected file.',
          });
        } else {
          addToast({
            type: 'success',
            title: 'Import complete',
            message: `Imported ${importedCount} stamp${importedCount === 1 ? '' : 's'}.`,
          });
        }
      };
      reader.onerror = () => {
        addToast({
          type: 'error',
          title: 'Import failed',
          message: 'Could not read the selected file.',
        });
      };
      reader.readAsText(file);
    };
    input.click();
  }, [addStamp, addToast]);

  /* ── Clear All Data ─────────────────────────────────────────────────── */
  const handleClearData = useCallback(async () => {
    setStamps([]);
    setShowClearModal(false);

    // Emptying the store only clears localStorage. Every full-resolution crop
    // lives in IndexedDB and used to survive this, orphaned and unreachable —
    // so a user who cleared and re-added kept accumulating dead images that ate
    // the origin's shared storage bucket.
    let imagesCleared = true;
    try {
      const { clearAllImages } = await import('@/lib/storage/image-store');
      await clearAllImages();
    } catch (err) {
      imagesCleared = false;
      console.error('[settings] could not clear stored images', err);
    }

    // "Permanently deleted" was not true when signed in: the cloud copy
    // survives on purpose, because sync's merge never treats a local absence
    // as a delete. Only removeStamp deletes remotely.
    const signedIn = Boolean(useSyncStore.getState().user);

    addToast({
      type: imagesCleared ? 'success' : 'warning',
      title: imagesCleared ? 'Collection cleared' : 'Collection cleared, images left behind',
      message: !imagesCleared
        ? 'The stamps are gone from this device, but their stored images could not be removed.'
        : signedIn
          ? 'All stamps have been removed from this device. Your cloud copy is untouched — ' +
            'sync will restore them unless you delete them individually.'
          : 'All stamps have been permanently deleted.',
    });
  }, [setStamps, addToast]);

  /* ── Render Section Body ────────────────────────────────────────────── */
  const handleLoadSamples = useCallback(async () => {
    const { demoStamps } = await import('@/lib/demo-data');
    const existing = new Set(useStampsStore.getState().stamps.map((s) => s.id));
    const added = demoStamps.filter((s) => !existing.has(s.id));
    added.forEach((s) => useStampsStore.getState().addStamp(s));
    addToast({
      type: added.length ? 'success' : 'info',
      title: added.length ? 'Sample stamps added' : 'Samples already loaded',
      message: added.length
        ? `${added.length} sample stamp${added.length === 1 ? '' : 's'} added to your collection.`
        : undefined,
    });
  }, [addToast]);

  const renderSectionBody = (sectionId: string) => {
    switch (sectionId) {
      case 'sync':
        return (
          <div className={styles.sectionBody}>
            <CloudSyncPanel />
          </div>
        );
      case 'api':
        return (
          <div className={styles.sectionBody}>
            <p className={styles.fieldHint} style={{ marginBottom: 'var(--space-2)' }}>
              These are configured server-side and can&apos;t be changed from the
              browser. This just shows what&apos;s actually active.
            </p>
            {[
              {
                key: 'vertexAi' as const,
                label: 'Vertex AI (Gemini)',
                hint: 'Stamp identification, segmentation, and AI chat',
              },
              {
                key: 'ebay' as const,
                label: 'eBay Browse API',
                hint: 'Free structured pricing — preferred when configured',
              },
              {
                key: 'firecrawl' as const,
                label: 'Firecrawl',
                hint: 'Price scraping fallback, costs credits per lookup',
              },
            ].map(({ key, label, hint }) => {
              const active = Boolean(serviceStatus?.[key]);
              return (
                <div key={key} className={styles.toggleRow}>
                  <div className={styles.toggleInfo}>
                    <span className={styles.toggleLabel}>{label}</span>
                    <span className={styles.toggleDescription}>{hint}</span>
                  </div>
                  <span
                    style={{
                      color: active ? 'var(--color-success, #2ecc71)' : 'var(--color-text-tertiary)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {serviceStatus === null ? '…' : active ? '✓ Configured' : '✕ Not configured'}
                  </span>
                </div>
              );
            })}

            {serviceStatus?.pricingProvider && (
              <p className={styles.fieldHint} style={{ marginTop: 'var(--space-3)' }}>
                Pricing uses <strong>{serviceStatus.pricingProvider.name}</strong>.{' '}
                {serviceStatus.pricingProvider.reason}
              </p>
            )}
          </div>
        );

      case 'pricing':
        return (
          <div className={styles.sectionBody}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="refreshFrequency">
                Price Refresh Frequency
              </label>
              <select
                id="refreshFrequency"
                className={styles.fieldSelect}
                value={settings.refreshFrequency}
                onChange={(e) =>
                  updateSetting('refreshFrequency', e.target.value)
                }
              >
                <option value="1h">Every hour</option>
                <option value="6h">Every 6 hours</option>
                <option value="12h">Every 12 hours</option>
                <option value="24h">Every 24 hours</option>
                <option value="3d">Every 3 days</option>
                <option value="7d">Every 7 days</option>
                <option value="manual">Manual only</option>
              </select>
              <span className={styles.fieldHint}>
                How often to automatically refresh stamp prices from all sources
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="cacheDuration">
                Cache Duration
              </label>
              <select
                id="cacheDuration"
                className={styles.fieldSelect}
                value={settings.cacheDuration}
                onChange={(e) =>
                  updateSetting('cacheDuration', e.target.value)
                }
              >
                <option value="1d">1 day</option>
                <option value="3d">3 days</option>
                <option value="7d">7 days</option>
                <option value="14d">14 days</option>
                <option value="30d">30 days</option>
              </select>
              <span className={styles.fieldHint}>
                How long to cache price data before requiring a fresh fetch
              </span>
            </div>
          </div>
        );

      case 'voice':
        return (
          <div className={styles.sectionBody}>
            <div className={styles.toggleRow}>
              <div className={styles.toggleInfo}>
                <span className={styles.toggleLabel}>
                  Enable Voice Commands
                </span>
                <span className={styles.toggleDescription}>
                  Use voice to navigate, search, and interact with PerdueStampVault
                </span>
              </div>
              <button
                className={
                  settings.voiceEnabled ? styles.toggleActive : styles.toggle
                }
                onClick={() =>
                  updateSetting('voiceEnabled', !settings.voiceEnabled)
                }
                type="button"
                role="switch"
                aria-checked={settings.voiceEnabled}
                aria-label="Enable voice commands"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="ttsVoice">
                Text-to-Speech Voice
              </label>
              <select
                id="ttsVoice"
                className={styles.fieldSelect}
                value={settings.ttsVoice}
                onChange={(e) => updateSetting('ttsVoice', e.target.value)}
                disabled={!settings.voiceEnabled}
              >
                <option value="default">System Default</option>
                <option value="en-US-Standard-A">English (US) — Female</option>
                <option value="en-US-Standard-B">English (US) — Male</option>
                <option value="en-GB-Standard-A">English (UK) — Female</option>
                <option value="en-GB-Standard-B">English (UK) — Male</option>
                <option value="en-AU-Standard-A">English (AU) — Female</option>
              </select>
              <span className={styles.fieldHint}>
                Voice used for spoken feedback and AI responses
              </span>
            </div>
          </div>
        );

      case 'data':
        return (
          <div className={styles.sectionBody}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Sample Collection</span>
              <p className={styles.fieldHint} style={{ marginBottom: 'var(--space-2)' }}>
                Three real US Presidential Series stamps, for trying the app out. They are
                clearly not yours — remove them whenever you like.
              </p>
              <div className={styles.buttonGroup}>
                <button
                  className={styles.outlineButton}
                  onClick={handleLoadSamples}
                  type="button"
                >
                  Load sample collection
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Export Collection</span>
              <div className={styles.buttonGroup}>
                <button
                  className={styles.outlineButton}
                  onClick={handleExportCSV}
                  type="button"
                >
                  <svg
                    className={styles.buttonIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export CSV
                </button>
                <button
                  className={styles.outlineButton}
                  onClick={handleExportJSON}
                  type="button"
                >
                  <svg
                    className={styles.buttonIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export JSON
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Import Stamps</span>
              <div className={styles.buttonGroup}>
                <button
                  className={styles.outlineButton}
                  onClick={handleImport}
                  type="button"
                >
                  <svg
                    className={styles.buttonIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Import from File
                </button>
              </div>
              <span className={styles.fieldHint}>
                Supports JSON and CSV formats
              </span>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Danger Zone</span>
              <div className={styles.buttonGroup}>
                <button
                  className={styles.dangerButton}
                  onClick={() => setShowClearModal(true)}
                  type="button"
                >
                  <svg
                    className={styles.buttonIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  Clear All Data
                </button>
              </div>
            </div>
          </div>
        );

      case 'about':
        return (
          <div className={styles.sectionBody}>
            <div className={styles.aboutGrid}>
              {/* Every value here is real. This block previously advertised
                  perduestampvault.app/docs (domain does not resolve),
                  github.com/perduestampvault (404) and a support@ address on
                  that same dead domain — so it invited people to email nobody.
                  It also claimed Next.js 15 and a hardcoded build date. */}
              <div className={styles.aboutItem}>
                <span className={styles.aboutLabel}>Version</span>
                <span className={styles.aboutValue}>0.1.0</span>
              </div>
              <div className={styles.aboutItem}>
                <span className={styles.aboutLabel}>Framework</span>
                <span className={styles.aboutValue}>Next.js 16</span>
              </div>
              <div className={styles.aboutItem}>
                <span className={styles.aboutLabel}>Identification</span>
                <span className={styles.aboutValue}>Google Gemini 2.5 (Vertex AI)</span>
              </div>
              <div className={styles.aboutItem}>
                <span className={styles.aboutLabel}>Pricing data</span>
                <span className={styles.aboutValue}>eBay listings via Firecrawl</span>
              </div>
              <div className={styles.aboutItem}>
                <span className={styles.aboutLabel}>How it works</span>
                <Link href="/tutorial" className={styles.aboutLink}>
                  Read the guide
                </Link>
              </div>
              <div className={styles.aboutItem}>
                <span className={styles.aboutLabel}>Source</span>
                <a
                  href="https://github.com/noahbarfield1/stampvault"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.aboutLink}
                >
                  github.com/noahbarfield1/stampvault
                </a>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <motion.div
        className={styles.pageHeader}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className={styles.pageTitle}>Settings</h1>
        <p className={styles.subtitle}>
          Service status, pricing, voice controls, and data management
        </p>
      </motion.div>

      {/* Sections */}
      <div className={styles.sections}>
        {SECTIONS.map((section, index) => (
          <motion.div
            key={section.id}
            className={styles.section}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.06 }}
          >
            {/* Section Header */}
            <div
              className={styles.sectionHeader}
              onClick={() => toggleSection(section.id)}
              role="button"
              tabIndex={0}
              aria-expanded={openSections.has(section.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleSection(section.id);
                }
              }}
            >
              <div className={styles.sectionHeaderLeft}>
                <span className={styles.sectionIcon}>{section.icon}</span>
                <div>
                  <h2 className={styles.sectionTitle}>{section.title}</h2>
                  <p className={styles.sectionDescription}>
                    {section.description}
                  </p>
                </div>
              </div>
              <svg
                className={
                  openSections.has(section.id)
                    ? styles.chevronOpen
                    : styles.chevron
                }
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* Section Body */}
            <AnimatePresence>
              {openSections.has(section.id) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  {renderSectionBody(section.id)}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Save Button */}
      <motion.div
        className={styles.saveFooter}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <GoldButton onClick={handleSave} loading={isSaving} size="lg">
          {isSaving ? 'Saving…' : 'Save All Settings'}
        </GoldButton>
      </motion.div>

      {/* Clear Data Confirmation Modal */}
      <Modal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="Clear All Data"
        size="sm"
      >
        <div className={styles.confirmContent}>
          <div className={styles.confirmIcon}>⚠️</div>
          <p className={styles.confirmText}>
            This will permanently delete all stamps, price history, and settings
            from your account. This action cannot be undone.
          </p>
          <div className={styles.confirmActions}>
            <button
              className={styles.cancelButton}
              onClick={() => setShowClearModal(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.confirmButton}
              onClick={handleClearData}
              type="button"
            >
              Delete Everything
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
