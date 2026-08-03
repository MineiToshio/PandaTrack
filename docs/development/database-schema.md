# Database schema – purpose and usage

Reference for what each table and attribute is for, where it is used, and why it matters. For field types and constraints, see `prisma/schema.prisma`.

---

## Auth and user

### `user`

**Purpose:** Identity for anyone using the app. Used by auth, store ownership, reviews, notes, reports, and orders.

- **id** – Stable identifier; referenced by sessions, accounts, stores, orders, reviews, notes, reports.
- **name** – Display name in the app.
- **email** – Login identifier; unique. After a successful credential email change in settings, this is updated immediately to the new address while `emailVerified` is set false until the user completes the verification link.
- **emailVerified** – Whether the email was verified (affects trust / flows that require verification).
- **unverifiedGraceStartsAt** – Optional anchor for the credential 7-day verification grace window. Set to “now” on immediate email change so re-verification gets a fresh window; cleared when the user verifies. If null, grace is counted from `createdAt`.
- **image** – Profile picture URL when provided by the provider or user.
- **username** – Shell-facing handle, stored in canonical lowercase form and enforced unique. Assigned automatically on signup with collision-safe generation.
- **usernameChangedAt** – Timestamp of the last successful username change from settings; drives the 7-day username-change rate limit (separate from email-change limits).
- **preferredCountryCode** – Optional FK to `country` for saved collector country preference (settings).
- **baseCurrencyCode** – Optional ISO 4217 code from the curated collector currency list aligned with seeded countries.
- **budgetAmount** – Optional positive budget cap in the user’s base currency. Stored as an integer, so there are no fractional subunits.
- **budgetResetDayOfMonth** – Optional calendar day `1–31` for budget reset; **null** means the last day of each month (months with fewer days clamp to the last day).
- **timezone** – Optional IANA zone name for budget period boundaries; missing timezone falls back to UTC in evaluation logic.
- **aiMonthlyPhotoLimit** – Optional per-user override of the monthly AI-photo bag, set by an administrator from the moderation console and audited. **null** means the product default applies; administrators are uncapped regardless of this column.
- **createdAt / updatedAt** – Audit and ordering.

### `session`

**Purpose:** Keeps the user logged in. One row per active session; used to validate requests and revoke access.

- **id** – Session identifier.
- **expiresAt** – When the session becomes invalid; used to clean up and reject expired tokens.
- **token** – Value sent by the client to authenticate; unique.
- **ipAddress / userAgent** – Optional; useful for security and support (e.g. detect suspicious logins).
- **userId** – Which user this session belongs to.

### `account`

**Purpose:** Links the user to an external provider (OAuth or credentials). One user can have several accounts (e.g. Google + GitHub).

- **accountId / providerId** – Identify the account at the provider. For the `credential` provider, `accountId` is kept aligned with `User.email` when the collector changes email in settings so email/password sign-in stays consistent.
- **userId** – Owner of this account.
- **accessToken / refreshToken / idToken** – Used to call the provider API or refresh the session; optional when not needed.
- **accessTokenExpiresAt / refreshTokenExpiresAt** – When to refresh or re-auth.
- **scope** – Granted scopes at the provider.
- **password** – Only used when the provider is credentials (email/password); hashed.

### `verification`

**Purpose:** Short-lived tokens for email verification, password reset, or similar flows. Lookup by identifier + value; expire after use or by time.

- **identifier** – What is being verified (e.g. email).
- **value** – Token or code sent to the user.
- **expiresAt** – After this, the token is no longer valid.

---

## Catalog

### `country`

**Purpose:** Stable list of countries. Used for store country, addresses, import countries, and optional user country preference. Labels come from i18n (e.g. `countries.PE`), not from the DB.

- **code** – Primary key; ISO 3166-1 alpha-2 code (e.g. ES, PE). Seeded by `prisma/seed.ts`; see `docs/development/store-catalogs.md` for stable identifiers and usage.

---

## Stores (core)

### `store`

**Purpose:** Main entity: a place or seller where collectors buy. Holds identity, moderation state, visibility, and aggregated trust (rating, review count). Used by discovery, profile, orders, deliveries, reviews, notes, reports, and change requests.

