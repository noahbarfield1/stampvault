import type { Stamp } from '@/types/stamp';
import { VERIFIED_STAMPS } from '@/lib/pricing/verified-database';

/**
 * These timestamps were previously `new Date().toISOString()` evaluated at
 * MODULE LOAD, so the app claimed these stamps were bought and added today —
 * every day, forever — and "Recent Uploads" was always "today". A fixed date is
 * the honest value for seeded records, and purchaseDate is null because nobody
 * recorded one.
 */
const SEEDED_AT = '2026-06-21T00:00:00.000Z';


export const initialStamps: Stamp[] = [
  {
    id: 'stamp-user-001',
    userId: 'user-001',
    imageUrl: '/test-stamps/stamp-4.png',
    thumbnailUrl: '/test-stamps/stamp-4.png',
    identification: {
      ...VERIFIED_STAMPS.find(s => s.id === 'stamp-harrison')!,
      confidence: 0.95,
      status: 'identified'
    },
    pricing: {
      estimatedValue: VERIFIED_STAMPS.find(s => s.id === 'stamp-harrison')!.estimatedValue,
      currency: 'USD',
      confidence: 0.9,
      sources: VERIFIED_STAMPS.find(s => s.id === 'stamp-harrison')!.sources.map(s => ({...s, condition: 'unknown'})),
      priceRange: VERIFIED_STAMPS.find(s => s.id === 'stamp-harrison')!.priceRange,
      lastUpdated: SEEDED_AT,
      hipValue: VERIFIED_STAMPS.find(s => s.id === 'stamp-harrison')!.hipValue,
      sourceBreakdown: VERIFIED_STAMPS.find(s => s.id === 'stamp-harrison')!.sourceBreakdown
    },
    priceHistory: VERIFIED_STAMPS.find(s => s.id === 'stamp-harrison')!.priceHistory,
    notes: VERIFIED_STAMPS.find(s => s.id === 'stamp-harrison')!.notes,
    tags: VERIFIED_STAMPS.find(s => s.id === 'stamp-harrison')!.tags,
    isFavorite: false,
    purchasePrice: 4.00,
    purchaseDate: null,
    grade: VERIFIED_STAMPS.find(s => s.id === 'stamp-harrison')!.grade,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT
  },
  {
    id: 'stamp-user-004',
    userId: 'user-001',
    imageUrl: '/test-stamps/stamp-2.png',
    thumbnailUrl: '/test-stamps/stamp-2.png',
    identification: {
      ...VERIFIED_STAMPS.find(s => s.id === 'stamp-washington-1c')!,
      confidence: 0.9,
      status: 'identified'
    },
    pricing: {
      estimatedValue: VERIFIED_STAMPS.find(s => s.id === 'stamp-washington-1c')!.estimatedValue,
      currency: 'USD',
      confidence: 0.85,
      sources: VERIFIED_STAMPS.find(s => s.id === 'stamp-washington-1c')!.sources.map(s => ({...s, condition: 'unknown'})),
      priceRange: VERIFIED_STAMPS.find(s => s.id === 'stamp-washington-1c')!.priceRange,
      lastUpdated: SEEDED_AT,
      hipValue: VERIFIED_STAMPS.find(s => s.id === 'stamp-washington-1c')!.hipValue,
      sourceBreakdown: VERIFIED_STAMPS.find(s => s.id === 'stamp-washington-1c')!.sourceBreakdown
    },
    priceHistory: VERIFIED_STAMPS.find(s => s.id === 'stamp-washington-1c')!.priceHistory,
    notes: VERIFIED_STAMPS.find(s => s.id === 'stamp-washington-1c')!.notes,
    tags: VERIFIED_STAMPS.find(s => s.id === 'stamp-washington-1c')!.tags,
    isFavorite: false,
    purchasePrice: 0.15,
    purchaseDate: null,
    grade: VERIFIED_STAMPS.find(s => s.id === 'stamp-washington-1c')!.grade,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT
  },
  {
    id: 'stamp-user-005',
    userId: 'user-001',
    imageUrl: '/test-stamps/stamp-3.png',
    thumbnailUrl: '/test-stamps/stamp-3.png',
    identification: {
      ...VERIFIED_STAMPS.find(s => s.id === 'stamp-vanburen-8c')!,
      confidence: 0.94,
      status: 'identified'
    },
    pricing: {
      estimatedValue: VERIFIED_STAMPS.find(s => s.id === 'stamp-vanburen-8c')!.estimatedValue,
      currency: 'USD',
      confidence: 0.8,
      sources: VERIFIED_STAMPS.find(s => s.id === 'stamp-vanburen-8c')!.sources.map(s => ({...s, condition: 'unknown'})),
      priceRange: VERIFIED_STAMPS.find(s => s.id === 'stamp-vanburen-8c')!.priceRange,
      lastUpdated: SEEDED_AT,
      hipValue: VERIFIED_STAMPS.find(s => s.id === 'stamp-vanburen-8c')!.hipValue,
      sourceBreakdown: VERIFIED_STAMPS.find(s => s.id === 'stamp-vanburen-8c')!.sourceBreakdown
    },
    priceHistory: VERIFIED_STAMPS.find(s => s.id === 'stamp-vanburen-8c')!.priceHistory,
    notes: VERIFIED_STAMPS.find(s => s.id === 'stamp-vanburen-8c')!.notes,
    tags: VERIFIED_STAMPS.find(s => s.id === 'stamp-vanburen-8c')!.tags,
    isFavorite: false,
    purchasePrice: 0.30,
    purchaseDate: null,
    grade: VERIFIED_STAMPS.find(s => s.id === 'stamp-vanburen-8c')!.grade,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT
  }
] as any[];
