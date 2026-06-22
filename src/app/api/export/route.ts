/* ──────────────────────────────────────────────────────────────────────────────
 * GET /api/export
 *
 * Export the user's stamp collection as CSV or JSON.
 * Supports filtering by format (csv/json), and returns the file with
 * appropriate Content-Type and Content-Disposition headers for download.
 * ────────────────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';
import type { Stamp } from '@/types/stamp';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/* ─── CSV Helpers ────────────────────────────────────────────────────── */

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function stampsToCSV(stamps: Stamp[]): string {
  const headers = [
    'ID',
    'Country',
    'Year',
    'Denomination',
    'Scott Number',
    'Michel Number',
    'Description',
    'Condition',
    'Rarity',
    'Color',
    'Perforation',
    'Watermark',
    'Series',
    'Estimated Value (USD)',
    'Price Range Min',
    'Price Range Max',
    'Confidence',
    'Tags',
    'Notes',
    'Is Favorite',
    'Purchase Price',
    'Purchase Date',
    'Grade',
    'Image URL',
    'Created At',
    'Updated At',
  ];

  const rows = stamps.map((stamp) => [
    escapeCSV(stamp.id),
    escapeCSV(stamp.identification?.country),
    escapeCSV(stamp.identification?.year),
    escapeCSV(stamp.identification?.denomination),
    escapeCSV(stamp.identification?.scottNumber),
    escapeCSV(stamp.identification?.michelNumber),
    escapeCSV(stamp.identification?.description),
    escapeCSV(stamp.identification?.condition),
    escapeCSV(stamp.identification?.rarity),
    escapeCSV(stamp.identification?.color),
    escapeCSV(stamp.identification?.perforation),
    escapeCSV(stamp.identification?.watermark),
    escapeCSV(stamp.identification?.series),
    escapeCSV(stamp.pricing?.estimatedValue),
    escapeCSV(stamp.pricing?.priceRange?.min),
    escapeCSV(stamp.pricing?.priceRange?.max),
    escapeCSV(stamp.pricing?.confidence),
    escapeCSV(stamp.tags?.join('; ')),
    escapeCSV(stamp.notes),
    escapeCSV(stamp.isFavorite),
    escapeCSV(stamp.purchasePrice),
    escapeCSV(stamp.purchaseDate),
    escapeCSV(stamp.grade),
    escapeCSV(stamp.imageUrl),
    escapeCSV(stamp.createdAt),
    escapeCSV(stamp.updatedAt),
  ]);

  const csvLines = [headers.map(escapeCSV).join(',')];
  for (const row of rows) {
    csvLines.push(row.join(','));
  }

  return csvLines.join('\n');
}

/* ─── JSON Export ────────────────────────────────────────────────────── */

interface ExportStamp {
  id: string;
  identification: {
    country: string | undefined;
    year: number | null | undefined;
    denomination: string | null | undefined;
    scottNumber: string | null | undefined;
    michelNumber: string | null | undefined;
    description: string | undefined;
    condition: string | undefined;
    rarity: string | undefined;
    color: string | null | undefined;
    perforation: string | null | undefined;
    watermark: string | null | undefined;
    series: string | null | undefined;
  };
  pricing: {
    estimatedValue: number | undefined;
    currency: string | undefined;
    confidence: number | undefined;
    priceRange: { min: number; max: number } | undefined;
    lastUpdated: string | undefined;
  } | null;
  metadata: {
    tags: string[];
    notes: string;
    isFavorite: boolean;
    purchasePrice: number | null;
    purchaseDate: string | null;
    grade: number | null;
  };
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
}

function stampsToExportJSON(stamps: Stamp[]): ExportStamp[] {
  return stamps.map((stamp) => ({
    id: stamp.id,
    identification: {
      country: stamp.identification?.country,
      year: stamp.identification?.year,
      denomination: stamp.identification?.denomination,
      scottNumber: stamp.identification?.scottNumber,
      michelNumber: stamp.identification?.michelNumber,
      description: stamp.identification?.description,
      condition: stamp.identification?.condition,
      rarity: stamp.identification?.rarity,
      color: stamp.identification?.color,
      perforation: stamp.identification?.perforation,
      watermark: stamp.identification?.watermark,
      series: stamp.identification?.series,
    },
    pricing: stamp.pricing
      ? {
          estimatedValue: stamp.pricing.estimatedValue,
          currency: stamp.pricing.currency,
          confidence: stamp.pricing.confidence,
          priceRange: stamp.pricing.priceRange,
          lastUpdated: stamp.pricing.lastUpdated,
        }
      : null,
    metadata: {
      tags: stamp.tags || [],
      notes: stamp.notes || '',
      isFavorite: stamp.isFavorite || false,
      purchasePrice: stamp.purchasePrice,
      purchaseDate: stamp.purchaseDate,
      grade: stamp.grade,
    },
    imageUrl: stamp.imageUrl,
    createdAt: stamp.createdAt,
    updatedAt: stamp.updatedAt,
  }));
}

/* ─── Handler ────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';
    const limitParam = searchParams.get('limit');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortDir = (searchParams.get('sortDir') || 'desc') as 'asc' | 'desc';

    if (format !== 'json' && format !== 'csv') {
      return NextResponse.json(
        { error: 'format must be "json" or "csv"' },
        { status: 400 },
      );
    }

    // Fetch stamps from Firestore
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();

    let query: FirebaseFirestore.Query = db.collection('stamps');

    // Apply sorting
    const validSortFields = [
      'createdAt',
      'updatedAt',
      'identification.country',
      'identification.year',
    ];
    if (validSortFields.includes(sortBy)) {
      query = query.orderBy(sortBy, sortDir);
    } else {
      query = query.orderBy('createdAt', 'desc');
    }

    // Apply limit
    if (limitParam) {
      const limit = Math.min(parseInt(limitParam, 10), 10000);
      if (!isNaN(limit) && limit > 0) {
        query = query.limit(limit);
      }
    }

    const snapshot = await query.get();
    const stamps: Stamp[] = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Stamp,
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (format === 'csv') {
      const csv = stampsToCSV(stamps);
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="stampvault-collection-${timestamp}.csv"`,
          'Cache-Control': 'no-cache',
        },
      });
    }

    // JSON format
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalStamps: stamps.length,
      format: 'StampVault Collection Export v1',
      stamps: stampsToExportJSON(stamps),
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    return new Response(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="stampvault-collection-${timestamp}.json"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[API /export] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
