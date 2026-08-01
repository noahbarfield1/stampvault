/* ──────────────────────────────────────────────────────────────────────────────
 * Segmentation response normalization
 *
 * Extracted from the /api/stamps/segment route so it can be unit-tested without
 * a network call or a Vertex credential.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * The original route asked Gemini for percentage coordinates (0-100) and then
 * clamped with `Math.min(100, ...)`. Gemini 2.x emits normalized 0-1000 box
 * coordinates natively, and did so intermittently regardless of the prompt.
 * Because the clamp ran BEFORE any normalization, every 0-1000 box collapsed to
 * {100,100,100,100}, which has zero width, which then failed the minimum-size
 * filter — so the route returned `{stamps: [], count: 0}` with HTTP 200 and the
 * client could not distinguish "no stamps in this photo" from "the coordinates
 * were silently destroyed". That is the most likely root cause of the 24
 * misidentification bugs archived under docs/verification/.
 *
 * The order of operations below is load-bearing: detect space -> scale ->
 * order-correct -> clamp -> filter. Any other order reintroduces the bug.
 * ────────────────────────────────────────────────────────────────────────────── */

/** Which coordinate space the model replied in. Reported back for observability. */
export type CoordSpace = 'normalized_1000' | 'percent';

/** A bounding box in percentage-of-image space, which is what the UI consumes. */
export interface PercentBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface NormalizedDetection {
  boundingBox: PercentBox;
  description: string;
  confidence: number;
}

export interface NormalizeResult {
  stamps: NormalizedDetection[];
  coordSpace: CoordSpace;
  /** Detections understood but rejected as too small. Surfaced for debugging. */
  droppedCount: number;
}

/** Boxes smaller than this in either dimension are noise, not stamps. */
export const MIN_BOX_PERCENT = 2;

/** Hard ceiling so a runaway response cannot flood the client with boxes. */
export const MAX_DETECTIONS = 60;

/** Used when the model omits `confidence` — see rule 5 below. */
export const DEFAULT_CONFIDENCE = 0.5;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** A detection in Gemini's documented `box_2d` form: [ymin, xmin, ymax, xmax], 0-1000. */
function readBox2d(raw: Record<string, unknown>): PercentBox | null {
  const b = raw.box_2d;
  if (!Array.isArray(b) || b.length !== 4 || !b.every(isFiniteNumber)) return null;
  const [ymin, xmin, ymax, xmax] = b as number[];
  // box_2d is ALWAYS 0-1000 by definition, so it never goes through heuristic
  // space detection — that is the whole point of asking for this shape.
  return { x1: xmin / 10, y1: ymin / 10, x2: xmax / 10, y2: ymax / 10 };
}

/** The legacy `boundingBox: {x1,y1,x2,y2}` shape, whose space is ambiguous. */
function readLegacyBox(raw: Record<string, unknown>): PercentBox | null {
  const b = raw.boundingBox as Record<string, unknown> | undefined;
  if (!b) return null;
  const { x1, y1, x2, y2 } = b;
  if (![x1, y1, x2, y2].every(isFiniteNumber)) return null;
  return { x1: x1 as number, y1: y1 as number, x2: x2 as number, y2: y2 as number };
}

function readDescription(raw: Record<string, unknown>): string {
  // The new prompt asks for `label`; the old one asked for `description`.
  const v = raw.label ?? raw.description;
  return typeof v === 'string' && v.trim() ? v.trim() : 'Unidentified stamp';
}

function readConfidence(raw: Record<string, unknown>): number {
  // Rule 5: a missing confidence must NOT drop the detection. The old filter
  // required `typeof confidence === 'number' && confidence > 0`, and the model
  // omits the field often enough that this silently deleted real stamps.
  const v = raw.confidence;
  return isFiniteNumber(v) ? clamp(v, 0, 1) : DEFAULT_CONFIDENCE;
}

/**
 * Turn a parsed Gemini segmentation response into percentage-space detections.
 *
 * Accepts either coordinate convention and either detection shape. Never throws
 * on malformed input — returns an empty result instead, so the caller can
 * distinguish "understood, found nothing" from a transport/parse failure.
 */
