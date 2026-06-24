# StampVault - Session Handoff & Architecture Context

## Current Project State
StampVault is a Next.js (App Router) application designed to serve as a digital philatelic collection manager. It uses a custom AI pipeline (Gemini 1.5 Flash/Pro) for visual stamp identification, cropping, and pricing estimates. 

We have just completed a major architectural refactor to connect the frontend UI with live, verified data, and we upgraded the AI identifier to use a **Few-Shot RAG (Retrieval-Augmented Generation)** approach.

## Recent Changes & Upgrades

### 1. Database Wiring & Real-World Pricing (`mockData.ts` & `verified-database.ts`)
- Previously, the app used randomly generated placeholder stamps with inflated values (e.g., millions of dollars).
- We have completely rewired the `useStampsStore` initial data state (`src/lib/mockData.ts`) to exclusively load the user's 5 authentic stamp uploads (US Presidential Series "Prexies").
- The Dashboard stats, total collection value (now realistically ~$14.00), and the Live Price Tracker charts are now dynamically aggregated from these 5 verified records.

### 2. Few-Shot RAG AI Integration (`src/app/api/stamps/identify/route.ts`)
- Re-architected the `IDENTIFICATION_PROMPT` to act as a **catalog matching engine**.
- We stringify and inject the entire `VERIFIED_STAMPS` database directly into the Gemini prompt context.
- Gemini is instructed to cross-reference the uploaded stamp with the `VERIFIED_STAMPS` database. If a confident match is found, it extracts the exact `matchedCatalogId` and `referenceImageUrl` from the database.

### 3. Side-by-Side Visual Verification UI (`src/app/collection/[id]/page.tsx`)
- Updated the individual stamp detail page to implement a side-by-side comparison view.
- When `stamp.identification.referenceImageUrl` is available, the UI renders the user's uploaded stamp directly adjacent to the high-resolution Catalog Reference image. Both images utilize the `ZoomableImage` component for deep inspection.

## Verification & Release Status
1. **TypeScript Verification:** Success (`npx tsc --noEmit` returns 0 warnings/errors).
2. **Duplicate Mock Cleanup:** Completed. The mock database (`src/lib/mockData.ts`) is cleaned up, containing only the user's 3 primary authentic stamp uploads (William Henry Harrison 9¢, George Washington 1¢, Martin Van Buren 8¢).
3. **Prices Page Bug:** Hydration error resolved and build verified successfully.
4. **Local Dev Server:** Running successfully on [http://localhost:3001](http://localhost:3001).
5. **Vercel Deploy:** Live at [https://stampvault-inky.vercel.app](https://stampvault-inky.vercel.app).
