/* ─── Listing relevance filter ────────────────────────────────────────
 *  eBay keyword search is fuzzy: asking for "United States Scott 814"
 *  inside the Stamps category still returns mostly *other* stamps. A live
 *  production lookup on 2026-08-02 measured 42% of returned listings
 *  actually mentioning 814 — so the median was being computed over a
 *  majority of the wrong stamp.
 *
 *  This filter keeps only listings whose title carries the catalogue
 *  number, which is what a seller writes when they are selling that
 *  stamp. It is deliberately conservative:
 *
 *    - With no catalogue number to match on, nothing is filtered. There is
 *      no reliable signal, and guessing would be worse than not trying.
 *    - When the filter matches nothing, it returns an EMPTY list rather
 *      than falling back to the unfiltered set. Pricing a stamp from
 *      listings for different stamps is precisely the fabrication this
 *      project exists to avoid; the aggregator's lower tiers already
 *      handle "no market data" honestly.
 * ──────────────────────────────────────────────────────────────────── */

import type { MarketListing, StampQuery } from './providers/types';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches the catalogue number as a standalone token, optionally preceded
 * by `#`.
 *
 * The trailing guard rejects a following `-<digit>` or `/<digit>`, with or
 * without spaces. That covers two distinct problems at once:
 *
 *   - Manufacturer part numbers — `Thorogood 814-4200` (work boots) and
 *     `+GF+ 159 001 814 / 3-2841-1V` (a conductivity electrode) were both
 *     quoted as the value of Scott 814 in production. A plain word boundary
 *     accepts both, because `-` and ` ` are non-word characters.
 *   - Ranges and multi-stamp lots — `Scott 814-816 set`. A set sells for
 *     several times a single stamp, so counting one as a comparable drags
 *     the median up.
 */
export function catalogNumberPattern(scottNumber: string): RegExp {
  const n = escapeRegExp(scottNumber.trim());
  return new RegExp(
    // Not glued to a preceding word character…
    `(?<![0-9A-Za-z])` +
      // …and not the far end of a range: `C3-C3a` is a two-stamp listing, and
      // only the characters *before* the match distinguish it from a C3a one.
      `(?<![0-9A-Za-z][-/])` +
      `#?\\s?${n}` +
      // Not a prefix of a longer token (`8140`, `1814`).
      `(?![0-9A-Za-z])` +
      // Not the near end of a range or a part number. Digit-only on purpose:
      // `814-816` and `814 / 3-2841` are rejected, while the very common
      // `Scott 814 - Mint NH` title format is kept.
      `(?!\\s?[-/]\\s?\\d)`,
    'i'
  );
}

/**
 * Multi-stamp lots priced as one item.
 *
 * A title naming three or more different catalogue numbers — a real one was
 * `Scott Catalog #808, 809, 810,813 & 814 MNH` at $2.00 — is selling a group,
 * so its price says nothing about any single stamp in it. Worse, that listing
 * was picked as the *proof* link, so the app offered a five-stamp lot as
 * evidence of one stamp's value.
 *
 * The signal is an enumerated RUN of numbers — comma- or ampersand-separated —
 * not a raw count of numbers in the title. Simply counting was tried first and
 * over-filtered immediately: `Scott# 814 9c Harrison Used Stamp Pair 1938-43`
 * contains four number-ish tokens (814, 9c, 1938, 43) and is a perfectly good
 * single-stamp comparable. Denominations and years are numbers too.
 *
 * The threshold is three rather than two on purpose. Plate blocks, pairs and
 * se-tenant listings legitimately name a second number while still being one
 * collectible item; three enumerated numbers is where it is unambiguously a lot.
 */
