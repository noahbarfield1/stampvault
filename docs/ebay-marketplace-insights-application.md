# eBay Marketplace Insights API — access request

**Status:** draft, not submitted. Blocked on a Production keyset (see below).

## Why we want it

StampVault prices a collector's stamps. The Browse API — which the app already
uses — returns only *currently listed* items, i.e. what sellers are **asking**.
For philatelic material that is a systematically biased number: unsold stamp
listings sit on eBay for months at aspirational prices, so the asking-price
median runs materially above realised value. The app currently labels these as
asking prices rather than valuations, which is honest but much less useful.

Marketplace Insights (`buy.marketplace.insight`) returns the last 90 days of
**completed sales**, which is the number a collector actually wants.

## Prerequisite — this is what is currently blocking

The application requires a **Production** App ID. As of 2026-08-09 the account
has only a **Sandbox** keyset (`NoahBarf-Stamp-SBX-…`). Sandbox cannot be used:

- Sandbox credentials are rejected by `api.ebay.com` (production host).
- Sandbox inventory is synthetic test data, so any price derived from it is
  fabricated — which this codebase explicitly refuses to ship.

Get the Production keyset first at <https://developer.ebay.com/my/keys>.

## Draft justification text

> StampVault is a personal philatelic collection manager. A collector
> photographs a page of stamps; the app segments and identifies each one, then
> shows what comparable stamps are worth so the collector can value and insure
> their collection.
>
> We currently use the Browse API, but active listings reflect asking prices,
> which for collectible stamps diverge substantially from realised prices. We
> request Marketplace Insights in order to show recent completed-sale prices for
> the identified catalogue number and condition.
>
> Request volume is low and user-driven: one search per stamp the user chooses
> to price, on the order of tens to low hundreds of calls per day. Results are
> displayed to the collector who owns the item, alongside a link to the source
> listing on eBay. We do not redistribute, resell, or aggregate eBay data into a
> competing dataset, and results are cached only briefly to avoid duplicate
> calls for the same stamp.

## Where the code plugs in

The provider seam already accounts for this. `ListingProvider.fetchSold()` in
`src/lib/pricing/providers/types.ts` is the exact shape Insights fills; today
`ebay-provider.ts` returns `[]` from it on purpose, with a comment explaining
that completed sales are a restricted release.

Implementing it means:

1. A new `createEbayInsightsProvider()` requesting the extra OAuth scope
   `https://api.ebay.com/oauth/api_scope/buy.marketplace.insight`.
2. `fetchSold()` hitting `item_sales/search`, mapping `lastSoldPrice` and
   `lastSoldDate` into `MarketListing` with `listingType: 'sold'`.
3. Registry selection in `providers/index.ts`, behind the credential check so an
   unapproved account silently keeps today's behaviour rather than erroring.

The aggregation ladder in `aggregate.ts` already prefers sold over active, so no
change is needed there — sold listings start winning automatically once they
exist.