- **id** – Unique identifier (cuid).
- **slug** – URL-safe, stable identifier for public routes (`/store/[slug]`; legacy `/stores/[slug]` redirects). Not changed when the name changes.
- **name / description** – Public-facing identity; description can be empty.
- **searchName** – Diacritic-stripped, lowercased, punctuation-collapsed copy of `name` (`normalizeStoreName`), indexed. Lets duplicate detection pre-filter in SQL with `contains` on normalized terms instead of scanning every store; written on create and on any name edit. See `docs/development/store-duplicate-detection.md`.
- **logoUrl** – Logo for business stores; person stores do not show it on the public profile.
- **storeType** – BUSINESS vs PERSON; drives visibility rules (contact/address/logo visibility).
- **status** – PENDING, APPROVED, REJECTED; lifecycle only. Controls indexing and who can edit (see `docs/product/prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md`). The public "has reports" notice is not a status: it is derived at read time from the store's open `StoreReport` rows (`docs/design/decisions/0019-derived-trust-signals-moderation-status-lifecycle-only.md`).
- **visibility** – PUBLIC vs PRIVATE.
- **isActive** – Whether the store is still operating; inactive stores stay visible but should show a warning.
- **hasStock / receivesOrders** – Optional hints for discovery and filters.
- **countryCode** – Main country of the store; used for filters and display.
- **averageRating / reviewCount** – Denormalized from `store_review` for fast display and sorting; keep in sync when reviews change.
- **createdByUserId** – Who created the store; used for edit permissions and attribution.
- **approvedByUserId / approvedAt** – Set when an admin approves; used for moderation and audit.

### `store_presence`

**Purpose:** Whether the store is online, physical, or both. One row per type; used for filters and profile display (e.g. “Online only”, “Physical”, “Hybrid”).

- **storeId / presenceType** – Composite PK; presenceType is ONLINE or PHYSICAL.

### `store_contact_channel`

**Purpose:** Contact methods (Instagram, WhatsApp, email, etc.). One row per channel; for business stores these can be shown on the profile; for person stores they are hidden.

- **storeId** – Store that owns this channel.
- **type** – INSTAGRAM, WHATSAPP, EMAIL, PHONE, WEBSITE, FACEBOOK, TIKTOK, OTHER.
- **value** – Handle, number, URL, or similar.
- **label** – Optional display label.
- **customTypeLabel** – When type is OTHER, this is the visible label.
- **isPrimary** – Marks the main contact for the store.
- **isPublic** – Whether to show on the public profile (subject to store type rules).

### `store_address`

**Purpose:** Physical addresses of the store. Multiple per store; used for “where to find us” and filters. Person stores hide addresses on the public profile.

- **storeId / countryCode** – Store and country; country from the `country` catalog.
- **city / district / addressLine / reference** – Free text; only country is from catalog.
- **isPrimary** – Which address to highlight when there are several.
- **isPublic** – Whether to show on the public profile (subject to store type).

### `store_import_country`

**Purpose:** Countries the store imports from (separate from “where the store is”). Used for filters and “imports from X” on the profile.

- **storeId / countryCode** – Composite PK; one row per country the store imports from.

---

## Product types and properties

### `store_product_type`

**Purpose:** Catalog of store product types (manga, comics, figures, etc.). Keys are stable; labels come from i18n. Used for assignment to stores and for property definitions.

- **key** – Primary key; stable key (e.g. manga, figures). Seeded by `prisma/seed.ts`; see `docs/development/store-catalogs.md` for stable identifiers and usage.
- **isActive** – Whether the product type is still available for assignment.

### `store_product_type_assignment`

**Purpose:** Links stores to product types. A store can have multiple product types; used for discovery filters and profile.

- **storeId / productTypeKey** – Composite PK; which store has which product type.

### `user_preferred_product_type`

**Purpose:** Many-to-many between collectors and `store_product_type` for saved “what I collect” preferences (FRD-07). Uses catalog keys only; no duplicate free-text types.

- **userId / productTypeKey** – Composite PK; which user prefers which catalog product type.
- **createdAt** – When the preference row was created.

### `store_property_definition`

**Purpose:** Defines optional or product-type-specific attributes (e.g. “supports preorders”, “TCG games”). System-defined in MVP; users do not create definitions. Used to show and filter store details without schema changes.

- **key** – Stable identifier for the property.
- **labelKey** – i18n key for the display label.
- **valueType** – TEXT, BOOLEAN, NUMBER, JSON; determines which value column is used in `store_property_value`.
- **isPublic** – Whether to show on the public store profile.
- **isFilterable** – Whether this property appears in discovery filters.
- **sortOrder** – Order when displaying multiple properties.

### `store_property_definition_category`

**Purpose:** Which product types a property applies to. A property can be linked to several product types; only those stores show/edit that property.

- **propertyDefinitionId / productTypeKey** – Composite PK; property applies to this product type.

### `store_property_value`

**Purpose:** One value per store per property. Which column is used (valueText, valueBoolean, valueNumber, valueJson) depends on the property’s valueType.

- **storeId / propertyDefinitionId** – Unique per store+property.
- **valueText / valueBoolean / valueNumber / valueJson** – Only one is set per row, according to the definition’s valueType.

---

