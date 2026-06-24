'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GoldButton from '@/components/ui/GoldButton';
import Modal from '@/components/ui/Modal';
import styles from './settings.module.css';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface SettingsState {
  vertexAiKey: string;
  perplexityKey: string;
  hipstampKey: string;
  ebayKey: string;
  refreshFrequency: string;
  cacheDuration: string;
  voiceEnabled: boolean;
  ttsVoice: string;
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
    id: 'api',
    title: 'API Configuration',
    description: 'Manage your API keys for AI and pricing services',
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
  const [settings, setSettings] = useState<SettingsState>({
    vertexAiKey: '',
    perplexityKey: '',
    hipstampKey: '',
    ebayKey: '',
    refreshFrequency: '24h',
    cacheDuration: '7d',
    voiceEnabled: true,
    ttsVoice: 'default',
  });

  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['api', 'pricing', 'voice', 'data', 'about'])
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

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

  /* ── Mask API Key ───────────────────────────────────────────────────── */
  const maskKey = (key: string): string => {
    if (!key) return '';
    if (key.length <= 8) return '•'.repeat(key.length);
    return key.slice(0, 4) + '•'.repeat(key.length - 8) + key.slice(-4);
  };

  /* ── Save Settings ──────────────────────────────────────────────────── */
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      /* In production, save to Firestore settings collection */
      await new Promise((r) => setTimeout(r, 1000));
      console.log('Settings saved:', settings);
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  /* ── Export CSV ──────────────────────────────────────────────────────── */
  const handleExportCSV = useCallback(() => {
    const headers = [
      'ID',
      'Description',
      'Country',
      'Year',
      'Scott Number',
      'Condition',
      'Rarity',
      'Estimated Value',
      'Currency',
      'Tags',
      'Notes',
      'Created At',
    ];
    const csvContent = [headers.join(','), ''].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `perduestampvault-collection-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  /* ── Export JSON ─────────────────────────────────────────────────────── */
  const handleExportJSON = useCallback(() => {
    const data = {
      exportDate: new Date().toISOString(),
      version: '1.0.0',
      stamps: [],
      settings: settings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `perduestampvault-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [settings]);

  /* ── Import ──────────────────────────────────────────────────────────── */
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          console.log('Import file read:', file.name);
          /* In production, parse and import stamps */
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, []);

  /* ── Clear All Data ─────────────────────────────────────────────────── */
  const handleClearData = useCallback(async () => {
    /* In production, clear Firestore collection */
    await new Promise((r) => setTimeout(r, 500));
    setShowClearModal(false);
    console.log('All data cleared');
  }, []);

  /* ── Render Section Body ────────────────────────────────────────────── */
  const renderSectionBody = (sectionId: string) => {
    switch (sectionId) {
      case 'api':
        return (
          <div className={styles.sectionBody}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="vertexAiKey">
                Vertex AI API Key
              </label>
              <input
                id="vertexAiKey"
                type="password"
                className={styles.fieldInput}
                value={settings.vertexAiKey}
                onChange={(e) => updateSetting('vertexAiKey', e.target.value)}
                placeholder="Enter your Vertex AI API key…"
                autoComplete="off"
              />
              <span className={styles.fieldHint}>
                {settings.vertexAiKey
                  ? `Key: ${maskKey(settings.vertexAiKey)}`
                  : 'Required for stamp identification and AI chat'}
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="perplexityKey">
                Perplexity API Key
              </label>
              <input
                id="perplexityKey"
                type="password"
                className={styles.fieldInput}
                value={settings.perplexityKey}
                onChange={(e) => updateSetting('perplexityKey', e.target.value)}
                placeholder="Enter your Perplexity API key…"
                autoComplete="off"
              />
              <span className={styles.fieldHint}>
                {settings.perplexityKey
                  ? `Key: ${maskKey(settings.perplexityKey)}`
                  : 'Used for market research and price estimation'}
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="hipstampKey">
                HipStamp API Key
              </label>
              <input
                id="hipstampKey"
                type="password"
                className={styles.fieldInput}
                value={settings.hipstampKey}
                onChange={(e) => updateSetting('hipstampKey', e.target.value)}
                placeholder="Enter your HipStamp API key…"
                autoComplete="off"
              />
              <span className={styles.fieldHint}>
                {settings.hipstampKey
                  ? `Key: ${maskKey(settings.hipstampKey)}`
                  : 'For HipStamp marketplace pricing data'}
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="ebayKey">
                eBay API Key
              </label>
              <input
                id="ebayKey"
                type="password"
                className={styles.fieldInput}
                value={settings.ebayKey}
                onChange={(e) => updateSetting('ebayKey', e.target.value)}
                placeholder="Enter your eBay API key…"
                autoComplete="off"
              />
              <span className={styles.fieldHint}>
                {settings.ebayKey
                  ? `Key: ${maskKey(settings.ebayKey)}`
                  : 'For eBay sold listings price comparison'}
              </span>
            </div>
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
              <div className={styles.aboutItem}>
                <span className={styles.aboutLabel}>Version</span>
                <span className={styles.aboutValue}>1.0.0</span>
              </div>
              <div className={styles.aboutItem}>
                <span className={styles.aboutLabel}>Build</span>
                <span className={styles.aboutValue}>2026.06.21</span>
              </div>
              <div className={styles.aboutItem}>
                <span className={styles.aboutLabel}>Framework</span>
                <span className={styles.aboutValue}>Next.js 15</span>
              </div>
              <div className={styles.aboutItem}>
                <span className={styles.aboutLabel}>AI Engine</span>
                <span className={styles.aboutValue}>Vertex AI Gemini</span>
              </div>
              <div className={styles.aboutItem}>
                <span className={styles.aboutLabel}>Documentation</span>
                <a
                  href="https://perduestampvault.app/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.aboutLink}
                >
                  perduestampvault.app/docs
                </a>
              </div>
              <div className={styles.aboutItem}>
                <span className={styles.aboutLabel}>GitHub</span>
                <a
                  href="https://github.com/perduestampvault"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.aboutLink}
                >
                  github.com/perduestampvault
                </a>
              </div>
              <div className={styles.aboutItem}>
                <span className={styles.aboutLabel}>Support</span>
                <a
                  href="mailto:support@perduestampvault.app"
                  className={styles.aboutLink}
                >
                  support@perduestampvault.app
                </a>
              </div>
              <div className={styles.aboutItem}>
                <span className={styles.aboutLabel}>License</span>
                <span className={styles.aboutValue}>MIT</span>
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
          Configure API keys, pricing, voice controls, and data management
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
                  <h3 className={styles.sectionTitle}>{section.title}</h3>
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
