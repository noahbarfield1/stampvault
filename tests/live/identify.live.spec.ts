import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/* ──────────────────────────────────────────────────────────────────────────────
 * The recorded identification run.
 *
 * OPT-IN ONLY — `npm run test:live`. This makes real Vertex AI calls against
 * real fixture photos and costs money, so it is excluded from the default run.
 *
 * This is the honest evidence the project has been missing since 2026-06-22.
 * It cannot pass fraudulently: the 1x1-PNG mock bypass that made the old suite
 * "green" was deleted, so every result here comes from the model.
 *
 * Requires Application Default Credentials: `gcloud auth application-default login`.
 * ────────────────────────────────────────────────────────────────────────────── */

interface Expectation {
  file: string;
  /** What the stamp actually is, for the report. Not asserted strictly. */
  known: string;
  expectCountry: RegExp;
}

const FIXTURES: Expectation[] = [
  { file: 'IMG_4184.jpg', known: 'US 1938 9c Harrison Prexie', expectCountry: /united states|usa/i },
  { file: 'stamp-4.png', known: 'US 1938 9c Harrison Prexie', expectCountry: /united states|usa/i },
  { file: 'stamp-2.png', known: 'US 1938 1c Washington Prexie', expectCountry: /united states|usa/i },
  { file: 'inverted-jenny.jpg', known: 'US 1918 24c Inverted Jenny', expectCountry: /united states|usa/i },
];

const ROUNDS = 3;

interface Row {
  file: string;
  round: number;
  ok: boolean;
  country: string;
  scott: string;
  confidence: number | null;
  ms: number;
  error?: string;
}

const rows: Row[] = [];

test.describe.configure({ mode: 'serial' });

for (const fixture of FIXTURES) {
  for (let round = 1; round <= ROUNDS; round++) {
    test(`identify ${fixture.file} (round ${round})`, async ({ request }) => {
      const abs = path.join(process.cwd(), 'public', 'test-stamps', fixture.file);
      const mime = fixture.file.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const dataUrl = `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`;

      const started = Date.now();
      const res = await request.post('/api/stamps/identify', {
        data: { imageBase64: dataUrl, mimeType: mime },
        timeout: 120_000,
      });
      const ms = Date.now() - started;

      if (!res.ok()) {
        rows.push({
          file: fixture.file, round, ok: false, country: '-', scott: '-',
          confidence: null, ms, error: `HTTP ${res.status()}`,
        });
        expect(res.ok(), `identify failed: HTTP ${res.status()}`).toBe(true);
        return;
      }

      const body = await res.json();
      const ident = body.identification ?? {};
      rows.push({
        file: fixture.file,
        round,
        ok: true,
        country: ident.country ?? '-',
        scott: ident.scottNumber ?? '-',
        confidence: typeof ident.aiConfidence === 'number' ? ident.aiConfidence : null,
        ms,
      });

      // Deliberately loose. The point is to RECORD what the model says, and to
      // catch total failure ("Unknown" everywhere) rather than to pin the model
      // to one answer and make the suite flaky.
      expect(ident.country, 'country').toMatch(fixture.expectCountry);
      expect(ident.aiConfidence ?? 0, 'confidence').toBeGreaterThan(0.4);
    });
  }
}

test.afterAll(() => {
  if (rows.length === 0) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(process.cwd(), 'e2e-reports');
  fs.mkdirSync(dir, { recursive: true });

  const passed = rows.filter((r) => r.ok).length;
  const lines = [
    `# Identification run — ${new Date().toISOString()}`,
    '',
    `Real Vertex AI calls against \`public/test-stamps/\`. ${ROUNDS} rounds per fixture.`,
    '',
    `**${passed} of ${rows.length} returned a result.**`,
    '',
    '| Fixture | Round | Country | Scott | Confidence | Time |',
    '|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.file} | ${r.round} | ${r.country} | ${r.scott} | ${
          r.confidence === null ? '-' : `${Math.round(r.confidence * 100)}%`
        } | ${(r.ms / 1000).toFixed(1)}s |${r.error ? ` ${r.error}` : ''}`,
    ),
    '',
    '## What each fixture actually is',
    '',
    ...FIXTURES.map((f) => `- \`${f.file}\` — ${f.known}`),
  ];

  const out = path.join(dir, `identification-${stamp}.md`);
  fs.writeFileSync(out, lines.join('\n'), 'utf8');
  console.log(`\nRecorded identification report: ${out}`);
});
