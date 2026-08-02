import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/* ──────────────────────────────────────────────────────────────────────────────
 * Accessibility and touch ergonomics.
 *
 * The one historical Lighthouse run (2026-06-22, 412px) reported 26
 * colour-contrast violations and never measured tap targets below 412px or on
 * /upload, which has the most interactive surface in the app.
 * ────────────────────────────────────────────────────────────────────────────── */

/*
 * Animations are disabled for these runs. Framer-motion entrance transitions
 * briefly hold ancestors near opacity 0, and axe composites that into the
 * measured colour — producing phantom contrast failures that disappear once
 * the animation finishes. Verified: 18 violations at 800ms, 0 at 3s.
 * Reduced motion is emulated globally from playwright.config.ts.
 */
const ROUTES = ['/dashboard', '/collection', '/prices', '/upload', '/tutorial', '/settings'];

for (const route of ROUTES) {
  test(`${route} has no colour-contrast or heading-order violations`, async ({ page }) => {
    await page.goto(route);
    // A fixed settle beats waiting on opacity: several elements are
    // INTENTIONALLY translucent (deselected boxes at 0.55, disabled buttons,
    // the background grain at 0.03), so 'everything reaches opacity 1' never
    // becomes true. 2s covers the entrance stagger — verified clean at 1.5s.
    await page.waitForTimeout(2000);

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast', 'heading-order'])
      .analyze();

    const detail = results.violations.flatMap((v) =>
      v.nodes.slice(0, 4).map((n) => `${v.id}: ${n.target.join(' ')} — ${n.failureSummary?.split('\n')[0]}`),
    );
    expect(detail, `axe violations on ${route}`).toEqual([]);
  });
}

test('/upload is operable by keyboard and labels its controls', async ({ page }) => {
  await page.goto('/upload');
  const results = await new AxeBuilder({ page })
    .withRules(['button-name', 'link-name', 'label', 'aria-allowed-attr', 'aria-required-attr'])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test('interactive controls are big enough for a thumb', async ({ page }, testInfo) => {
  // Desktop uses a mouse; this rule is about touch.
  test.skip(testInfo.project.name === 'desktop', 'touch ergonomics only');

  const offenders: string[] = [];
  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForTimeout(500);
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll('button, a, input[type=checkbox], select')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        // Anything a finger must hit should clear ~24px in both axes; this is
        // Lighthouse's target-size floor, and well under our 44px intent.
        if (r.width < 24 || r.height < 24) {
          const name = (el.getAttribute('aria-label') || el.textContent || el.tagName)
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 30);
          out.push(`${Math.round(r.width)}x${Math.round(r.height)} "${name}"`);
        }
      }
      return out;
    });
    offenders.push(...bad.map((b) => `${route} ${b}`));
  }
  expect(offenders, 'controls under 24x24 CSS px').toEqual([]);
});

test('form controls are at least 16px so iOS does not zoom on focus', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop', 'iOS behaviour');
  await page.goto('/settings');
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('input, select, textarea')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && parseFloat(getComputedStyle(el).fontSize) < 16;
      })
      .map((el) => `${el.tagName} ${parseFloat(getComputedStyle(el).fontSize)}px`),
  );
  // Under 16px, mobile Safari zooms the viewport on focus and never zooms back.
  expect(small).toEqual([]);
});
