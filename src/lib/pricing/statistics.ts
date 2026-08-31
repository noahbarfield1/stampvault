/* ─── Robust statistics for price comparables ─────────────────────────
 *  Split out of aggregate.ts because the quantile arithmetic there had a
 *  defect that is invisible unless you write the numbers out.
 *
 *  ── The n=4 hole ────────────────────────────────────────────────────
 *  The old code picked quartiles by nearest rank:
 *
 *      q1 = sorted[Math.floor(len * 0.25)]
 *      q3 = sorted[Math.floor(len * 0.75)]
 *
 *  At n=4 that makes q3 = sorted[3] — the MAXIMUM. The upper fence is
 *  q3 + 1.5·iqr, which is therefore always ≥ the largest value, so the
 *  largest value can never be rejected. The filter was structurally
 *  incapable of doing the one job it existed for.
 *
 *  Worse in combination: `removeOutliersIQR` no-ops below n=4 and
 *  MIN_ACTIVE_SAMPLE was 3, so the entire range 3 ≤ n ≤ 4 — the common case
 *  once the relevance filter has discarded most results — ran with no
 *  outlier protection at all. One $79,950 block of six in a set of four
 *  set the price.
 *
 *  Linear interpolation between order statistics (the "type 7" definition
 *  used by NumPy and R by default) puts q3 strictly inside the data for
 *  every n ≥ 2, which closes it.
 *
 *  n < 4 still returns the input untouched, and that is honest rather than
 *  lazy: three points cannot tell you which of them is anomalous. That gap
 *  is closed by the catalogue cross-check, which works at n=1, not by
 *  pretending the quartiles mean something.
 * ──────────────────────────────────────────────────────────────────── */

/** Ascending copy. Every function here assumes sorted input. */
export function sortedCopy(nums: number[]): number[] {
  return [...nums].sort((a, b) => a - b);
}

/**
 * The p-quantile (0 ≤ p ≤ 1) of an ASCENDING array, interpolating linearly
 * between the two nearest order statistics.
 *
 * This is R/NumPy's default ("type 7"). The property that matters here is
 * that for n ≥ 2 the result of `quantile(xs, 0.75)` lies strictly below the
 * maximum unless every value above the 75th percentile is identical — which
 * is exactly what the nearest-rank version got wrong.
 */
export function quantile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0];

  const pos = (n - 1) * Math.min(Math.max(p, 0), 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export interface Fences {
  q1: number;
  q3: number;
  iqr: number;
  lower: number;
  upper: number;
}

/** Tukey fences at 1.5·IQR. Input must be sorted ascending. */
export function iqrFences(sorted: number[]): Fences {
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  return { q1, q3, iqr, lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
}

/**
 * The interquartile span — the middle 50% of the data.
 *
 * This is what the UI should show as a "range". The old code reported
 * min/max of whatever survived the outlier filter, but surviving the fences
 * is a very weak constraint: on eBay asking prices the survivors still
 * routinely span two orders of magnitude, which is the "range is far too
 * wide" complaint in one sentence.
 *
 * Below n=4 there are not enough points for quartiles to mean anything, so
 * the caller gets the full span and a basis of 'full' to label it honestly.
 */
export function trimmedRange(nums: number[]): {
  min: number;
  max: number;
  basis: 'iqr' | 'full' | 'none';
} {
  if (nums.length === 0) return { min: 0, max: 0, basis: 'none' };

  const sorted = sortedCopy(nums);
  if (sorted.length < 4) {
    return { min: sorted[0], max: sorted[sorted.length - 1], basis: 'full' };
  }

  const { q1, q3 } = iqrFences(sorted);
  return { min: q1, max: q3, basis: 'iqr' };
}

/**
 * A robust coefficient of variation: the interquartile spread as a fraction
 * of the median.
 *
 * Used to make confidence respond to how much the comparables actually
 * agree. Twelve listings clustered between $1.90 and $2.10 and twelve
 * spanning $0.99 to $79,950 both reported a flat 0.6 before this existed.
 *
 * Returns 0 for a degenerate input (fewer than 2 points, or a non-positive
 * median) — "no measurable disagreement" rather than a divide-by-zero.
 */
export function robustCV(nums: number[]): number {
  if (nums.length < 2) return 0;

  const sorted = sortedCopy(nums);
  const mid = median(sorted);
  if (mid <= 0) return 0;

  const { q1, q3 } = iqrFences(sorted);
  return (q3 - q1) / (2 * mid);
}

/** Median of a set of numbers. Returns 0 for an empty input. */
export function median(nums: number[]): number {
  if (nums.length === 0) return 0;

  const sorted = sortedCopy(nums);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Drop values outside the Tukey fences.
 *
 * Same name and signature as the version that used to live in aggregate.ts,
 * so every existing caller and test is unaffected — only the quartile
 * arithmetic underneath changed.
 */
export function removeOutliersIQR(nums: number[]): number[] {
  if (nums.length < 4) return nums;

  const sorted = sortedCopy(nums);
  const { lower, upper } = iqrFences(sorted);
  return sorted.filter((n) => n >= lower && n <= upper);
}
