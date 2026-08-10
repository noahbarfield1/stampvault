import { defineConfig, devices } from '@playwright/test';

/* ──────────────────────────────────────────────────────────────────────────────
 * Playwright config.
 *
 * ── Against a PRODUCTION build, not `next dev` ────────────────────────────────
 * The two hand-rolled runners this replaces both tested `next dev`, which never
 * exercises what Vercel actually serves — which is how "no production build has
 * ever been run in this tree" went unnoticed for months.
 *
 * ── Chromium only ────────────────────────────────────────────────────────────
 * Only chromium-1234 is present in the local browser cache. Adding firefox or
 * webkit projects would force a ~150MB download on every fresh checkout for
 * very little extra signal on an app that targets mobile Safari and Chrome
 * through emulation anyway.
 *
 * ── Serial ───────────────────────────────────────────────────────────────────
 * `workers: 1`. The AI routes are rate-limited and cost real money per call, so
 * parallel workers would multiply spend and trip limits.
 * ────────────────────────────────────────────────────────────────────────────── */

const PORT = 3210;
const BASE_URL = `http://localhost:${PORT}`;

/* ── The live-ai opt-in ───────────────────────────────────────────────────────
 * `testIgnore: ['**\/live\/**']` above is per-project-overridable, and the
 * live-ai project has to override it or `--project=live-ai` would select zero
 * tests. The side effect was that a bare `playwright test` — i.e. `npm test` —
 * ran the live project too, spending 12 real Vertex AI calls on every run.
 *
 * So the project is only *defined* when it was explicitly asked for. Selecting
 * a project Playwright doesn't know about is a hard error, which is the right
 * outcome: it fails loudly instead of silently billing.
 * ──────────────────────────────────────────────────────────────────────────── */
/*
 * Sniffing argv looks like it works and does not: Playwright re-evaluates this
 * config inside each WORKER process, whose argv does not carry `--project`. The
 * main process therefore defined `live-ai` while the worker did not, and the
 * run died with "Project live-ai not found in the worker process" before
 * spending a cent — so `npm run test:live` was broken outright.
 *
 * Environment IS inherited by workers, so the flag is set here, in the main
 * process, before the projects array is built. Both entry points then agree:
 *
 *     npm run test:live
 *     PLAYWRIGHT_LIVE=1 npx playwright test --project=live-ai
 */
const liveArgv = process.argv.some((arg) => arg === 'live-ai' || arg.endsWith('=live-ai'));
if (liveArgv) process.env.PLAYWRIGHT_LIVE = '1';
const liveRequested = process.env.PLAYWRIGHT_LIVE === '1';

export default defineConfig({
  testDir: './tests',
  // `tests/live/` hits the real AI and costs money — opt in with --project=live-ai.
  testIgnore: ['**/live/**'],
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e-reports/playwright', open: 'never' }],
    ['json', { outputFile: 'e2e-reports/last-run.json' }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      // 360px is the width the one historical Lighthouse run never tested, and
      // where the layout is tightest.
      name: 'narrow-360',
      use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } },
    },
    { name: 'pixel-5', use: { ...devices['Pixel 5'] } },
    {
      // Short viewport: the case where a modal's footer used to end up
      // off-screen with no way to scroll to it.
      name: 'iphone-se',
      use: { ...devices['iPhone SE'], browserName: 'chromium' },
    },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    // Real AI calls, and real money. Only exists when explicitly requested —
    // see `liveRequested` above.
    ...(liveRequested
      ? [
          {
            name: 'live-ai',
            testDir: './tests/live',
            testIgnore: [] as string[],
            timeout: 180_000,
            use: { ...devices['Desktop Chrome'] },
          },
        ]
      : []),
  ],

  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `${BASE_URL}/dashboard`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'ignore',
    stderr: 'pipe',
    // Exposes the upload-session store so a test can reach the review screen
    // without spending real AI calls. NEXT_PUBLIC_* is inlined at build time,
    // so this must be set for the BUILD, not just the server — and a normal
    // `vercel --prod` build, which never sets it, drops the block entirely.
    env: { ...process.env, NEXT_PUBLIC_E2E_HOOKS: '1' } as Record<string, string>,
  },
});
