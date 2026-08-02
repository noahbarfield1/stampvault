import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

/* ──────────────────────────────────────────────────────────────────────────────
 * The upload flow, with the AI stubbed.
 *
 * Every assertion here corresponds to a bug that actually reached production.
 * They are deterministic and free: /api/stamps/segment and /api/stamps/identify
 * are intercepted, so no Vertex call is made and nothing costs money.
 * ────────────────────────────────────────────────────────────────────────────── */

const FIXTURE = path.join(process.cwd(), 'public', 'test-stamps', 'IMG_4184.jpg');

/** One detection covering the middle of the frame, in the route's own shape. */
const twoStamps = {
  stamps: [
    {
      boundingBox: { x1: 10, y1: 10, x2: 45, y2: 50 },
      description: 'United States, 9 cents, pink',
      confidence: 0.92,
    },
    {
      boundingBox: { x1: 55, y1: 10, x2: 90, y2: 50 },
      description: 'United States, 1 cent, green',
      confidence: 0.41, // deliberately low: should be flagged, not dropped
    },
  ],
  count: 2,
  reason: 'ok',
  coordSpace: 'normalized_1000',
  droppedCount: 0,
  truncated: false,
};

async function stubSegment(page: Page, body: unknown, status = 200) {
  await page.route('**/api/stamps/segment', (r) =>
    r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

/** Drive the upload page as far as the selection step. */
async function reachSelection(page: Page) {
  await page.goto('/upload');
  await page.setInputFiles('input[type="file"]', FIXTURE);
  await page.getByRole('button', { name: /find stamps/i }).click();
}

test('detections arrive already selected, so a clean scan costs zero taps', async ({ page }) => {
  await stubSegment(page, twoStamps);
  await reachSelection(page);

  // The whole point of merging detect+review: 2 of 2 selected on arrival.
  await expect(page.getByText(/2\s*of\s*2 selected/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /identify 2 stamps/i })).toBeEnabled();
});

test('tapping a stamp toggles it, and the CTA explains why it is disabled', async ({ page }) => {
  await stubSegment(page, twoStamps);
  await reachSelection(page);

  const boxes = page.getByRole('checkbox');
  await expect(boxes).toHaveCount(2);

  await boxes.first().click();
  await expect(page.getByText(/1\s*of\s*2 selected/i)).toBeVisible();
  await expect(boxes.first()).toHaveAttribute('aria-checked', 'false');

  await boxes.nth(1).click();
  await expect(page.getByText(/0\s*of\s*2 selected/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /identify 0 stamps/i })).toBeDisabled();
  // A disabled button with no explanation is what this replaced.
  await expect(page.getByText(/tap at least one stamp/i)).toBeVisible();
});

test('low-confidence detections are flagged but still included', async ({ page }) => {
  await stubSegment(page, twoStamps);
  await reachSelection(page);
  // Silently dropping a 41% detection would be worse than showing it warned.
  await expect(page.getByText(/low-confidence/i)).toBeVisible();
  await expect(page.getByText(/2\s*of\s*2 selected/i)).toBeVisible();
});

test('Select all / None work', async ({ page }) => {
  await stubSegment(page, twoStamps);
  await reachSelection(page);

  await page.getByRole('button', { name: 'None', exact: true }).click();
  await expect(page.getByText(/0\s*of\s*2 selected/i)).toBeVisible();

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.getByText(/2\s*of\s*2 selected/i)).toBeVisible();
});

/* ── Failure paths. These are the regression tests that matter most. ──────── */

test('a segmentation failure shows an error and NEVER fabricates stamps', async ({ page }) => {
  await stubSegment(page, { error: 'upstream exploded', reason: 'model_empty_response' }, 502);
  await reachSelection(page);

  // The old build silently substituted hardcoded demo boxes, named by matching
  // the FILENAME against the catalog, with only a console.error.
  await expect(page.getByText(/stamp detection is unavailable/i).first()).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /draw the box myself/i })).toBeVisible();
});

test('"no stamps found" is an empty state, not an invented full-frame box', async ({ page }) => {
  await stubSegment(page, { stamps: [], count: 0, reason: 'no_stamps_detected' });
  await reachSelection(page);

  await expect(page.getByText(/no stamps were found/i).first()).toBeVisible();
  // The old build invented a 90%x90% box at confidence 0.5 labelled
  // "Detected Stamp (Full Image)".
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});

test('an oversized photo is reported as too large, not as a mystery failure', async ({ page }) => {
  await stubSegment(page, { error: 'too large' }, 413);
  await reachSelection(page);
  await expect(page.getByText(/too large/i).first()).toBeVisible();
});

test('"draw the box myself" gives a real, user-owned box', async ({ page }) => {
  await stubSegment(page, { error: 'nope', reason: 'model_empty_response' }, 502);
  await reachSelection(page);

  await page.getByRole('button', { name: /draw the box myself/i }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  // Honest: the user drew it, so it carries no fabricated confidence score.
  await expect(page.getByText(/1\s*of\s*1 selected/i)).toBeVisible();
});
