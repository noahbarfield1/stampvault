/* ──────────────────────────────────────────────────────────────────────────────
 * POST /api/pricing/refresh
 *
 * Force-refresh prices for a single stamp or all stamps in collection.
 * Updates Firestore cache and price history.
 * ────────────────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

interface RefreshRequestBody {
  stampId?: string;
  all?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RefreshRequestBody;

    if (!body.stampId && !body.all) {
      return NextResponse.json(
        { error: 'Either stampId or all:true is required' },
        { status: 400 },
      );
    }

    // Dynamic imports to avoid loading Firebase Admin at module scope
    const { refreshPrice, refreshAllPrices } = await import(
      '@/lib/pricing/engine'
    );

    // ── Single stamp refresh ──────────────────────────────────────────────
    if (body.stampId && !body.all) {
      const priceData = await refreshPrice(body.stampId);
      return NextResponse.json({
        success: true,
        stampId: body.stampId,
        pricing: priceData,
      });
    }

    // ── Batch refresh all stamps ──────────────────────────────────────────
    if (body.all) {
      const { getFirestore } = await import('firebase-admin/firestore');
      const db = getFirestore();

      // Fetch all stamp IDs from Firestore
      const snapshot = await db.collection('stamps').select().get();
      const stampIds = snapshot.docs.map((doc) => doc.id);

      if (stampIds.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No stamps in collection to refresh',
          refreshed: 0,
          failed: 0,
        });
      }

      const results = await refreshAllPrices(stampIds);

      const refreshed = results.size;
      const failed = stampIds.length - refreshed;

      // Build a summary of updated prices
      const summary: Record<string, number> = {};
      for (const [id, priceData] of results.entries()) {
        summary[id] = priceData.estimatedValue;
      }

      return NextResponse.json({
        success: true,
        totalStamps: stampIds.length,
        refreshed,
        failed,
        summary,
      });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('[API /pricing/refresh] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Price refresh failed';

    // Handle specific Firestore errors
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