const ENUMERATED_RUN = /\d{1,4}[a-z]?(?:\s*[,&]\s*(?:and\s*)?#?\s*\d{1,4}[a-z]?){2,}/i;

/**
 * The philatelic range notation: `230//245` means "230 through 245, not all
 * inclusive" — a run of stamps sold together, never a single item.
 *
 * Only `//` counts. A single slash appears in unrelated seller shorthand, and a
 * hyphen range is already handled by catalogNumberPattern, which rejects
 * `814-816` while keeping the very common `Scott 814 - Mint NH` title form.
 */
const SLASH_RANGE = /\d{1,4}[a-z]?\s*\/\/\s*\d{1,4}[a-z]?/i;

/**
 * An explicit quantity claim: "Lot of 25", "lots of 5".
 *
 * Requires a following number so that prose like "a lot of nice centering"
 * does not match. Guarding on the preceding word is not enough — sellers write
 * "Lot of" mid-title as often as at the start.
 */
const EXPLICIT_LOT = /\blots?\s+of\s+\d+/i;

export function looksLikeMultiStampLot(title: string): boolean {
  return ENUMERATED_RUN.test(title) || SLASH_RANGE.test(title) || EXPLICIT_LOT.test(title);
}

/**
 * Replicas, reproductions and decor sold under a real stamp's catalogue number.
 *
 * Found by pricing Scott C3a — the Inverted Jenny — against live eBay data. A
 * genuine C3a sells at auction for roughly $1.5M, and essentially none are ever
 * listed, so every "comparable" eBay returns is a souvenir:
 *
 *   $4.99    US Scott #C3a 1918 24C "Inverted Jenny" Replica Stamp Block
 *   $34.99   Stamp Plak - Inverted Jenny - MINI - SCOTT C3A - WITH STAND
 *   $149.95  US Scott C3-C3a Inverted Jenny Air Mail Framed Wall Decor
 *
 * The app reported $34.99 as the stamp's value. Dropping these usually empties
 * the list, which is the correct outcome: the aggregator then falls to the
 * catalogue tier and labels it as such, instead of pricing a rarity from
 * refrigerator magnets.
 */
const NOT_THE_STAMP =
  /\b(replica|reproduction|repro|facsimile|forgery|counterfeit|fake|poster|wall\s*decor|framed|plaque|plak|magnet|sticker|keychain|letter\s*opener|souvenir\s*card|mouse\s*pad|coaster|t-?shirt|mug|novelty|ornament|tie\s*tack|lapel\s*pin)\b/i;

export function isNotTheActualStamp(title: string): boolean {
  return NOT_THE_STAMP.test(title);
}

/* ─── Condition ───────────────────────────────────────────────────────────
 *  Condition drives most of a stamp's value — routinely 10-100x between mint
 *  and used on anything scarce — and it was being collected and then thrown
 *  away. `condition` reached the query object and was used by nothing: not the
 *  search phrase, not the filter, not the aggregator.
 *
 *  It hides on cheap stamps. Measured on Scott 814, where the app was asked
 *  for `used`: mint comparables median $1.76, used $1.99. Indistinguishable —
 *  because a common Prexie is ~$2 either way. On a stamp where the two
 *  diverge, the same code silently averages them into a meaningless number.
 * ──────────────────────────────────────────────────────────────────────── */

export type ListingCondition = 'mint' | 'used' | 'unknown';

// `\bused\b` deliberately does not fire inside "unused" — there is no word
// boundary between "un" and "used".
const USED_SIGNAL = /\b(used|cancell?ed|cancel|postally|postmark|cto)\b/i;
const MINT_SIGNAL =
  /\b(mint|mnh|nh|og|unused|never\s*hinged|lightly\s*hinged|hinged|original\s*gum)\b/i;

/**
 * What condition a seller's title claims.
 *
 * Titles naming both ("mint ... used") are `unknown` rather than guessed at —
 * they are usually mixed lots or comparisons, and picking one would be
 * inventing a fact about someone else's listing.
 */
export function classifyListingCondition(title: string): ListingCondition {
  const mint = MINT_SIGNAL.test(title);
  const used = USED_SIGNAL.test(title);
  if (mint && used) return 'unknown';
  if (mint) return 'mint';
  if (used) return 'used';
  return 'unknown';
}

/** Collapse the app's nine-value StampCondition onto what a title can express. */
export function normalizeQueryCondition(condition: string | null | undefined): ListingCondition {
  if (!condition) return 'unknown';
  switch (condition.trim().toLowerCase()) {
    case 'mint':
    case 'mint_nh':
    case 'unused':
      return 'mint';
    case 'used':
      return 'used';
    // fine / very_fine / superb / poor are grades, not mint-vs-used, and say
    // nothing about which side of that divide the stamp sits on.
    default:
      return 'unknown';
  }
}

export interface ConditionSplit {
  /** Comparables to price from. */
  listings: MarketListing[];
  /** True when these are restricted to the requested condition. */
  matched: boolean;
  /** Suffix for the price tier label, so the UI states what was compared. */
  label: string | null;
}

/**
 * Prefer comparables in the requested condition, but never at the cost of
 * having no market at all.
 *
 * With enough same-condition listings, price from those alone. Below the
 * threshold, fall back to every condition and SAY SO — a labelled
 * mixed-condition number is more useful than nothing, but the user has to
 * know that is what they are looking at.
 */
export function splitByCondition(
  listings: MarketListing[],
  condition: string | null | undefined,
  minSample: number
): ConditionSplit {
  const want = normalizeQueryCondition(condition);
  if (want === 'unknown') {
    return { listings, matched: false, label: null };
  }

  const matching = listings.filter((l) => classifyListingCondition(l.title ?? '') === want);
  if (matching.length >= minSample) {
    return { listings: matching, matched: true, label: want };
  }

  return {
    listings,
    matched: false,
    label: listings.length > 0 ? 'mixed condition' : null,
  };
}

export interface RelevanceResult {
  listings: MarketListing[];
  /** How many were discarded as the wrong stamp — surfaced for logging. */
  droppedCount: number;
  /** False when no catalogue number was available to match against. */
  filtered: boolean;
}

export function filterRelevantListings(
  listings: MarketListing[],
  query: StampQuery
): RelevanceResult {
  const scott = query.scottNumber?.trim();
  if (!scott) {
    return { listings, droppedCount: 0, filtered: false };
  }

  const pattern = catalogNumberPattern(scott);
  const kept = listings.filter((l) => {
    const title = l.title ?? '';
    return (
      pattern.test(title) && !looksLikeMultiStampLot(title) && !isNotTheActualStamp(title)
    );
  });

  return {
    listings: kept,
    droppedCount: listings.length - kept.length,
    filtered: true,
  };
}
