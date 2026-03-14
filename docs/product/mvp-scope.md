# MVP Scope

## Priority order

The MVP follows this workflow priority:

1. Store discovery and trust signals
2. Purchase and item tracking
3. Pre-order payment tracking (paid vs remaining)
4. Shipment tracking (including split shipments)
5. Dashboard clarity (status, upcoming payments, totals)

## In scope

- Collector workspace layout for private routes
- Dashboard-first private navigation
- Page-level search inside the relevant modules when needed
- Store discovery by category
- Public store profiles with search by name and filters for category, country, and presence
- Public store moderation-aware publishing (`PENDING` vs `APPROVED`)
- `PENDING` stores are visible in in-app listing/search and show a caution disclaimer in the store detail page
- Public store details resolve on `/store/[slug]` (legacy `/stores/[slug]` redirects)
- Store trust indicators (reviews/feedback)
- Store reports, category requests, and approved-store change requests
- Purchase tracking with item-level detail
- Pre-order partial payment tracking and upcoming payments by month
- Shipment tracking with support for split shipments
- Dashboard with key statuses and payment totals

## Out of scope (later phases)

- Global search in the private app header
- Sidebar mini stats and gamification surfaces
- Full collection management
- Wishlist management
- Advanced analytics and automation-heavy features

## MVP success signals

- Users can understand order/payment/shipment status in seconds
- Upcoming balances are visible and predictable
- Fewer missed follow-ups on delayed or silent shipments
- Clear trust context before buying from a store
- Public store profiles feel searchable, understandable, and trustworthy enough to support future purchase workflows
- Users can understand the private app structure and reach the main workflow areas immediately after sign-in