## Reviews, notes, reports, requests

### `store_review`

**Purpose:** Public review of a store by a user. One review per user per store; editable by the author. Feeds `store.averageRating` and `store.reviewCount`; used for trust signals. No requirement to have an order to leave a review in MVP.

- **storeId / userId** – Unique together; one review per user per store.
- **overallRating** – Main score; always present and supports `0.5` increments.
- **communicationRating / packingRating / deliveryReliabilityRating** – Optional sub-scores.
- **wouldBuyAgain** – Optional recommendation.
- **comment** – Optional text; preserve user line breaks in read views.

### `store_note`

**Purpose:** Private notes from a user about a store. Not shown on the profile; only the note owner sees them. Used for personal reminders or internal trust notes.

- **storeId / userId** – Which store and who wrote the note.
- **content** – Note text.

### `store_report`

**Purpose:** User-reported issues about a store (spam, duplicate, wrong info, etc.). Used for moderation; status drives workflow (open → reviewed/dismissed).

- **storeId** – Store being reported.
- **reportedById** – User who submitted the report.
- **reason** – SPAM, DUPLICATE, INCORRECT_INFO, DOES_NOT_EXIST, INAPPROPRIATE.
- **details** – Optional explanation.
- **status** – OPEN, REVIEWED, DISMISSED.

### `store_product_type_request`

**Purpose:** User suggestion to add a new product type to the catalog. Moderation decides approval/rejection; not tied to a specific store.

- **requestedById** – User who requested.
- **suggestedKey** – Optional stable key for the new product type.
- **suggestedName** – Name proposed for the product type.
- **reason** – Optional justification.
- **status** – PENDING, APPROVED, REJECTED.

### `store_change_request`

**Purpose:** Proposed edits to an approved store when direct edit is not allowed. User submits changes as JSON; admin approves or rejects. Used for data quality and audit.

- **storeId** – Store to be updated.
- **requestedById** – User who requested the change.
- **status** – PENDING, APPROVED, REJECTED.
- **changes** – JSON object with the proposed field values.
- **comment** – Optional context from the requester.
- **reviewedByUserId / reviewedAt** – Who reviewed and when; set when status changes from PENDING.

---

## Orders and deliveries

### `order`

**Purpose:** A user’s order from one store. Groups items; used for tracking and for linking items to deliveries. Each order belongs to one store and one user.

- **id** – Unique order identifier.
- **storeId** – Store that sold the items.
- **userId** – Buyer.
- **totalCost / currencyCode / exchangeRate** – Order total in minor units, the order's own currency, and the optional rate used to convert it into the user base currency.
- **exchangeRateBaseCode** – The base currency `exchangeRate` converts INTO, written whenever a rate is persisted and null when there is no usable rate. "Needs FX reconciliation" is **derived** from it (currency differs from the current base and the stored rate is missing or was recorded against a different base), never stored as a flag; the single definition lives in `src/lib/fx/reconciliation.ts` and is shared by the dashboard rollup, the orders `?fxPending=true` filter, its count and the reconciliation modal. See [ADR 0024](../design/decisions/0024-fx-reconciliation-derived-from-rate-base.md).

### `order_item`

**Purpose:** Single line item in an order. Can be linked to deliveries via `delivery_order_item` and carries the product-level delivery milestone used for order-status derivation.

- **orderId** – Order this item belongs to.
- **userId** – Duplicated owner id for direct authorization checks on item-level mutations.
- **name / quantity / unitPrice / productTypeKey / position** – Product details and ordering within the source order.
- **deliveryState** – Product delivery milestone: NONE, ARRIVED_AT_STORE, IN_TRANSIT, or DELIVERED. Delivery mutations maintain this value and order status is re-derived from it.

### `delivery`

**Purpose:** A store-scoped delivery. One delivery can contain items from multiple orders of that same store. Used for delivery create, lifecycle actions, cost, and "what is in this parcel" context.

- **storeId** – Store that ships this delivery.
- **userId** – Owner id for direct authorization checks.
- **humanReadableId** – Collector-facing identifier generated as `DLV-YYYYMMDD-NN`.
- **status** – Delivery lifecycle state: IN_TRANSIT, DELIVERED, or CANCELLED.
- **deliveryDate** – Required shipping date; create flow defaults to today and allows past or current dates.
- **expectedArrivalFrom / expectedArrivalTo** – Optional expected arrival window.
- **cost / currencyCode / exchangeRate** – Required delivery cost and currency, with optional FX context when it differs from the user base currency.
- **exchangeRateBaseCode** – The base currency `exchangeRate` converts INTO, mirroring `order.exchangeRateBaseCode`; the delivery's FX-pending state is derived from it the same way, and per-delivery edit is the reconciliation path that re-stamps it.
- **note** – Optional private note, edited by later delivery-detail actions.

