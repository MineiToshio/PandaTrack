# Database schema – purpose and usage

Reference for what each table and attribute is for, where it is used, and why it matters. For field types and constraints, see `prisma/schema.prisma`.

---

## Auth and user

### `user`

**Purpose:** Identity for anyone using the app. Used by auth, store ownership, reviews, notes, reports, and orders.

- **id** – Stable identifier; referenced by sessions, accounts, stores, orders, reviews, notes, reports.
- **name** – Display name in the app.
- **email** – Login identifier; unique.
- **emailVerified** – Whether the email was verified (affects trust / flows that require verification).
- **image** – Profile picture URL when provided by the provider or user.
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

- **accountId / providerId** – Identify the account at the provider.
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

**Purpose:** Stable list of countries. Used for store country, addresses, and import countries. Labels come from i18n (e.g. `countries.PE`), not from the DB.

- **code** – Primary key; ISO 3166-1 alpha-2 code (e.g. ES, PE). Seeded by `prisma/seed.ts`; see `docs/development/store-catalogs.md` for stable identifiers and usage.

---

## Stores (core)

### `store`

**Purpose:** Main entity: a place or seller where collectors buy. Holds identity, moderation state, visibility, and aggregated trust (rating, review count). Used by discovery, profile, orders, deliveries, reviews, notes, reports, and change requests.

- **id** – Unique identifier (cuid).
- **slug** – URL-safe, stable identifier for public routes (`/stores/[slug]`). Not changed when the name changes.
- **name / description** – Public-facing identity; description can be empty.
- **logoUrl** – Logo for business stores; person stores do not show it on the public profile.
- **storeType** – BUSINESS vs PERSON; drives visibility rules (contact/address/logo visibility).
- **status** – PENDING, APPROVED, REJECTED, FLAGGED; controls indexing and who can edit (see store-domain-model).
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

## Categories and properties

### `store_category`

**Purpose:** Catalog of store categories (manga, comics, figures, etc.). Keys are stable; labels come from i18n. Used for assignment to stores and for property definitions.

- **key** – Primary key; stable key (e.g. manga, figures). Seeded by `prisma/seed.ts`; see `docs/development/store-catalogs.md` for stable identifiers and usage.
- **isActive** – Whether the category is still available for assignment.

### `store_category_assignment`

**Purpose:** Links stores to categories. A store can have multiple categories; used for discovery filters and profile.

- **storeId / categoryKey** – Composite PK; which store has which category.

### `store_property_definition`

**Purpose:** Defines optional or category-specific attributes (e.g. “supports preorders”, “TCG games”). System-defined in MVP; users do not create definitions. Used to show and filter store details without schema changes.

- **key** – Stable identifier for the property.
- **labelKey** – i18n key for the display label.
- **valueType** – TEXT, BOOLEAN, NUMBER, JSON; determines which value column is used in `store_property_value`.
- **isPublic** – Whether to show on the public store profile.
- **isFilterable** – Whether this property appears in discovery filters.
- **sortOrder** – Order when displaying multiple properties.

### `store_property_definition_category`

**Purpose:** Which categories a property applies to. A property can be linked to several categories; only those stores show/edit that property.

- **propertyDefinitionId / categoryKey** – Composite PK; property applies to this category.

### `store_property_value`

**Purpose:** One value per store per property. Which column is used (valueText, valueBoolean, valueNumber, valueJson) depends on the property’s valueType.

- **storeId / propertyDefinitionId** – Unique per store+property.
- **valueText / valueBoolean / valueNumber / valueJson** – Only one is set per row, according to the definition’s valueType.

---

## Reviews, notes, reports, requests

### `store_review`

**Purpose:** Public review of a store by a user. One review per user per store; editable by the author. Feeds `store.averageRating` and `store.reviewCount`; used for trust signals. No requirement to have an order to leave a review in MVP.

- **storeId / userId** – Unique together; one review per user per store.
- **overallRating** – Main score; always present.
- **communicationRating / packingRating / deliveryReliabilityRating** – Optional sub-scores.
- **wouldBuyAgain** – Optional recommendation.
- **comment** – Optional text.

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

### `store_category_request`

**Purpose:** User suggestion to add a new category to the catalog. Moderation decides approval/rejection; not tied to a specific store.

- **requestedById** – User who requested.
- **suggestedKey** – Optional stable key for the new category.
- **suggestedName** – Name proposed for the category.
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

**Purpose:** A user’s purchase from one store. Groups items; used for tracking and for linking items to deliveries. Each order belongs to one store and one user.

- **id** – Unique order identifier.
- **storeId** – Store that sold the items.
- **userId** – Buyer.

### `order_item`

**Purpose:** Single line item in an order. Can be linked to one or more deliveries (split shipments) via `delivery_order_item`.

- **orderId** – Order this item belongs to.

### `delivery`

**Purpose:** A shipment from a store. One delivery can contain items from multiple orders of that store (e.g. one parcel with several orders). Used for shipment tracking and “what’s in this parcel”.

- **storeId** – Store that ships this delivery.

### `delivery_order_item`

**Purpose:** Which order items are in which delivery. Enables split shipments: one order’s items can be in several deliveries, and one delivery can have items from several orders of the same store.

- **deliveryId / orderItemId** – Composite PK; this order item is included in this delivery.

---

## Enums (summary)

- **StoreType** – BUSINESS, PERSON (store identity and visibility rules).
- **StoreStatus** – PENDING, APPROVED, REJECTED, FLAGGED (moderation and indexing).
- **StoreVisibility** – PUBLIC, PRIVATE.
- **StorePresenceType** – ONLINE, PHYSICAL (filters and profile).
- **StoreContactChannelType** – INSTAGRAM, WHATSAPP, EMAIL, PHONE, WEBSITE, FACEBOOK, TIKTOK, OTHER.
- **StorePropertyValueType** – TEXT, BOOLEAN, NUMBER, JSON (property definition and value storage).
- **StoreCategoryRequestStatus** – PENDING, APPROVED, REJECTED.
- **StoreReportReason** – SPAM, DUPLICATE, INCORRECT_INFO, DOES_NOT_EXIST, INAPPROPRIATE.
- **StoreReportStatus** – OPEN, REVIEWED, DISMISSED.
- **StoreChangeRequestStatus** – PENDING, APPROVED, REJECTED.
