# E2E Test Infra: StampVault

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|---------------------|:------:|:------:|:------:|:------:|
| 1 | Real Stamp Injection | ORIGINAL_REQUEST §R1 | 5      | 5      | ✓      | ✓      |
| 2 | Side-by-Side Comparison UI | ORIGINAL_REQUEST §R2 | 5      | 5      | ✓      | ✓      |
| 3 | Confidence Meter Component | ORIGINAL_REQUEST §R3 | 5      | 5      | ✓      | ✓      |
| 4 | Working AI Pipeline | ORIGINAL_REQUEST §R4 | 5      | 5      | ✓      | ✓      |
| 5 | Zero Visual Errors & Layout | ORIGINAL_REQUEST §R5 | 5      | 5      | ✓      | ✓      |

## Test Architecture
- **Test Runner**: Node.js script executing the E2E verification suite (`node tests/run-e2e.js`).
- **Pass/Fail Semantics**: The script exits with code 0 on success, and code 1 with detailed failure logs on any assertion failure.
- **Test Case Format**: Individual automated assertions checking project build status, API routing responses, file structural checks, and stylesheet checks.
- **Directory Layout**:
  - `tests/run-e2e.js`: The central test runner and execution script.
  - `tests/cases/`: Folder holding organized test assertions.
  - `tests/fixtures/`: Image assets and files for testing.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | The Collector's Vault Walkthrough | F1, F2, F4, F5 | High |
| 2 | The High-Value Assessment | F1, F2, F3, F4 | Medium |
| 3 | The Common Stamp Precancel Check | F1, F3, F4 | Medium |
| 4 | Price Refresh & Sync | F4 | Medium |
| 5 | AI Chat Philatelic Consultation | F4, F5 | Medium |

## Coverage Thresholds
- Tier 1: ≥5 per feature (Total: 25 tests)
- Tier 2: ≥5 per feature (Total: 25 tests)
- Tier 3: pairwise coverage of major feature interactions (Total: 5 tests)
- Tier 4: ≥5 realistic application scenarios (Total: 5 tests)
- **Total Minimum: 60 test cases**

---

## Detailed Test Cases

### Tier 1 - Feature Coverage

#### Feature 1: Real Stamp Injection (R1)
- **T1.1**: Verify `/upload` page loads correctly.
- **T1.2**: Verify the presence of the upload dropzone container.
- **T1.3**: Verify selecting `inverted-jenny.jpg` bypasses mock list and injects Jenny catalog keywords.
- **T1.4**: Verify the upload queue renders the uploaded stamp image thumbnail.
- **T1.5**: Verify the page proceeds to segmentation/detection step after upload.

#### Feature 2: Side-by-Side Comparison UI (R2)
- **T2.1**: Verify side-by-side comparison container exists on the upload summary step.
- **T2.2**: Verify "Uploaded Crop" image is rendered in the comparison container.
- **T2.3**: Verify "Catalog Reference" image is rendered in the comparison container.
- **T2.4**: Verify side-by-side image columns are aligned horizontally.
- **T2.5**: Verify correct reference image is loaded for each injected stamp.

#### Feature 3: Confidence Meter Component (R3)
- **T3.1**: Verify the `ConfidenceMeter` component renders on the summary page.
- **T3.2**: Verify the `ConfidenceMeter` component renders on the details page.
- **T3.3**: Verify `ConfidenceMeter` displays correct percentage value.
- **T3.4**: Verify `ConfidenceMeter` visual progress bar width reflects the confidence score.
- **T3.5**: Verify `ConfidenceMeter` applies high confidence styling (glowing border/bar) for >= 80%.

#### Feature 4: Working AI Pricing Pipeline (R4)
- **T4.1**: Verify server endpoint `/api/stamps/segment` returns correct JSON structure.
- **T4.2**: Verify server endpoint `/api/stamps/identify` returns correct metadata.
- **T4.3**: Verify `/api/pricing/lookup` returns estimated value and pricing sources.
- **T4.4**: Verify the frontend summary page displays estimated pricing and pricing range.
- **T4.5**: Verify the details page displays verified sources pills and pricing.

#### Feature 5: Zero Visual Errors & Layout (R5)
- **T5.1**: Verify `/dashboard` loads without console errors.
- **T5.2**: Verify `/prices` loads without console errors.
- **T5.3**: Verify `/collection` loads without console errors.
- **T5.4**: Verify `/assistant` loads without console errors.
- **T5.5**: Verify `/settings` loads without console errors.

---

### Tier 2 - Boundary & Corner Cases

