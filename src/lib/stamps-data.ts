import type { Stamp } from '@/types/stamp';
import { VERIFIED_STAMPS } from '@/lib/pricing/verified-database';

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
      lastUpdated: new Date().toISOString(),
      hipValue: VERIFIED_STAMPS.find(s => s.id === 'stamp-harrison')!.hipValue,
      sourceBreakdown: VERIFIED_STAMPS.find(s => s.id === 'stamp-harrison')!.sourceBreakdown
    },
    priceHistory: VERIFIED_STAMPS.find(s => s.id === 'stamp-harrison')!.priceHistory,
    notes: VERIFIED_STAMPS.find(s => s.id === 'stamp-harrison')!.notes,
    tags: VERIFIED_STAMPS.find(s => s.id === 'stamp-harrison')!.tags,
    isFavorite: false,
    purchasePrice: 4.00,
    purchaseDate: new Date().toISOString(),
    grade: VERIFIED_STAMPS.find(s => s.id === 'stamp-harrison')!.grade,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
      lastUpdated: new Date().toISOString(),
      hipValue: VERIFIED_STAMPS.find(s => s.id === 'stamp-washington-1c')!.hipValue,
      sourceBreakdown: VERIFIED_STAMPS.find(s => s.id === 'stamp-washington-1c')!.sourceBreakdown
    },
    priceHistory: VERIFIED_STAMPS.find(s => s.id === 'stamp-washington-1c')!.priceHistory,
    notes: VERIFIED_STAMPS.find(s => s.id === 'stamp-washington-1c')!.notes,
    tags: VERIFIED_STAMPS.find(s => s.id === 'stamp-washington-1c')!.tags,
    isFavorite: false,
    purchasePrice: 0.15,
    purchaseDate: new Date().toISOString(),
    grade: VERIFIED_STAMPS.find(s => s.id === 'stamp-washington-1c')!.grade,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
      lastUpdated: new Date().toISOString(),
      hipValue: VERIFIED_STAMPS.find(s => s.id === 'stamp-vanburen-8c')!.hipValue,
      sourceBreakdown: VERIFIED_STAMPS.find(s => s.id === 'stamp-vanburen-8c')!.sourceBreakdown
    },
    priceHistory: VERIFIED_STAMPS.find(s => s.id === 'stamp-vanburen-8c')!.priceHistory,
    notes: VERIFIED_STAMPS.find(s => s.id === 'stamp-vanburen-8c')!.notes,
    tags: VERIFIED_STAMPS.find(s => s.id === 'stamp-vanburen-8c')!.tags,
    isFavorite: false,
    purchasePrice: 0.30,
    purchaseDate: new Date().toISOString(),
    grade: VERIFIED_STAMPS.find(s => s.id === 'stamp-vanburen-8c')!.grade,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
] as any[];
