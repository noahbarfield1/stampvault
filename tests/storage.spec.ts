import { test, expect } from '@playwright/test';

/* ──────────────────────────────────────────────────────────────────────────────
 * Storage — the bug that broke saving in real use.
 *
 * The collection store persisted its ENTIRE state to localStorage, including
 * `filteredStamps`, which duplicates every stamp AND its full base64 crop. That
 * blew Safari's ~5MB quota after about a dozen stamps, and zustand swallows
 * QuotaExceededError, so saves failed with no explanation.
 * ────────────────────────────────────────────────────────────────────────────── */

/** Load the sample collection through the app's own UI. */
async function loadSamples(page: import('@playwright/test').Page) {
  await page.goto('/settings');
  // Data Management is open by default, so the button is directly reachable.
  const load = page.getByRole('button', { name: /load sample collection/i });
  await load.scrollIntoViewIfNeeded();
  await load.click();
  // The toast confirms the store actually took them.
  await expect(page.getByText(/sample stamps added|already loaded/i).first()).toBeVisible();
}

test('localStorage holds no duplicated collection and no full images', async ({ page }) => {
  await loadSamples(page);

  const persisted = await page.evaluate(() => {
    const raw = localStorage.getItem('stampvault-stamps');
    const state = raw ? JSON.parse(raw).state : null;
    return {
      bytes: raw?.length ?? 0,
      keys: state ? Object.keys(state) : [],
      stampCount: state?.stamps?.length ?? 0,
      anyFullImage: (state?.stamps ?? []).some((s: { imageUrl?: string }) =>
        (s.imageUrl ?? '').startsWith('data:'),
      ),
      allHaveThumbnails: (state?.stamps ?? []).every(
        (s: { thumbnailUrl?: string }) => !!s.thumbnailUrl,
      ),
    };
  });

  expect(persisted.stampCount).toBeGreaterThan(0);
  // The duplicate array. Its presence is the bug.
  expect(persisted.keys).not.toContain('filteredStamps');
  // Derived, so never worth persisting.
  expect(persisted.keys).not.toContain('collectionStats');
  // Full crops belong in IndexedDB.
  expect(persisted.anyFullImage).toBe(false);
  expect(persisted.allHaveThumbnails).toBe(true);
  // Metadata plus a thumbnail should be a few KB per stamp, not hundreds.
  expect(persisted.bytes / persisted.stampCount).toBeLessThan(60_000);
});

test('the collection still renders after a reload', async ({ page }) => {
  await loadSamples(page);
  await page.goto('/collection');
  await expect(page.getByText(/\d+ stamps?/)).toBeVisible();

  // A reload exercises rehydrate: filteredStamps must be recomputed, and the
  // grid must render from thumbnails while full images load asynchronously.
  await page.reload();
  await expect(page.getByText(/\d+ stamps?/)).toBeVisible();

  const imgs = page.locator('img');
  await expect(imgs.first()).toBeVisible();
  const broken = await page.evaluate(
    () =>
      [...document.querySelectorAll('img')].filter(
        (i) => i.complete && i.naturalWidth === 0,
      ).length,
  );
  expect(broken, 'broken images after reload').toBe(0);
});

test('a stamp with no price shows an em dash, never $0.00', async ({ page }) => {
  /*
   * "$0.00" on a duck stamp reads as "this is worthless" when the truth is
   * "we could not look it up". This is exactly what happened in production when
   * Firecrawl ran out of credits: 38 lookups returned HTTP 402 and every one of
   * those stamps rendered as $0.00.
   *
   * Seeded directly, because the sample stamps ship WITH prices — stubbing the
   * lookup route would never be consulted for them.
   */
  const unpriced = {
    id: 'unpriced-1',
    userId: 'local',
    imageUrl: '',
    thumbnailUrl: '/test-stamps/stamp-4.png',
    identification: {
      country: 'United States', year: 1941, denomination: '$1',
      scottNumber: 'RW8', michelNumber: null,
      description: 'US 1941 Migratory Bird Hunting stamp',
      condition: 'used', rarity: 'scarce', color: null, perforation: null,
      watermark: null, series: null, confidence: 0.9,
      status: 'identified', referenceImageUrl: null,
    },
    pricing: {
      estimatedValue: 0, currency: 'USD', confidence: 0, sources: [],
      priceRange: { min: 0, max: 0 }, lastUpdated: new Date().toISOString(),
      hipValue: null, sourceBreakdown: {},
      priceBasis: {
        tier: 'catalog', label: 'No pricing found', value: 0,
        currency: 'USD', asOf: null, sampleSize: 0, proof: null,
      },
    },
    priceHistory: [], notes: '', tags: [], isFavorite: false,
    purchasePrice: null, purchaseDate: null, grade: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };

  // Seed BEFORE any page script runs. Visiting a page first and then writing
  // localStorage races the store's own persist: it can flush its freshly
  // hydrated (empty) state back over the seed. That race passed in isolation
  // and failed under a full parallel-ish run.
  await page.addInitScript((stamp) => {
    localStorage.setItem(
      'stampvault-stamps',
      JSON.stringify({ state: { stamps: [stamp] }, version: 1 }),
    );
  }, unpriced);

  await page.goto('/collection/unpriced-1');

  await expect(page.getByText('Not priced')).toBeVisible();
  await expect(page.getByText(/not an estimate of zero/i)).toBeVisible();
  // The specific regression: the headline figure must not read $0.00.
  await expect(page.getByText('$0.00')).toHaveCount(0);
});
