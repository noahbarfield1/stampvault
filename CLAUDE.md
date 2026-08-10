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

## Cloud sync

Optional and off until the owner signs in. The app is fully usable without it.

- **Auth**: Firebase Auth, Google only. Popup on desktop, redirect on touch
  (mobile Safari blocks popups). `src/lib/firebase/auth.ts`.
- **Shape**: `users/{uid}/stamps/{id}` holds metadata + a ~20KB thumbnail;
  `users/{uid}/stamps/{id}/media/full` holds the full crop. Splitting them keeps
  listing the collection cheap on cellular and against the free tier's read
  budget — the detail page fetches the full image lazily.
- **Not Firebase Storage.** Storage needs the Blaze plan to provision a bucket
  and this project is on Spark with no bucket, so images live in Firestore
  documents (1 MiB cap; a 1024px crop is 80-200KB). If the project is ever
  upgraded, moving `media/full` to Storage is an isolated change to
  `src/lib/sync/collection-sync.ts`.
- **Model**: offline-first. localStorage stays the immediate source of truth so
  the UI never waits on the network; Firestore is the durable mirror. Conflicts
  resolve last-write-wins on `updatedAt`.
- **Deletes are asymmetric on purpose.** The merge treats "missing on one side"
  as not-yet-synced, never as a delete. Only an explicit `removeStamp` deletes
  remotely. Silently wiping a collection because a device had stale state would
  be unforgivable.
- **Rules**: `firestore.rules` is scoped to `request.auth.uid` with a
  default-deny catch-all. It previously shipped as
  `allow read, write: if true` — the entire database was world-readable and
  world-writable to anyone who knew the project id.

### One-time console setup

This section previously said authentication had never been enabled. That is no
longer true, and the stale note cost real debugging time. Verified 2026-08-09
against the Identity Toolkit admin API:

- Google sign-in: `enabled: true`
- Authorized domains: `localhost`, `perduestampvault-db.firebaseapp.com`,
  `perduestampvault-db.web.app`, **`stampvault-inky.vercel.app`**

Cloud sync is configured end to end; it only needs the user to sign in.

Re-check with this rather than trusting the file:

```bash
curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "x-goog-user-project: perduestampvault-db" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/perduestampvault-db/config"
```

## Durable price cache

`priceCache/{country}_{scott}_{condition}` in Firestore. Every successful live
lookup is remembered and becomes the fallback next time that stamp is priced —
`verified-database.ts` is only 13 hand-authored stamps and cannot be grown by
hand, since Scott catalogue values are copyrighted.

Server-only, via `firebase-admin` and `FIREBASE_SERVICE_ACCOUNT_JSON` (set on
Vercel production and in `.env.local`). `firestore.rules` denies clients both
read and write on `priceCache/**`: writes because a browser that could write
there could poison every collector's fallback price, reads because the pricing
route is what applies the freshness check and relabels the entry as a dated
observation rather than a live one.

Only catalogued stamps are cached — without a Scott number the eBay query is
fuzzy and would serve one stamp's price for another's — and only genuine live
tiers are stored, so "we found nothing today" never hardens into a durable
claim about the stamp.

Verified in production 2026-08-09: a lookup wrote `united-states_245_used`, and
a subsequent lookup returned `provider: price-cache`, `tier: cached`.