### `delivery_order_item`

**Purpose:** Which order items are in which delivery. A delivery can have items from several orders of the same store. A product may be attached to only one active delivery at a time; delivery mutations enforce that eligibility rule.

- **deliveryId / orderItemId** – Composite PK; this order item is included in this delivery.

---

## AI image intake

### `image_intake_usage`

**Purpose:** Reservation-then-settlement consumption ledger for "Crear desde imagen" (FRD-11). One row per extraction attempt, created `PENDING` with an estimated cost before the provider call and settled exactly once to `SUCCEEDED` or `FAILED` with the real tokens and cost; backs the global monthly spend cut-off (a single shared, paid Gemini API key) and the per-user photo quota. The same transaction that writes a reservation also moves the collector's `image_intake_period` roll-up, so both ceilings are decided under one lock.

- **userId** – Duplicated owner id; who made the submission.
- **periodKey** – Billing period the row belongs to, `YYYY-MM` (UTC), matching the global monthly cut-off.
- **dayKey** – Calendar day the row belongs to, `YYYY-MM-DD` (UTC); kept alongside `periodKey` so a future daily breakdown never needs to re-derive it from `createdAt`.
- **entrySource** – `IN_APP` or `SHARE`; which door the submission came through.
- **status** – `PENDING` (a reservation holding an estimated cost, written before the provider call), `SUCCEEDED`, or `FAILED`. Each row receives exactly one settlement update from `PENDING` to `SUCCEEDED` or `FAILED`, so the ledger is no longer strictly append-only. A row left `PENDING` (a killed process) keeps counting at its estimate.
- **imageCount** – Number of source images in the submission; what the photo quota counts, both monthly (through the roll-up) and daily (summed from these rows, excluding `FAILED`).
- **model** – Model id used for the extraction (e.g. `gemini-3.1-flash-lite`).
- **inputTokens / outputTokens** – Token usage reported by the provider.
- **costMicroUsd** – Integer cost in micro-USD, matching the repository's minor-unit convention for money.
- **orderId** – Optional weak reference only; this foundation slice never writes an order, so no relation/FK is declared and every row is created with `orderId: null`. A later slice may backfill it once a save action exists.
- **createdAt** – Audit and ordering; also used for the 1-request/10-second rate limit.

**Indexes:** `[userId, periodKey]`, `[userId, dayKey]` (the daily anti-burst cap), `[periodKey]`.

### `image_intake_period`

**Purpose:** Per-user, per-period roll-up of the monthly AI-photo bag (FRD-11 WO-07). Derivable from `image_intake_usage`, but kept as its own aggregate so the quota check on the reservation path and the passive counter on every create surface are one indexed read instead of a scan over the ledger. Reset is implicit through `periodKey`: **no scheduled job exists**, and a period with no row simply has nothing spent.

- **userId** – Owner of the roll-up; unique together with `periodKey`.
- **periodKey** – Billing period, `YYYY-MM` (UTC), the same key the ledger rows carry.
- **usedPhotos** – Photos reserved (`PENDING`) or confirmed (`SUCCEEDED`) in the period. A failed submission gives its photos back at settlement, because a provider failure is never billed to the collector.
- **costMicroUsd** – This collector's own running cost for the period, reserved at the estimate and corrected to the real figure at settlement.
- **createdAt / updatedAt** – Audit and ordering.

**Unique:** `[userId, periodKey]`.

---

## Enums (summary)

- **StoreType** – BUSINESS, PERSON (store identity and visibility rules).
- **StoreStatus** – PENDING, APPROVED, REJECTED (moderation lifecycle and indexing).
- **StoreVisibility** – PUBLIC, PRIVATE.
- **StorePresenceType** – ONLINE, PHYSICAL (filters and profile).
- **StoreContactChannelType** – INSTAGRAM, WHATSAPP, EMAIL, PHONE, WEBSITE, FACEBOOK, TIKTOK, OTHER.
- **StorePropertyValueType** – TEXT, BOOLEAN, NUMBER, JSON (property definition and value storage).
- **StoreProductTypeRequestStatus** – PENDING, APPROVED, REJECTED.
- **StoreReportReason** – SPAM, DUPLICATE, INCORRECT_INFO, DOES_NOT_EXIST, INAPPROPRIATE.
- **StoreReportStatus** – OPEN, REVIEWED, DISMISSED.
- **StoreChangeRequestStatus** – PENDING, APPROVED, REJECTED.
- **ImageIntakeEntrySource** – IN_APP, SHARE (which door an image-intake submission came through).
- **ImageIntakeUsageStatus** – PENDING (reservation, before the provider call), SUCCEEDED, FAILED.
