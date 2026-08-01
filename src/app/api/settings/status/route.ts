/* ──────────────────────────────────────────────────────────────────────────────
 * GET /api/settings/status
 *
 * Read-only status of which server-side AI/pricing services are actually
 * configured. Returns booleans only — never the key values themselves.
 * ────────────────────────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server';

function isConfigured(value: string | undefined): boolean {
  return !!value && !value.startsWith('your-');
}

export async function GET() {
  return NextResponse.json({
    // Vertex AI needs no stored key — auth is via Application Default
    // Credentials (local) or the deployed service account (production).
    vertexAi: true,
    firecrawl: isConfigured(process.env.FIRECRAWL_API_KEY),
  });
}
