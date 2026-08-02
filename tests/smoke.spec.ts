import { test, expect, type Page } from '@playwright/test';

/* Every route renders, on every device size, with no console errors. */

const ROUTES = [
  { path: '/dashboard', heading: 'Dashboard' },
  { path: '/collection', heading: 'Collection' },
  { path: '/upload', heading: 'Upload Stamps' },
  { path: '/prices', heading: /Price/i },
  { path: '/settings', heading: 'Settings' },
  { path: '/assistant', heading: /Assistant/i },
  { path: '/tutorial', heading: 'How it works' },
];

/** Collect console errors, ignoring noise we do not control. */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Firebase is expected to complain when nobody is signed in, and favicon
    // 404s are not a product defect.
    if (/favicon|auth\/|Firebase|net::ERR_/i.test(text)) return;
    errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

for (const route of ROUTES) {
  test(`${route.path} renders cleanly`, async ({ page }) => {
    const errors = watchConsole(page);
    const response = await page.goto(route.path);
    expect(response?.status(), `${route.path} HTTP status`).toBeLessThan(400);

    await expect(
      page.getByRole('heading', { name: route.heading }).first(),
    ).toBeVisible();

    expect(errors, `console errors on ${route.path}`).toEqual([]);
  });
}

test('no horizontal overflow', async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(route.path);
    // Wait for hydration so late-mounting chrome is included.
    await page.waitForTimeout(400);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    // 1px of slack for sub-pixel rounding.
    expect(scrollWidth, `${route.path} overflows horizontally`).toBeLessThanOrEqual(
      clientWidth + 1,
    );
  }
});

test('the viewport allows pinch-zoom and enables safe-area insets', async ({ page }) => {
  await page.goto('/dashboard');
  const content = await page.getAttribute('meta[name="viewport"]', 'content');
  // viewport-fit=cover is what makes every env(safe-area-inset-*) resolve to a
  // real value rather than 0.
  expect(content).toContain('viewport-fit=cover');
  // Blocking zoom fails WCAG 2.1 SC 1.4.4.
  expect(content).not.toContain('user-scalable=no');
  expect(content).not.toContain('maximum-scale=1');
});
