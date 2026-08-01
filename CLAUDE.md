# StampVault — architecture and context

Phone-first philatelic collection manager. Photograph a page of stamps → Gemini
segments it into individual stamps → you pick which to keep → Gemini identifies
each → Firecrawl scrapes real eBay listings for pricing.

**The design goal is that nothing on screen is invented.** Several rounds of
work have gone into removing fabricated data; if you are adding a feature and
find yourself writing a plausible-looking fallback, don't. Show the failure.

## Stack

Next.js 16.2.9 (App Router, Turbopack) · React 19 · TypeScript · Zustand
(+persist) · CSS Modules (**not** Tailwind) · framer-motion + GSAP · Recharts.

Design tokens live in `src/styles/variables.css`. Note the scale is small:
`--text-xs` 11px, `--text-sm` 13px, `--text-base` 15px.

## Running it

```bash
npm run dev                      # http://localhost:3000
npm run build && npm run start   # production build — run this before shipping
```

Local AI needs Application Default Credentials once:
`gcloud auth application-default login`. See `.env.local.example`.

## Deployment — read this before touching git

**The Vercel project has no git integration.** Every deploy is a manual
`vercel --prod` from this directory. Consequently git and production can drift
silently, and for a week in July production was running code that existed only
in this working tree — 19 modified files and 11 untracked paths.

Practical consequences:
- Always check `git status` before any destructive git verb here.
- Pushing to GitHub does **not** deploy. Deploying is a separate deliberate act.

## Layout of the interesting parts

| Path | What it is |
|---|---|
| `src/app/upload/page.tsx` | The capture → select → identify → save wizard. |
| `src/components/upload/select/` | The selection screen: canvas, boxes, gestures. |
| `src/lib/upload/` | Non-React upload logic: image pipeline, API clients, stamp assembly. |
| `src/lib/segmentation/normalize.ts` | Coordinate normalization. **Read its header before changing anything about boxes.** |
| `src/lib/pricing/` | Firecrawl provider, markdown parser, aggregation ladder. |
| `src/store/uploadSession.ts` | Upload state, persisted to sessionStorage. |
| `src/store/ui.ts` | Chrome, toasts, tour, page chrome, dismissed hints. |
| `src/store/stamps.ts` | The collection, persisted to localStorage. |

## Things that will bite you

- **Segmentation coordinates.** Gemini emits `box_2d` in a 0-1000 space, not
  percentages. Normalize *before* clamping — clamping first collapses every box
  to zero width, which silently returns "no stamps found". This was a real bug.
- **Upload payload size.** Vercel hard-caps serverless request bodies at 4.5MB.
  A 12MP phone photo base64s past that, so images are downscaled client-side in
  `src/lib/upload/image-pipeline.ts`. `next.config.ts`'s `bodySizeLimit` applies
  only to Server Actions and does **not** help route handlers.
- **localStorage quota.** The collection persists to localStorage and Safari
  caps it near 5MB, so full-resolution crops must never be stored twice. Save
  goes through `makeThumbnail`.
- **`touch-action`.** The selection canvas and `ZoomableImage` set it from
  state. Setting it to `none` unconditionally traps page scroll and makes the
  app feel frozen.
- **CSS Modules hash class names**, so a global stylesheet cannot target them.
  Shared rules live in `src/styles/touch.css` and are pulled in per module with
  `composes: touchTarget from global`.

## Verification

```bash
npx tsc --noEmit                             # the project's release gate
node src/lib/segmentation/normalize.check.mjs # 21 coordinate tests
node src/lib/pricing/aggregate.check.mjs      # 12 pricing tests
npx eslint src tests
```

There is no browser test harness yet. `docs/verification/` holds the surviving
evidence from the old hand-rolled runner, including the 2026-07-03
identification failure that was never re-verified.