export function normalizeDetections(raw: unknown): NormalizeResult {
  if (!Array.isArray(raw)) {
    return { stamps: [], coordSpace: 'percent', droppedCount: 0 };
  }

  // Step 1 — read every detection into an unscaled box, remembering whether it
  // came from box_2d (space already known) or the ambiguous legacy shape.
  const read = raw
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
    .map((d) => {
      const explicit = readBox2d(d);
      return {
        box: explicit ?? readLegacyBox(d),
        // box_2d has been divided by 10 already; legacy has not been touched.
        alreadyPercent: explicit !== null,
        description: readDescription(d),
        confidence: readConfidence(d),
      };
    })
    .filter((d): d is typeof d & { box: PercentBox } => d.box !== null);

  // Step 2 — detect the coordinate space ACROSS THE WHOLE RESPONSE, not per box.
  // Per-box detection would misclassify a single small stamp whose coordinates
  // all happen to be under 100. Per-response only fails if every stamp on the
  // page sits inside the top-left 10% of the image, which cannot happen.
  const ambiguous = read.filter((d) => !d.alreadyPercent);
  const maxCoord = ambiguous.reduce(
    (m, d) => Math.max(m, d.box.x1, d.box.y1, d.box.x2, d.box.y2),
    0,
  );
  const legacyIsThousand = maxCoord > 100;
  const coordSpace: CoordSpace =
    legacyIsThousand || (ambiguous.length === 0 && read.length > 0)
      ? 'normalized_1000'
      : 'percent';

  let dropped = 0;

  const stamps = read
    .map((d) => {
      // Step 3 — scale into percentage space.
      const s = !d.alreadyPercent && legacyIsThousand ? 10 : 1;
      let { x1, y1, x2, y2 } = d.box;
      x1 /= s;
      y1 /= s;
      x2 /= s;
      y2 /= s;

      // Step 4 — order-correct rather than discard. Gemini reverses min/max
      // intermittently; the old filter deleted those detections outright.
      const box: PercentBox = {
        x1: Math.min(x1, x2),
        y1: Math.min(y1, y2),
        x2: Math.max(x1, x2),
        y2: Math.max(y1, y2),
      };

      // Step 5 — clamp only now that everything is genuinely in 0-100 space.
      return {
        boundingBox: {
          x1: clamp(box.x1, 0, 100),
          y1: clamp(box.y1, 0, 100),
          x2: clamp(box.x2, 0, 100),
          y2: clamp(box.y2, 0, 100),
        },
        description: d.description,
        confidence: d.confidence,
      };
    })
    .filter((d) => {
      // Step 6 — reject noise. A full-frame 100x100 box is legitimate: it is
      // what a photo of a single stamp should produce.
      const w = d.boundingBox.x2 - d.boundingBox.x1;
      const h = d.boundingBox.y2 - d.boundingBox.y1;
      const keep = w >= MIN_BOX_PERCENT && h >= MIN_BOX_PERCENT;
      if (!keep) dropped++;
      return keep;
    })
    .slice(0, MAX_DETECTIONS);

  return { stamps, coordSpace, droppedCount: dropped };
}

/**
 * Parse the model's raw text into JSON, tolerating a ```json fence.
 *
 * With `responseSchema` set this should never need the fence fallback, but the
 * model can still return prose on a refusal, so this reports failure explicitly
 * rather than collapsing to `[]` — collapsing is what made a hard failure look
 * like "no stamps found".
 */
export function parseSegmentationText(
  text: string,
): { ok: true; value: unknown } | { ok: false } {
  const attempt = (s: string) => {
    try {
      return { ok: true as const, value: JSON.parse(s) };
    } catch {
      return null;
    }
  };

  const direct = attempt(text.trim());
  if (direct) return direct;

  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) {
    const inner = attempt(fenced[1].trim());
    if (inner) return inner;
  }

  return { ok: false };
}
