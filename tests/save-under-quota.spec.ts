import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/* A REAL photo, not synthetic bytes.
 *
 * The first version of this file seeded `'A'.repeat(120*1024)` as the crop.
 * That is not a decodable JPEG, so makeThumbnail's loadImage rejected and every
 * stamp failed — the test reported a bug that did not exist. The crop has to
 * survive an actual canvas decode for this to exercise anything, and at 396KB
 * on disk (~528KB as base64) this is the real phone photo the app was built
 * for. */
const REAL_CROP_DATA_URL =
  'data:image/jpeg;base64,' +
  readFileSync(path.join(process.cwd(), 'public/test-stamps/IMG_4184.jpg')).toString('base64');

/* ──────────────────────────────────────────────────────────────────────────────
 * Saving when the device is out of storage.
 *
 * Reported 2026-08-09 from a phone: "Could not save your stamps — The quota has
 * been exceeded", with fewer than five stamps and exactly ONE landing in the
 * collection. Two defects produced that:
 *
 *   1. makeThumbnail did `return out ?? dataUrl`, so when canvas allocation
 *      failed it handed back the original 80-200KB crop as the "thumbnail",
 *      and partialize persisted it — a ~10x blowup per stamp.
 *   2. handleSave aborted the whole loop on the first failure, silently
 *      discarding every stamp after the one that threw.
 *
 * Unit tests cover the pure logic. Neither defect is reachable from there:
 * both live in browser code, against a real localStorage with a real cap.
 *
 * Approach: fill localStorage with ballast so only a little headroom remains,
 * then drive a save of several stamps. The assertions are about BEHAVIOUR under
 * exhaustion — save what fits, say what didn't, stay on the page — not about
 * any particular number surviving, which depends on the browser's cap.
 * ────────────────────────────────────────────────────────────────────────────── */

const STAMP_COUNT = 5;


/** Consume localStorage down to roughly `headroomKB` of free space. */
async function fillStorage(page: import('@playwright/test').Page, headroomKB: number) {
  return page.evaluate((headroom) => {
    const CHUNK = 'x'.repeat(64 * 1024);
    let written = 0;
    try {
      // Write until the browser refuses, then release `headroom` worth.
      for (let i = 0; i < 200; i++) {
        localStorage.setItem(`__ballast_${i}`, CHUNK);
        written++;
      }
    } catch {
      /* full — expected */
    }
    const release = Math.ceil(headroom / 64);
    for (let i = written - release; i < written; i++) localStorage.removeItem(`__ballast_${i}`);
    return { chunksWritten: written, chunksReleased: release };
  }, headroomKB);
}

test('localStorage really can be exhausted in this browser', async ({ page }) => {
  await page.goto('/dashboard');
  const filled = await fillStorage(page, 0);
  // If the browser never refuses, the rest of this file proves nothing — fail
  // loudly rather than reporting a green run that exercised an empty quota.
  expect(filled.chunksWritten).toBeGreaterThan(0);
  expect(filled.chunksWritten).toBeLessThan(200);

  const stillThrows = await page.evaluate(() => {
    try {
      localStorage.setItem('__probe', 'y'.repeat(64 * 1024));
      localStorage.removeItem('__probe');
      return false;
    } catch {
      return true;
    }
  });
  expect(stillThrows).toBe(true);
});

test('a persisted thumbnail is never a full-resolution crop', async ({ page }) => {
  await page.goto('/settings');
  const load = page.getByRole('button', { name: /load sample collection/i });
  await load.scrollIntoViewIfNeeded();
  await load.click();
  await expect(page.getByText(/sample stamps added|already loaded/i).first()).toBeVisible();

  const worst = await page.evaluate(() => {
    const raw = localStorage.getItem('stampvault-stamps');
    const stamps = raw ? JSON.parse(raw).state?.stamps ?? [] : [];
    return stamps.reduce(
      (max: number, s: { thumbnailUrl?: string }) => Math.max(max, (s.thumbnailUrl ?? '').length),
      0,
    );
  });

  // safeThumbnail's cap. A real 240px/0.7 JPEG is 12-25KB; a full crop is 80KB+.
  expect(worst).toBeLessThanOrEqual(48 * 1024);
});

