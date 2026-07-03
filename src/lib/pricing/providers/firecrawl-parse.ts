/* ─── eBay Search-Results Markdown Parser ────────────────────────────
 *  Parses a Firecrawl markdown capture of an eBay `/sch/i.html` search
 *  page (sold or active) into normalized MarketListing records.
 *
 *  Each real result card is anchored by an image link wrapped in an
 *  item link:
 *    [![<title>](https://i.ebayimg.com/.../s-l500.webp)](https://www.ebay.com/itm/<id>?...)
 *  followed by (optionally) a "Sold <Mon> <D>, <YYYY>" line, a title
 *  link, and a "$<price>" line.
 *
 *  Sponsored house-ad filler ("Shop on eBay") uses a different image
 *  host (ir.ebaystatic.com) and store banners link to stores.ebay.com
 *  instead of /itm/<id> — both are excluded by construction since the
 *  anchor regex requires both the i.ebayimg.com image host AND an
 *  ebay.com/itm/<id> link.
 * ──────────────────────────────────────────────────────────────────── */

import type { MarketListing } from './types';

/** Anchors a single result card: image-linked-to-item markdown. */
const CARD_ANCHOR_RE =
  /\[!\[([^\]]*)\]\((https:\/\/i\.ebayimg\.com[^)]+)\)\]\((https:\/\/(?:www\.)?ebay\.com\/itm\/(\d+)[^)]*)\)/g;

/** e.g. "Sold Jun 17, 2026" */
const SOLD_DATE_RE = /Sold\s+([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})/;

/** e.g. "$1,234.56" — requires cents so it doesn't match stray "$" text. */
const PRICE_RE = /\$([\d,]+\.\d{2})/;

/** The plain-text title link that follows the image anchor, e.g. "[Title](https://www.ebay.com/itm/123...)" */
const TITLE_LINK_RE = /^\[([^\]]+)\]\(https:\/\/(?:www\.)?ebay\.com\/itm\/\d+/m;

interface CardAnchor {
  index: number;
  length: number;
  alt: string;
  imageUrl: string;
  itemId: string;
}

function findAnchors(markdown: string): CardAnchor[] {
  const anchors: CardAnchor[] = [];
  const re = new RegExp(CARD_ANCHOR_RE.source, CARD_ANCHOR_RE.flags);
  let match: RegExpExecArray | null;

  while ((match = re.exec(markdown)) !== null) {
    anchors.push({
      index: match.index,
      length: match[0].length,
      alt: match[1].trim(),
      imageUrl: match[2],
      itemId: match[4],
    });
  }

  return anchors;
}

function parsePrice(raw: string): number | null {
  const value = Number.parseFloat(raw.replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Parses "Sold Jun 17, 2026" style text into an ISO `YYYY-MM-DD` date, or null if absent/unparseable. */
function parseSoldDate(cardText: string): string | null {
  const match = SOLD_DATE_RE.exec(cardText);
  if (!match) return null;

  const [, month, day, year] = match;
  // Deterministic: parsed entirely from the matched text, not "now".
  const parsed = new Date(`${month} ${day}, ${year}`);
  if (Number.isNaN(parsed.getTime())) return null;

  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${parsed.getFullYear()}-${mm}-${dd}`;
}

/**
 * Parses eBay search-results markdown (as returned by Firecrawl) into
 * normalized MarketListing records.
 *
 * @param markdown     Raw markdown from a Firecrawl scrape of an eBay
 *                      `/sch/i.html` search page.
 * @param listingType   Whether this page was a sold-search or an
 *                      active-listing search (tags every returned record).
 */
export function parseEbayListings(
  markdown: string,
  listingType: 'sold' | 'active'
): MarketListing[] {
  if (!markdown) return [];

  const anchors = findAnchors(markdown);
  const listings: MarketListing[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    if (seenIds.has(anchor.itemId)) continue;

    const sliceStart = anchor.index + anchor.length;
    const sliceEnd = i + 1 < anchors.length ? anchors[i + 1].index : markdown.length;
    const cardText = markdown.slice(sliceStart, sliceEnd);

    const priceMatch = PRICE_RE.exec(cardText);
    if (!priceMatch) continue; // no parseable price — skip the card
    const price = parsePrice(priceMatch[1]);
    if (price === null) continue;

    const titleMatch = TITLE_LINK_RE.exec(cardText);
    const title = (titleMatch?.[1] ?? anchor.alt).trim();
    if (!title) continue;

    seenIds.add(anchor.itemId);
    listings.push({
      platform: 'ebay',
      listingType,
      price,
      currency: 'USD',
      soldDate: parseSoldDate(cardText),
      url: `https://www.ebay.com/itm/${anchor.itemId}`,
      imageUrl: anchor.imageUrl,
      title,
    });
  }

  return listings;
}
