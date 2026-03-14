# Store Domain Model

## Purpose

This document defines the PandaTrack MVP data model and product rules for stores, their metadata, moderation flow, and related discovery signals.

## Core entity

- `Store` is the main entity for any source where a collector buys items.
- A store can represent either a formal business or an individual seller.
- Orders, deliveries, reviews, and discovery signals attach to a `Store`.

## Product decisions

### Store identity

- The main entity name is `Store`.
- Store type is represented with `StoreType`.
- Supported store types:
  - `BUSINESS`
  - `PERSON`

### Store presence

- Store presence is represented with repeatable `StorePresenceType` values.
- Supported presence values:
  - `ONLINE`
  - `PHYSICAL`
- A store with both presence values is treated as hybrid in the UI, but no `HYBRID` value is stored.

### Public visibility and moderation

- Any authenticated user can create a store.
- Stores created by admins are automatically `APPROVED`.
- Stores created by normal users are created as public and `PENDING`.
- `PENDING` stores are publicly visible.
- `PENDING` stores are included in in-app listings and search results.
- `PENDING` stores are not search-engine indexable.
- `APPROVED` stores are search-engine indexable.
- `PENDING` stores must display a disclaimer in the product explaining that the profile was created by a user and has not been approved yet.
- Duplicate prevention should happen during creation:
  - while the user types the store name
  - again before final submit if similar stores are found

### Editing policy

- `PENDING` stores can be edited directly only by their creator and admins.
- `APPROVED` stores should not be edited directly by normal users.
- Corrections for `APPROVED` stores should go through a dedicated change-request flow.

## Visibility rules by store type

### Business stores

- Public store information is visible.
- Contact channels can be visible.
- Store addresses can be visible.
- Logo can be visible.

### Person stores

- Contact information is hidden from the public profile.
- Store addresses are hidden from the public profile.
- Logo is not used.
- Public profile still shows:
  - store name
  - categories
  - reviews and trust signals

## Internationalization strategy

### Countries

- Countries are stored in the database as stable codes.
- Country labels are resolved through i18n JSON files.
- Example:
  - database stores `PE`
  - i18n resolves `countries.PE`

### Categories

- Store categories are stored with stable keys.
- Display labels are always resolved in the application through i18n.

### Addresses

- `city`, `district`, `addressLine`, and `reference` are stored as free text.
- Only country uses a database catalog.

## Store model scope

### Core store fields

- Identity and moderation:
  - `id`
  - `slug`
  - `name`
  - `description`
  - `storeType`
  - `status`
  - `visibility`
  - `isActive`
  - `createdByUserId`
  - `approvedByUserId`
  - `approvedAt`
  - timestamps
- Public store details:
  - `logoUrl`
  - `hasStock`
  - `receivesOrders`
  - `countryCode`

### Related entities

- `StorePresence`
- `StoreContactChannel`
- `StoreAddress`
- `StoreImportCountry`
- `StoreCategory`
- `StoreCategoryAssignment`
- `StoreReview`
- `StoreNote`
- `StoreReport`
- `StoreCategoryRequest`
- `StoreChangeRequest`

## Store routes and slugs

- Public store routes use `/store/[slug]` (legacy `/stores/[slug]` redirects to this path).
- Store slugs must be SEO-friendly and stable.
- Slug format should be:
  - `slugified-store-name` + `-` + stable short random suffix
- The short suffix should use 6 characters in MVP.
- Store slugs should not be regenerated automatically when the store name changes.

## Contacts

- Contact channels are stored separately from the main store row.
- A store can have multiple contact channels.
- Supported default contact channel types:
  - `INSTAGRAM`
  - `WHATSAPP`
  - `EMAIL`
  - `PHONE`
  - `WEBSITE`
  - `FACEBOOK`
  - `TIKTOK`
  - `OTHER`
- For `OTHER`, the UI must allow a custom label so the channel is not displayed as a generic "other" entry.

## Addresses

- Addresses are stored separately from the main store row.
- A physical store can have multiple addresses.
- MVP address fields:
  - `countryCode`
  - `city`
  - `district`
  - `addressLine`
  - `reference`
  - `isPrimary`
  - `isPublic`

## Import countries

- Import countries are modeled separately from addresses.
- A store can import from multiple countries.
- Import countries must reference the `Country` catalog.

## Categories

### Initial category set

- `manga`
- `comics`
- `books`
- `artbooks`
- `magazines`
- `funko`
- `figures`
- `tcg`
- `merch`
- `cds`
- `blu_ray_dvd`
- `light_novels`
- `games`

### Category rules

- A store can belong to multiple categories.
- Categories are assigned through a pivot relation.
- Categories use stable keys and translated labels.
- Users do not create categories directly in MVP.

### Category requests

- Users can request new categories.
- Category requests are stored separately from the official category catalog.
- A category request should capture:
  - suggested key or name
  - optional explanation
  - requester
  - moderation status

## Store metadata scope

- MVP store metadata stays intentionally simple.
- Core store fields belong directly on `Store`.
- Supported metadata layers in MVP are:
  - categories
  - import countries
  - stock flag
  - receives-orders flag
  - visibility and moderation state
  - reviews
  - private notes
- Dynamic category-specific property-definition systems are out of MVP scope.
- Subcategories are also out of MVP scope for now.

## Reviews

- A user can have only one public review per store.
- The user can edit that review over time.
- MVP reviews attach directly to the store, not to individual orders.
- Product may later add order-level feedback without replacing the public store review.
- Any user can publish a review in MVP; an existing order is not required.
- The product should persist trust summary values on the store profile:
  - `averageRating`
  - `reviewCount`

## Search and filtering

- Public store discovery must support:
  - search by name
  - filter by category
  - filter by country
  - filter by presence
- Multi-select values inside the same filter family use OR logic.
- Different filter families combine with AND logic.

## Orders and deliveries

- `Order` belongs to `Store`.
- `Delivery` belongs to `Store`.
- Deliveries are modeled at store level because one delivery can consolidate items from multiple orders of the same store.
- `DeliveryOrderItem` links deliveries with specific order items.

## Notes

- Private user-specific store notes are supported through `StoreNote`.
- Notes are private and not part of the public store profile.

## Reports

- Stores can be reported by users.
- MVP report reasons should include:
  - `SPAM`
  - `DUPLICATE`
  - `INCORRECT_INFO`
  - `DOES_NOT_EXIST`
  - `INAPPROPRIATE`

## Store activity state

- Stores are not deleted in normal user flows.
- Stores should support an activity flag so collectors can tell whether the seller still operates.
- Inactive stores remain publicly accessible.
- Inactive stores must show a warning in the public experience.

## Store logos

- Only business stores use logos in the public profile.
- Logo storage should use Cloudflare R2 in MVP.
- Upload flow should:
  - validate the image
  - optimize and resize it
  - strip unnecessary metadata
  - upload the resulting asset to Cloudflare R2
  - persist the final storage key or asset URL in the store record

## Future extensions

- Admin moderation panel for store approval and reports
- Store edit suggestions for non-owners
- Richer trust signals derived from orders and deliveries
- Additional category families beyond the initial collector-focused set
