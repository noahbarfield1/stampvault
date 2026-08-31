/* ──────────────────────────────────────────────────────────────────────────────
 * Recognising a storage-quota failure.
 *
 * Until now nothing in this codebase actually checked for one. `handleSave`
 * caught every throw and reported "this device is out of storage space", so a
 * corrupt image that broke `makeThumbnail` produced the identical message. The
 * wording was a guess that happened to be right most of the time.
 *
 * Correcting a comment that was repeated across four files while we are here:
 * **zustand's persist middleware does not swallow QuotaExceededError.**
 * Verified against zustand 5.0.14, `esm/middleware.mjs:370-376`:
 *
 *     const configResult = config(
 *       (...args) => { set(...args); return setItem(); },   // no try/catch
 *       get, api);
 *
 * and `createJSONStorage` (:278-303) wraps only `getStorage()`, never
 * `setItem`. The error propagates synchronously out of every store action.
 * The real defect was never silence — it was that `set(...)` has already run
 * by the time `setItem()` throws, so the stamp is in memory and on screen but
 * not on disk.
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Legacy DOMException codes. Modern browsers set `name`, but Safari and
 * Firefox have both shipped versions that only set `code`.
 */
const QUOTA_EXCEEDED_ERR = 22; // WebKit / legacy DOMException table
const NS_ERROR_DOM_QUOTA_REACHED = 1014; // Gecko

const QUOTA_NAMES = new Set([
  'QuotaExceededError', // the standard
  'NS_ERROR_DOM_QUOTA_REACHED', // Firefox legacy
  'QUOTA_EXCEEDED_ERR', // Safari/WebKit legacy
]);

/**
 * True when `err` is a storage-quota failure.
 *
 * Deliberately structural rather than `instanceof DOMException`: Safari
 * private mode has historically thrown a plain `Error` for a quota refusal,
 * and an `instanceof` check would miss exactly the browser that fails most.
 *
 * Everything that is not recognisably a quota error must fall through to
 * `false`, so a genuine bug is reported as a bug rather than as a full disk.
 */
export function isQuotaError(err: unknown): boolean {
  if (err === null || err === undefined) return false;
  if (typeof err !== 'object') return false;

  const { name, code } = err as { name?: unknown; code?: unknown };

  if (typeof name === 'string' && QUOTA_NAMES.has(name)) return true;

  // Only consult `code` for the two values that mean quota in the legacy
  // DOMException table. `code === 0` is the "no legacy code" sentinel and must
  // never match.
  if (typeof code === 'number') {
    if (code === QUOTA_EXCEEDED_ERR || code === NS_ERROR_DOM_QUOTA_REACHED) {
      return true;
    }
  }

  return false;
}