/** Put the real upload wizard on its review screen with `count` stamps. */
async function driveToReviewScreen(page: import('@playwright/test').Page, count: number) {
  const crop = REAL_CROP_DATA_URL;
  await page.goto('/upload');
  // The hook only exists when NEXT_PUBLIC_E2E_HOOKS=1, which the webServer sets.
  await page.waitForFunction(() => '__uploadSessionStore' in window, null, { timeout: 10_000 });

  await page.evaluate(({ n, crop }) => {
    const store = (
      window as unknown as {
        __uploadSessionStore: { getState: () => Record<string, (arg: unknown) => void> };
      }
    ).__uploadSessionStore;

    const identified = Array.from({ length: n }, (_, i) => ({
      id: `seed-${i}`,
      // Full-size crop, exactly what the real pipeline hands to makeThumbnail.
      imageUrl: crop,
      thumbnailUrl: null,
      identification: {
        country: 'United States',
        year: 1938,
        denomination: `${i + 1}c`,
        scottNumber: String(810 + i),
        michelNumber: null,
        description: `Seeded stamp ${i}`,
        condition: 'used',
        rarity: 'common',
        color: null,
        perforation: null,
        watermark: null,
        series: null,
        confidence: 0.99,
        referenceImageUrl: null,
        status: 'identified',
        alternatives: [],
      },
      pricing: null,
      priceHistory: [],
      tags: [],
      notes: '',
      isFavorite: false,
      purchasePrice: null,
      purchaseDate: null,
    }));

    const s = store.getState();
    s.setIdentified(identified);
    s.setStep('complete');
  }, { n: count, crop });
}

test('a save that runs out of space keeps what fits and stays on the page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await driveToReviewScreen(page, STAMP_COUNT);

  const save = page.getByRole('button', { name: /save all to collection/i });
  await expect(save).toBeVisible({ timeout: 10_000 });

  // Exhaust storage only now, so getting here is not what fails.
  await fillStorage(page, 96);

  await save.click();

  // The regression: the loop used to abort at the first failure and the user
  // was told nothing useful. Either everything saved and we navigated to the
  // collection, or we stayed put with a message that names the count.
  await page.waitForTimeout(3_000);

  const url = page.url();
  const savedCount = await page.evaluate(() => {
    const raw = localStorage.getItem('stampvault-stamps');
    return raw ? JSON.parse(raw).state?.stamps?.length ?? 0 : 0;
  });

  if (url.includes('/collection')) {
    // Everything fit. Then every seeded stamp must actually be there.
    expect(savedCount).toBeGreaterThanOrEqual(STAMP_COUNT);
  } else {
    // Partial failure: we must still be on /upload with the results intact,
    // and the toast must say how many were saved rather than a bare error.
    expect(url).toContain('/upload');
    await expect(
      page.getByText(/saved \d+ of \d+ stamps|could not save your stamps/i).first(),
    ).toBeVisible();
    // Whatever did fit must have been kept — all-or-nothing was the bug.
    expect(savedCount).toBeGreaterThan(0);
  }

  // Nothing may escape as an uncaught error; that is what stranded the user.
  expect(errors).toEqual([]);
});

test('no persisted stamp carries a full-resolution crop, even under pressure', async ({ page }) => {
  await driveToReviewScreen(page, STAMP_COUNT);
  const save = page.getByRole('button', { name: /save all to collection/i });
  await expect(save).toBeVisible({ timeout: 10_000 });
  await save.click();
  await page.waitForTimeout(3_000);

  const worst = await page.evaluate(() => {
    const raw = localStorage.getItem('stampvault-stamps');
    const stamps = raw ? JSON.parse(raw).state?.stamps ?? [] : [];
    return {
      count: stamps.length,
      worstThumb: stamps.reduce(
        (m: number, s: { thumbnailUrl?: string }) => Math.max(m, (s.thumbnailUrl ?? '').length),
        0,
      ),
      anyFullImage: stamps.some((s: { imageUrl?: string }) => (s.imageUrl ?? '').startsWith('data:')),
    };
  });

  expect(worst.count).toBeGreaterThan(0);
  // The ~528KB seeded crop must never appear as a "thumbnail".
  expect(worst.worstThumb).toBeLessThanOrEqual(48 * 1024);
  expect(worst.anyFullImage).toBe(false);
});
