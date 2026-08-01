/* Shared reader for the client-side settings persisted by the Settings page
 * (localStorage key 'stampvault-settings'). Keep option values in sync with
 * settings/page.tsx's <select> options. */

const DAY_MS = 24 * 60 * 60 * 1000;

const CACHE_DURATION_MS: Record<string, number> = {
  '1d': 1 * DAY_MS,
  '3d': 3 * DAY_MS,
  '7d': 7 * DAY_MS,
  '14d': 14 * DAY_MS,
  '30d': 30 * DAY_MS,
};

const DEFAULT_CACHE_DURATION_MS = CACHE_DURATION_MS['7d'];

export function getCacheDurationMs(): number {
  try {
    const raw = localStorage.getItem('stampvault-settings');
    if (!raw) return DEFAULT_CACHE_DURATION_MS;
    const parsed = JSON.parse(raw);
    return CACHE_DURATION_MS[parsed.cacheDuration] ?? DEFAULT_CACHE_DURATION_MS;
  } catch {
    return DEFAULT_CACHE_DURATION_MS;
  }
}