#### Feature 1: Real Stamp Injection (R1)
- **T1.6**: Verify upload queue rejects or handles invalid file types gracefully.
- **T1.7**: Verify upload queue handles empty files list.
- **T1.8**: Verify upload queue handles large images without crashing.
- **T1.9**: Verify upload queue handles filenames with special characters.
- **T1.10**: Verify upload queue handles duplicate uploads of the same stamp.

#### Feature 2: Side-by-Side Comparison UI (R2)
- **T2.6**: Verify comparison handles missing reference image gracefully (renders placeholder).
- **T2.7**: Verify comparison handles missing uploaded image gracefully (renders placeholder).
- **T2.8**: Verify comparison aligns correctly with extremely tall or wide reference images.
- **T2.9**: Verify comparison aligns correctly when description text is extremely long.
- **T2.10**: Verify comparison layout handles multiple stamps in the summary list.

#### Feature 3: Confidence Meter Component (R3)
- **T3.6**: Verify `ConfidenceMeter` handles 0% confidence correctly.
- **T3.7**: Verify `ConfidenceMeter` handles 100% confidence correctly.
- **T3.8**: Verify `ConfidenceMeter` handles null or undefined confidence values gracefully.
- **T3.9**: Verify `ConfidenceMeter` applies medium styling for confidence between 60% and 80%.
- **T3.10**: Verify `ConfidenceMeter` applies low styling for confidence below 60%.

#### Feature 4: Working AI Pricing Pipeline (R4)
- **T4.6**: Verify AI pipeline handles unknown stamp lookup by returning low confidence and fallback estimates.
- **T4.7**: Verify pricing lookup handles empty source lists gracefully.
- **T4.8**: Verify pricing pipeline handles outlier values correctly (IQR filtering).
- **T4.9**: Verify pricing engine calculations when some sources have null values.
- **T4.10**: Verify price history data structure handles single data point correctly.

#### Feature 5: Zero Visual Errors & Layout (R5)
- **T5.6**: Verify no horizontal overflow on mobile viewports (< 640px) for `/dashboard`.
- **T5.7**: Verify no horizontal overflow on mobile viewports (< 640px) for `/upload`.
- **T5.8**: Verify no horizontal overflow on mobile viewports (< 640px) for `/collection`.
- **T5.9**: Verify no horizontal overflow on mobile viewports (< 640px) for `/prices`.
- **T5.10**: Verify high-contrast readability (wcag AA contrast check) for gold text on dark background.

---

### Tier 3 - Cross-Feature Combinations
- **T3.11**: End-to-end flow of uploading Jenny stamp, verifying matching confidence >= 95%, checking side-by-side images, and asserting estimated price of $350k matches verified database.
- **T3.12**: Uploading an unverified/unknown stamp, confirming bounding box, checking that confidence is low, and verifying fallback estimation is displayed.
- **T3.13**: Uploading both Jenny and Harrison stamps, reviewing both, checking that both display their respective reference images and correct confidence levels side-by-side, and verifying their total estimated value is summed correctly in the header.
- **T3.14**: Saving an identified stamp to collection, navigating to collection list, clicking the stamp to view details, and verifying the `ConfidenceMeter` and pricing history chart render correctly.
- **T3.15**: Performing the full upload, segmentation, review, and complete steps under mobile viewport settings, verifying no overflow occurs at any stage.

---

### Tier 4 - Real-World Application Scenarios
- **T4.11 (The Collector's Vault Walkthrough)**: A user uploads a scanned album page containing multiple stamps (using the test stamp image), confirms the segmented boundaries, filters out one rejected stamp, identifies the others, reviews the pricing details, and saves the set.
- **T4.12 (The High-Value Assessment)**: A user uploads the Treskilling Yellow stamp, verifies that the AI matches it at 0.99 confidence with reference image, displays the $2.3M estimated value from the verified database, and checks historical appreciation trend.
- **T4.13 (The Common Stamp Precancel Check)**: A user uploads the Harrison 9c stamp (with precancel), verifies that the AI identifies the precancel, matches it to Scott #814, displays its common rarity status and low estimated price, and verifies it saves to the collection.
- **T4.14 (Price Refresh & Sync)**: A user views a saved stamp in their collection, clicks the "Refresh Prices" button, triggers the backend lookup to search eBay/HipStamp APIs, recalculates the weighted value, and updates the UI.
- **T4.15 (AI Chat Philatelic Consultation)**: A user opens the AI Assistant panel, asks questions about a saved stamp, and receives streaming chat responses incorporating the stamp's reference number and value details.
