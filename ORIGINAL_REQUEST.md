# Original User Request

## Initial Request — 2026-06-22T00:23:40Z

# Teamwork Project Prompt — Draft

> Status: Ready for launch — awaiting user approval.
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Implement 5 core visual pages for the StampVault application populated with real imported stamp data, featuring side-by-side comparisons, confidence meters, and working AI pricing pipelines.

Working directory: `C:\Users\noahb\.gemini\antigravity\scratch\stampvault`
Integrity mode: development

**DESIGN SYSTEM (REQUIRED):**
- Platform: Web, Mobile-first responsive
- Theme: Dark, cyber-glassmorphism
- Background: Deep Dark (`#0a0a0f`) with subtle AnimatedBackground mesh gradients
- Primary Accent: Gold (`#d4a574` to `#f5c842`)
- Surface: Glassmorphic (`rgba(255, 255, 255, 0.03)`) with blur
- Ensure strict adherence to existing `variables.css` tokens for typography and spacing.

## Requirements

### R1. Real Stamp Injection
Inject the 5 real stamp images recently added to `public/test-stamps/` (e.g., `stamp 4.png`, `IMG_4184.heic`, etc.) into the AI Upload Pipeline, bypassing mock data.

### R2. Side-by-Side Comparison UI
Implement a side-by-side visual comparison in the Review/Approval page, showing the user's uploaded image next to the verified reference image from the database.

### R3. Confidence Meter Component
Build a `ConfidenceMeter` UI component that visually displays the AI's identification confidence percentage using a glowing/progress bar aesthetic.

### R4. Working AI Pipeline
Connect the frontend approval flow to the `src/lib/ai/gemini.ts` backend so that the pages display real imported statistics, pricing, and historical information.

### R5. Zero Visual Errors
All 5 generated pages must strictly adhere to mobile viewport constraints (no horizontal overflow) and pass high-contrast legibility checks.

## Acceptance Criteria

### Functionality & Integration
- [ ] The `public/test-stamps/` images are successfully rendered in the upload queue.
- [ ] The `ConfidenceMeter` component is visible and dynamically reflects the AI's confidence score.
- [ ] The side-by-side comparison UI correctly aligns the uploaded image against the reference image.

### Quality & Verification
- [ ] The project successfully compiles without TypeScript errors (`npx tsc --noEmit`).
- [ ] The `browser` subagent takes screenshots of the 5 pages and verifies no horizontal overflow exists.

## Follow-up — 2026-06-22T00:55:23Z

The server was restarted. Please revive your processes, resume finalizing R4 (Working AI Pipeline), perform the visual QA for R5, and report back when the final build is complete.
