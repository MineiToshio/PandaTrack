---
id: FRD-04
type: FRD
slug: store-domain
title: Store Domain
status: ACTIVE
parent: PRD-02
children:
  - BP-01
last_updated: 2026-08-08
source_features:
  - FEAT-0012
implementation_status: PARTIALLY_IMPLEMENTED
---

# FRD-04 Store Domain

## Overview

The store domain is the public trust and discovery layer of PandaTrack.

It exists so collectors can:

- discover sellers before buying
- understand what kind of store a seller is
- assess trust through public profile quality, moderation context, and community reviews
- connect future orders, deliveries, and reminders to a stable seller identity

This domain is implemented in production code and continues to evolve. This FRD reflects both:

- the current implemented behavior confirmed through reverse engineering of the codebase
- the remaining planned behavior already represented in linked Work Orders and mirrored in GitHub tracking

It also defines how the listing layer behaves when upstream navigation chooses to prefill the URL from user preferences.

## Current State

### Implemented

- Store persistence model and related entities
- Seeded country and store product-type catalogs
- Store creation form and server action
- Duplicate detection on blur and on submit
- Stable slug generation with 6-char suffix
- Public stores listing page
- Public store detail page
- Seller-type public visibility rules (RETAILER / PERSON / PROXY)
- Pending-store in-app visibility
- Pending-store detail disclaimer
- Inactive-store warning on detail page
- Store report submission
- Product-type request submission
- Public review create, edit, and delete flows
- Private store-note save flow
- Approved-store change-request flow
- Pending-store direct-edit permissions and route branching
- Logo upload and public-detail rendering for RETAILER and PROXY stores
- Three seller types with a PROXY (intermediary) type that has no catalog, plus the seller-type rename (`storeType` → `sellerType`, `BUSINESS` → `RETAILER`)
- Store search/filter analytics events for listing and duplicate flows
- Store-detail single-column layout with a compact sales/shopping summary under the hero
- Private person stores (`FR-04-33` / `FR-04-34`): `Store.isPrivate` schema field, creation-form toggle shown only for `PERSON` type, and listing/search exclusion (shipped in the S6 redesign)
- Redesign UX for the store domain: filter drawer (closes only via X and Esc, not outside click), `FilterTriggerButton` with active state and applied-filter badge count, create wizard accordion with per-step `localStorage` autosave, staged-add for contact channels and addresses, logo upload with an intermediate crop-and-confirm step, and the Chip Eyebrow + Top-Accent treatment plus inline "Actions" card on store detail
- Store-level payments on the store detail page (`FR-04-55`–`FR-04-58`, 2026-08-08): a per-currency "Deuda pendiente" row in the aside, a "Registrar pago" entry point into the shared store payment sheet, a "Ver mis pedidos en esta tienda" link into the orders list's store-grouped view, and a "Pagos a esta tienda" card listing the collector's own payments to this store with delete. The underlying money model (declared allocations, the store payment sheet itself) is owned by [FRD-05](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md) (`FR-05-42`–`FR-05-44`, [ADR 0025](../../../design/decisions/0025-store-level-payments-declared-allocations.md)); this FRD owns only the store-detail entry points and presentation.

## Terminology

- `Store`: the main seller identity entity in PandaTrack (the "Tiendas" section). Its classification is the **seller type**, a separate concept from the entity itself.
- `Seller type` (`Store.sellerType`, enum `SellerType`): how a store sells. One of `RETAILER`, `PERSON`, or `PROXY`. Renamed from the former `storeType`/`StoreType` (value `BUSINESS` → `RETAILER`) to disambiguate the classification from the "Tienda" entity/section and to name the seller's role rather than its legal category (see ADR 0016).
- `Retailer store` (`RETAILER`, es "Comercio"): a business that sells its own products. Exposes logo, contact channels, and addresses; owns a catalog (product types, stock, pre-order signal). Was `BUSINESS`.
- `Person store` (`PERSON`, es "Persona", en "Individual"): an individual reseller. Hides logo, contact channels, and addresses; may be marked private; owns a catalog.
- `Proxy store` (`PROXY`, es/en "Proxy"): a forwarding/intermediary service (e.g. ZenMarket) that buys on your behalf and is **not** a direct seller. Exposes logo, import countries, contact channels, addresses, and reviews like a retailer, but has **no catalog** (no product types, no `hasStock`, no `receivesOrders`) and is always public.
- `Pending store`: a public store created by a non-admin user that is visible in-app but not SEO-indexable
- `Approved store`: a public store approved for normal indexable public visibility
- `Presence`: where the store operates, currently `ONLINE` and/or `PHYSICAL`
- `Product type`: collector-focused product category assigned to the store
- `Import country`: country from which the store imports items
- `Duplicate candidate`: an existing store whose name appears similar enough to the new candidate to warn the user

## User Stories

### US-01 Discover stores

As a collector, I want to browse and filter stores so I can evaluate which sellers match what I buy and where I buy from.

### US-02 Create a new store safely

As an authenticated collector, I want to add a store profile with duplicate protection so I do not flood the product with near-identical seller entries.

### US-03 Understand store trust context

As a collector, I want to see moderation status, activity state, and community reviews so I can judge whether a store profile feels reliable.

### US-04 Hide sensitive fields for person sellers

As a product owner, I want person-seller profiles to hide contact and address details publicly so public visibility stays appropriate.

### US-05 Govern corrections over time

As PandaTrack grows, I want stores to support reports, requests, and change suggestions so public data can improve without uncontrolled editing.

## Functional Requirements

### Identity and modeling

- `FR-04-01`: The system must model stores as a first-class domain entity.
- `FR-04-02`: A store must support three seller types on `Store.sellerType` (enum `SellerType`): `RETAILER`, `PERSON`, and `PROXY`. (`sellerType` was renamed from `storeType`; value `BUSINESS` was renamed to `RETAILER`; `PROXY` is new — see ADR 0016.)
- `FR-04-03`: A store must support repeatable presence values `ONLINE` and `PHYSICAL`.
- `FR-04-04`: A store must support core identity fields including `name`, `slug`, `description`, `countryCode`, moderation state, and activity state.
- `FR-04-05`: A store must support related metadata for product types, import countries, contact channels, and addresses.

### Creation and moderation

- `FR-04-06`: Authenticated users must be able to create stores.
- `FR-04-07`: Admin-created stores must default to `APPROVED`.
- `FR-04-08`: Normal-user-created stores must default to public `PENDING`.
- `FR-04-09`: The create flow must validate country codes and product-type keys against seeded catalogs before persisting.
- `FR-04-10`: Store creation must support both blur-time duplicate suggestions and submit-time duplicate confirmation.

### Discovery and detail

- `FR-04-11`: Public store listing must support text search by name.
- `FR-04-12`: Public store listing must support filters for product type, country, import country, and presence.
- `FR-04-13`: Public store listing must also support filters for `receivesOrders` and `hasStock`. **Redesign note:** filter inputs live in a drawer that dismisses only via its close (X) control and Esc — not via outside-click — and the listing's filter trigger shows a tinted active state with an applied-filter badge count (the free-text search does not increment that count).
- `FR-04-13a`: **The listing must also filter by seller type** (`RETAILER` / `PERSON` / `PROXY`), as a multi-select pill family in the drawer sitting between the category and presence families. _(Added 2026-08-05.)_ It became worth having once `BR-04-21a` made a collector's own private person stores appear in their listing: with individuals in the list, separating "comercios" from "personas" is the split that actually orders the catalog. It reuses the same three labels and icons as the creation form so a type means the same thing everywhere.
- `FR-04-13b`: **The listing must offer a "only my private stores" toggle**, in the drawer's switches family alongside the other booleans. _(Added 2026-08-05.)_ It answers a question only the store's own creator can ask: what have I actually marked private? It is defined as "private AND created by the viewer" rather than as `isPrivate: true` layered on the listing's normal visibility rule, so it is a strict subset of what the viewer could already see and can never widen into "every private store in the catalog"; with no viewer it matches nothing rather than falling open. See `ownPrivateStoresFilter`.
- `FR-04-13c`: **A store card must show when the store is the viewer's own private one.** _(Added 2026-08-05.)_ Rendered as a `lock` + "Privada" marker inline in the card's country band, never as a chip: the chip row is reserved for product types (see the FDD), is absent entirely on a store with no categories, and has capped slots. The marker is keyed on the viewer having created the store, not on `isPrivate` alone, so a card can never assert "private, only you can see it" about somebody else's store. Because the card is a single link whose `aria-label` overrides its own content, the condition is also appended to that label rather than left to the visible text.
- `FR-04-14`: Multi-select values within one filter family must use OR logic.
- `FR-04-15`: Different filter families must combine with AND logic.
- `FR-04-16`: Public listing must include both `PENDING` and `APPROVED` stores that are `PUBLIC`.
- `FR-04-36`: Public store listing must hide closed (inactive) stores by default and expose an opt-in "show closed" filter that includes them. Closed stores remain reachable by their direct detail URL regardless of the filter (see `FR-04-19`).
- `FR-04-17`: Public detail must resolve through the canonical route `/{locale}/stores/[slug]`.
- `FR-04-18`: Public detail must show a pending disclaimer for `PENDING` stores.
- `FR-04-19`: Public detail must show an inactivity warning for inactive stores.
- `FR-04-32`: Public detail should favor one main reading column, with sales channels and shopping options summarized directly under the hero before deeper catalog, contact, and address sections.

### Payments

Store-level payments (`StorePayment`, an optional declared `PaymentAllocation` per order/item) are a money model owned by [FRD-05](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md) ([`FR-05-42`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements) the store payment sheet, `FR-05-43` the debt/credit derivation, `FR-05-44` the orders-list store-grouped entry point; [ADR 0025](../../../design/decisions/0025-store-level-payments-declared-allocations.md) for the design decision). This FRD does not re-specify that mechanics; it owns the store-detail page's own entry points into it and what the page itself shows.

- `FR-04-55`: The store detail aside's "Resumen" card must show the viewer's own outstanding debt to this store, one row per currency ("Deuda pendiente"), stacked below the order-count and spend rows, sourced from the same debt figure [FRD-05](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md) derives for the store (`FR-05-43`). A currency whose debt is negative (the store owes the collector, e.g. a cancelled order whose payment was kept as credit) renders in the success tone as "A favor {amount}" instead of a debt. The rows are omitted entirely, together with the rest of the "Resumen" card, when the viewer has never ordered from or paid this store.
- `FR-04-56`: The store detail aside's "Acciones" card must offer a "Registrar pago" action that opens the store payment sheet (`StorePaymentSheet`, [FRD-05 · FR-05-42](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements)) pre-targeted at this store, mirroring the "Por tienda" orders-list entry point (`FR-05-44`) at the store-detail level. The action is disabled, with an explanatory tooltip hint ("Sin deuda pendiente con esta tienda"), unless the viewer owes this store a strictly positive amount (`debtMinor > 0`) in at least one currency. A debt row that is zero or negative (a credit, "A favor") is not itself something new to register a payment against, so it does not enable the action on its own.
- `FR-04-57`: The store detail aside's "Acciones" card must offer a "Ver mis pedidos en esta tienda" link that navigates to the orders list's store-grouped view (`/orders?view=store`, [FRD-05 · FR-05-44](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements)), giving the collector a path from one store's debt into the full cross-store grouped view.
- `FR-04-58`: The store detail main column must offer a "Pagos a esta tienda" card listing every `StorePayment` the viewer has made to this store, newest first, each row showing its date, amount, optional note, and a "Sin asignar" badge when the payment carries an amount not yet declared against any order or product. The card renders nothing when the viewer has never paid this store. Each row offers a delete action gated by a destructive confirmation modal; confirming it removes the entire `StorePayment` and every `PaymentAllocation` declared against it, not only a slice of it, because a payment belongs to exactly one store regardless of how many orders it is declared against. This is the only surface that can reach and remove a payment that carries no allocation ("on account") or an undeclared remainder, complementing the order-scoped payment delete ([FRD-05 · `BR-05-10`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#business-rules)), which removes only one order's slice of a payment shared across orders.

### Visibility rules

- `FR-04-20`: `RETAILER` and `PROXY` stores may expose logo, public contact channels, and public addresses.
- `FR-04-21`: `PERSON` stores must not expose logo, public contact channels, or public addresses.
- `FR-04-22`: `RETAILER`- and `PROXY`-store detail payloads must include public contact and address data when present.
- `FR-04-23`: `PERSON`-store detail payloads must omit those fields from the public payload.
- `FR-04-33`: `PERSON` stores must support a `private` visibility flag at creation time. When enabled, the store is visible only to its creator; it does not appear in the public listing, public search results, or any other user's view. Private person stores retain all collector functionality for their creator (orders, deliveries, reviews, notes).
- `FR-04-34`: The private visibility flag is only available for `PERSON`-type stores. `RETAILER` and `PROXY` stores are always public.
- `FR-04-38`: A `PROXY` store is a forwarding/intermediary service, not a direct seller, and must have **no catalog**: it saves with empty product types and null `hasStock` / `receivesOrders`. The create/edit form must hide the product-type selection and the stock / pre-order signal when the seller type is `PROXY`, and both the create action and the governance edit mutation must normalize those fields away for a `PROXY` regardless of submitted input.
- `FR-04-39`: A `PROXY` store must render its logo (like a `RETAILER`, not the `PERSON` icon-only avatar) and keep import countries, contact channels, addresses, and reviews. The public detail must surface a small "Proxy" badge near the store name so collectors can tell it is an intermediary.

### Trust and governance

- `FR-04-24`: Users must be able to create or edit one public review per store. The community-reviews surface is **authenticated-only**: the detail page loads the full set of public reviews server-side **only when a session is present** (`getPublicStoreReviews` is called only when `session?.user?.id` is set); anonymous visitors receive an empty list and see no reviews. For a signed-in viewer, the public store-detail review list shows a preview of the first 4 community reviews and reveals all remaining reviews in a single "Ver todas" action when more are available. When the signed-in viewer already has a public review for that store, that review is pinned first (outside the community preview count) and the rest are the most recently updated reviews from other users.
- `FR-04-25`: Store-level aggregate trust fields must be persisted instead of recalculated on every read.
- `FR-04-26`: Users must be able to save private notes on stores, including saving an empty value to clear an existing note without entering a full edit flow.
- `FR-04-27`: Authenticated users must be able to create and update one open report per store using one supported reason plus optional free-text context, and they may create a new report for that same store after the earlier report is resolved.
- `FR-04-28`: Authenticated users must be able to request new product types from store create and store edit flows.
- `FR-04-29`: Approved stores must support change requests instead of direct edits by normal users, and each authenticated user may keep only one open change request per store.
- `FR-04-30`: Pending stores must be directly editable only by their creator and admins; other authenticated users must use the change-request flow instead.
- `FR-04-31`: `RETAILER` and `PROXY` stores must support logo upload backed by external object storage. **Redesign note:** the upload includes an intermediate crop-and-confirm step in a modal (shared `ImageCropper`, rectangular preview) before the logo is persisted.
- `FR-04-35`: When the listing and detail are viewed by an authenticated user, the system must surface that viewer's own order relationship with each store: a per-card viewer order count on the listing grid, and a viewer activity summary on the detail aside (order totals and amount spent grouped by currency). This viewer-scoped data must never be exposed to anonymous visitors or other users.
- `FR-04-37`: Marking a store as closed (setting it inactive) must be part of the store edit flow and follow the exact same permission rule as any other editable field: it applies directly for admins and for a creator editing their own `PENDING` store, and otherwise flows through the change-request path for moderation (`FR-04-29`, `FR-04-30`). A closed store is excluded from the order-creation store picker.

### Admin moderation actions

These requirements are the inline moderation controls exposed on the store surfaces to administrators. They are gated by the durable administrator role and the `requireAdmin()` helper defined by [PRD-03 (FRD-01)](../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md), and the moderation console defined by [PRD-03 (FRD-02)](../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md) routes administrators to them; the console does not implement them. This scope is planned, not yet shipped.

- `FR-04-40`: Administrators must be able to approve a `PENDING` store inline from the store detail, transitioning it to `APPROVED` and persisting `approvedByUserId` and `approvedAt` (the same fields set on admin-created approval, `AC-04-02`). The control is admin-only and has no non-admin path.
- `FR-04-41`: Administrators must be able to remove (reject) a store inline, transitioning it to `REJECTED` and persisting a `removalReason`. Removal is a tombstone, not a hard delete: the store row is retained so records that reference it keep resolving, but the store is excluded from all public surfaces (listing, search, and the direct detail URL, which returns 404) and from the order-creation store picker.
- `FR-04-42`: Collector orders that reference a `REJECTED` store must keep rendering. Where an order surfaces its store, it must show a neutral tombstone message by default ("Esta tienda ya no esta disponible") and use sanction wording only when the `removalReason` is an abuse category.
- `FR-04-43`: The public "this store has reports" notice must be **derived at read time** from the store's open-report count, never set by hand. It renders on the store detail for every viewer when the store has at least `STORE_REPORT_NOTICE_THRESHOLD` (1) open `StoreReport` rows, and it disappears as soon as the last open report is resolved or dismissed. One open report is enough: the notice makes no accusation, it states that a report exists and has not been reviewed yet, and the report may well be important with only one user having noticed. The notice never hides a store, never changes its moderation status, and never affects indexing. There is **no** administrator flag/unflag control and **no** `FLAGGED` moderation status; moderation status carries lifecycle only. See [ADR 0019](../../../design/decisions/0019-derived-trust-signals-moderation-status-lifecycle-only.md).
- `FR-04-44`: Administrators must be able to resolve or dismiss an open store report inline from the governance panel, transitioning `StoreReport` from `OPEN` to `REVIEWED` or `DISMISSED`. Resolving a report frees the reporter to file a new report for that store (`AC-04-12`). **Notice side effect:** because the public report notice is derived from the open-report count (`FR-04-43`), resolving or dismissing a store's last open report is also what clears that notice; it is the only action that does. No separate moderation gesture exists for the notice.
- `FR-04-45`: Raw report free-text details and reporter identity must be readable by administrators only, through a new server-only admin data-access layer, and must never be exposed by widening the public governance read model (`BR-04-13` stays honored for non-admin viewers).
- `FR-04-46`: Administrators must be able to approve or reject a `StoreChangeRequest` inline. On approval, the system must re-derive the diff against the store's current state at approval time (rebase) and apply the resulting changes in one transaction, including the relation fields (`contactChannels`, `addresses`, `productTypeKeys`, `importCountries`), and must persist `reviewedByUserId` and `reviewedAt`. Rejection closes the request without applying it. The stored diff must never be blind-applied.
- `FR-04-47`: When the stored change-request diff no longer cleanly applies to the store's current state (drift, because the store changed after the request was filed), the system must detect and surface the drift to the administrator rather than silently applying stale values. Because the stored diff persists only proposed values and no base snapshot, drift surfacing at this store-detail surface is bounded to the two signals derivable from diff-only storage: a per-field "already applied" tag when the current value already equals the proposal (dropped from the apply), and a store-level "changed since filed" banner when `store.updatedAt > changeRequest.updatedAt`; approval applies only the changes that still have effect. The richer per-field three-value conflict view (`what was proposed against` / `now` / `proposed`) belongs to the moderation console ([PRD-03 (FRD-02)](../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md)) and depends on a forward-only base-snapshot decision taken there.
- `FR-04-48`: After any write to a store (direct edit, an applied change request, or a moderation transition), other open change requests on the same store must be re-evaluated: a request whose diff is now empty against the new state is superseded (invalidated) so stale requests do not linger (extends `BR-04-16`).
- `FR-04-49`: Administrators must be able to approve or reject a `StoreProductTypeRequest`. Approval authors a new entry into the global `StoreProductType` catalog at runtime: a generated `key` plus localized names in both `es` and `en` persisted as `nameEs` / `nameEn` columns on the catalog row, so the new type is immediately usable (selectable in create/edit and as a listing filter) without a code deploy. Rejection closes the request without writing to the catalog. The review affordance that triggers approve/reject is owned by the moderation console (**FRD-02** · WO-02, review surface `#review-type`, [`wo-02-moderation-inbox.md`](../../prd-03-admin-and-moderation/frd-02-moderation-console/bp-01-moderation-console/work-orders/wo-02-moderation-inbox.md)); this FRD owns the mutations, the admin data-access layer, and the catalog authoring the console invokes.
- `FR-04-50`: The `PENDING` store disclaimer copy must read as non-alarmist "en revision" review language rather than a warning about unverified or untrustworthy data, so a newly created community store is not framed as suspect while it awaits moderation.
- `FR-04-51`: Every admin moderation mutation (approve, remove, resolve report, dismiss report, apply change request, reject change request, approve product-type request, reject product-type request) must be gated server-side by `requireAdmin()` and must write an append-only `AdminAuditLog` entry through the shared `writeAuditEntry()` helper, using the stable action keys defined by [PRD-03 (FRD-01)](../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md) (`store.approve`, `store.remove`, `report.resolve`, `report.dismiss`, `changeRequest.apply`, `changeRequest.reject`, `productType.approve`, `productType.reject`). The vocabulary also defines `store.flag` and `store.unflag`, which are **retired from writing**: no mutation emits them anymore (`FR-04-43`), but they stay in the vocabulary because historical audit rows carry them (`BR-01-05`).
- `FR-04-52`: On the store detail page, a store that has a logo must let the viewer open it at a readable size. The logo is stored at 512px but rendered at 56px in the hero, so the detail a collector uploaded is otherwise never visible. The trigger must be a real button (keyboard reachable, named for assistive tech), and the enlarged view must use the canonical `<Modal>` so it inherits focus trap, Esc, return-focus and dialog semantics. The enlarged view renders the logo **uncropped** (`object-contain`), unlike the hero avatar which crops to fill its square. This is deliberately limited to the detail hero: the same avatar inside store cards and dashboard rows sits within a link, where a nested button would be invalid markup and would swallow the row's navigation.
- `FR-04-53`: The create/edit form's logo field must accept an image pasted from the clipboard, not only a picked or dropped file, mirroring the same clipboard door **FRD-11** (image intake) already offers. The paste listener is scoped to the field's own mount lifetime and must not hijack a paste made into an adjacent text field on the same step (store name, description, the country combobox).
- `FR-04-54`: **A `PHONE`/`WHATSAPP` contact-channel value must accept a plain local number, with the country inferred from the store's own `countryCode` when the number carries none.** A collector types a phone number the way they would dial it locally; requiring them to also supply a country calling code they would have to look up is the wrong default when the store's own country is already known. An explicit "+" country prefix on the typed value is still honoured over the inferred one. `PHONE` is normalized and stored as E.164 (`+51987654321`); `WHATSAPP` is normalized into the canonical `https://wa.me/<digits>` link the server's validation requires, unless the collector already pasted a `wa.me`/`whatsapp.com` link, which is kept as-is. This was an implementation gap, not a prior product decision: no FRD-04 record specified the strict format the client used to require.

## Business Rules

- `BR-04-01`: Canonical public store routes use `/stores/[slug]`.
- `BR-04-02`: Store slugs are generated from the store name plus a 6-character short suffix.
- `BR-04-03`: Store slugs must not change automatically when a store name changes.
- `BR-04-04`: Pending stores are public in-app but must remain non-indexable for SEO.
- `BR-04-05`: Approved stores are public and SEO-indexable.
- `BR-04-06`: Closed (inactive) stores are hidden from the public listing and search by default and are excluded from the order-creation store picker, but they remain reachable by their direct detail URL, where they must surface an inactivity warning. The listing exposes an opt-in "show closed" filter to include them (`FR-04-36`).
- `BR-04-07`: Review publication does not require a linked order in MVP. The community-reviews section is **authenticated-only**: it is loaded server-side only when a session is present, so anonymous visitors do not load or see any reviews. For a signed-in viewer the list is fully loaded server-side, but the public review section progressively discloses long lists: it renders a 4-review community preview and expands to all remaining reviews in a single "Ver todas" reveal rather than showing the full list by default.
- `BR-04-20`: Pending stores support the same user interactions as approved stores — any authenticated user may write reviews, annotate orders, annotate deliveries, save notes, report, or suggest changes on a pending store. The only behavioral difference for pending stores is the moderation disclaimer shown on the detail page and the absence of SEO indexing.
- `BR-04-21`: Private person stores are excluded from all public listing and search surfaces. They remain accessible via their direct URL only to their creator.
- `BR-04-21a`: **"All surfaces" means every query that can return a store to a user, not only the listing.** _(Added 2026-08-05.)_ The rule was originally implemented in the listing filter and the detail page's 404 and nowhere else, which left a private store hidden from its own creator and visible to everyone else: its name appeared in every collector's order-form store picker, an image-intake match could resolve onto it, the duplicate-candidate search returned its `slug`, and the edit route served its full record, contact channels included, to any signed-in user. Every such query now applies one shared predicate (a store qualifies when it is not private, or when the viewer created it), and the edit route applies the same owner/admin 404 as the detail page. A collector's own private stores appear in **their** listing, which is what `FR-04-33`'s "visible only to its creator" always promised and what the creation-form copy ("Solo tú puedes verlo") states.
- `BR-04-21b`: **A contact channel the app inferred is never presented as one the store published.** A phone read out of a chat screenshot by image intake, or learned when a collector confirms a store match, is stored non-public: it serves matching and nothing else. It is not shown in the edit form, is not rewritten when that form is saved (so editing a store no longer destroys the matching hint, which used to cause a duplicate on the next intake), and does not appear in the moderation queue, since approving or rejecting a store is a decision about the store rather than about a number taken from a private conversation.
- `BR-04-08`: Duplicate submit warnings are triggered only for same-country stores at or above the configured similarity threshold.
- `BR-04-09`: Same-name stores in different countries do not trigger the submit modal.
- `BR-04-10`: Store creation currently redirects directly to the created detail route after success.
- `BR-04-11`: Store edit routes must follow the canonical pattern `/stores/[slug]/edit`.
- `BR-04-12`: Public store-detail `Reports and suggestions` summaries may be visible to any visitor, but report and change-request submissions require authentication.
- `BR-04-13`: Public `Reports and suggestions` summaries must not expose requester identity or raw free-text report details to non-admin viewers, except that the signed-in viewer may see their own open report details and their own pending change-request comment inside the personalized summary panel.
- `BR-04-14`: A user may have only one open store report per store at a time; once the earlier report is resolved, the user may create a new report for that store.
- `BR-04-15`: A user may have only one open store change request per store at a time; once the earlier request is resolved, the user may create a new change request for that store.
- `BR-04-16`: Store change requests persist only the changed fields and must be discarded or deleted when no effective diff remains.
- `BR-04-17`: Store-country and seller-type (`sellerType`) changes are not allowed through direct edit or change-request flows; seller-type disputes must be raised through the report flow.
- `BR-04-18`: Product-type request names are limited to 50 characters, and free-text governance context fields are limited to 500 characters.
- `BR-04-19`: Store-detail metric counters for product-type count, import-country count, contact-channel count, and address count are not part of the implemented UI; the page prioritizes concrete values and actions instead of summary counts.
- `BR-04-22`: `REJECTED` stores are excluded from every public surface (listing, search, and the direct detail URL, which 404s) and from the order-creation store picker, but the row is retained (tombstone) so existing orders keep resolving against it.
- `BR-04-23`: Store removal is a tombstone, never a hard delete. A `removalReason` is persisted and drives the message shown on referencing orders: neutral by default (`FR-04-42`), with sanction wording only when the reason is an abuse category.
- `BR-04-24`: The "has reports" signal is **derived, never persisted**. A store with open reports stays publicly visible on listing, search, and detail, and its detail shows the report notice (`FR-04-43`) in addition to whatever its lifecycle state already shows. Nothing about reports is written onto the store row, no moderation status represents it, and **reports never affect indexing** (`BR-04-04` stays the only `noindex` rule). Only removal (`REJECTED`) hides a store. Rationale for keeping indexing out of it, so it is not re-added later: the banner clears instantly when a report is resolved, whereas re-indexing after removing a `noindex` takes days or weeks, so a false report would damage a store long after an administrator dismissed it. Deindexing an unreviewed `PENDING` store is prudence about what PandaTrack promotes, not a punishment; the strong lever for a genuinely harmful store is `Retirar` (`REJECTED`), so no intermediate SEO sanction is needed. See [ADR 0019](../../../design/decisions/0019-derived-trust-signals-moderation-status-lifecycle-only.md).
- `BR-04-25`: Raw report free-text and reporter identity are admin-only and must be read through a server-only admin data-access layer. The public governance read model (`BR-04-13`) must not be widened to serve them.
- `BR-04-26`: Change-request approval must rebase the stored diff onto the store's current state at approval time and apply relation fields (`contactChannels`, `addresses`, `productTypeKeys`, `importCountries`) transactionally. The stored diff must never be blind-applied, and detected drift must be surfaced to the administrator (`FR-04-47`).
- `BR-04-27`: After any store write, other open change requests on the same store whose diff is now empty against the new state are superseded (invalidated). This extends the no-op discard rule (`BR-04-16`) from the author's own edit to cross-request invalidation triggered by moderation and other writers.
- `BR-04-28`: Approving a product-type request authors a new entry into the global `StoreProductType` catalog with a generated `key` and localized names in both `es` and `en`. Catalog names follow a hybrid model: names authored at approval time are persisted as `nameEs` / `nameEn` columns on the catalog row (so runtime authoring works on a read-only filesystem), while the originally seeded catalog keys keep their names in the `storeProductTypes` i18n namespace. A single name resolver reads the database name first and falls back to the i18n namespace for seeded keys, so every render site resolves one canonical name per key regardless of origin.
- `BR-04-29`: Every admin moderation mutation is gated by `requireAdmin()` and writes an append-only `AdminAuditLog` entry using a stable action key. The audit entry stores identifiers and an optional non-sensitive reason only, never raw report text or reporter identity (`BR-01-04` of [PRD-03 (FRD-01)](../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md)). An action key may become **retired from writing** when its mutation is removed (`store.flag`, `store.unflag`); it stays in the vocabulary so historical entries keep resolving (`BR-01-05`).
- `BR-04-30`: The store detail "Pagos a esta tienda" card (`FR-04-58`) is scoped to `StorePayment` rows for this store and the signed-in viewer only. Deleting a row there is a **full-payment delete**, taking every `PaymentAllocation` declared against it with it, which is a materially different operation from an order detail's payment delete ([FRD-05 · `BR-05-10`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#business-rules)), which may leave a shared payment's other order declarations intact. A collector who wants to remove only their own order's slice of a payment shared across several orders must do so from that order's detail, not from this card.

## State Model

### Moderation state

Moderation state carries **lifecycle only**: where a store sits between submission and takedown. Trust
signals about a store's reports are derived at read time and are never encoded here ([ADR 0019](../../../design/decisions/0019-derived-trust-signals-moderation-status-lifecycle-only.md)).

- `PENDING`
- `APPROVED`
- `REJECTED`

### Derived trust signal (not a state)

- **Has open reports:** derived on every read from the store's count of `OPEN` `StoreReport` rows.
  At or above `STORE_REPORT_NOTICE_THRESHOLD` (1) the store detail renders the report notice
  (`FR-04-43`). It is not persisted, not a status, and not an admin toggle.

### Activity state

- `ACTIVE`
- `INACTIVE` (a closed store; set through the store edit flow via the same permission derivation as any other editable field, so a closure can be applied directly or suggested as a change request — see `FR-04-37`)

### Seller type (`Store.sellerType`, enum `SellerType`)

- `RETAILER` (was `BUSINESS`) — a business selling its own products; full catalog + contact info.
- `PERSON` — an individual reseller; catalog, no public contact info, may be private.
- `PROXY` — a forwarding/intermediary service; no catalog, keeps logo + contact info, always public.

### Presence state

- `ONLINE`
- `PHYSICAL`

### Moderation lifecycle and edit-path derivation

Moderation state is set at creation and otherwise changed only by admin moderation actions (the transitions beyond creation are defined in [Admin moderation transitions](#admin-moderation-transitions) below). Creation transitions:

| Creator     | Initial moderation state | Edit path for that creator             | Edit path for other authenticated users |
| ----------- | ------------------------ | -------------------------------------- | --------------------------------------- |
| Admin       | `APPROVED`               | direct edit                            | change request (`FR-04-29`)             |
| Normal user | `PENDING`                | direct edit (creator only, `FR-04-30`) | change request                          |

Edit path is **derived per viewer**, not stored: `canDirectlyEdit` = viewer is admin, or the store is `PENDING` and owned by the viewer. Any other authenticated viewer of an `APPROVED` store is routed through `StoreChangeRequest`. `REJECTED` is reachable only through admin moderation and stays a public 404 by design (`FR-04-41`, `BR-04-22`), so `getStoreBySlug` resolves only the two publicly visible lifecycle states (`PUBLIC_VISIBLE_STORE_STATUSES = ["PENDING", "APPROVED"]`). A store with open reports is **not** a distinct state: it resolves normally and additionally renders the derived report notice (`FR-04-43`). Slug never changes on a name change (`BR-04-03`); seller type (`sellerType`) and country are immutable through both edit paths (`BR-04-17`).

### Admin moderation transitions

Beyond creation, moderation state changes only through the admin inline controls (`FR-04-40`, `FR-04-41`), each gated by `requireAdmin()` and audited (`FR-04-51`). This scope is planned, not yet shipped.

| From                 | Admin action    | To         | Effect                                                                                                         |
| -------------------- | --------------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| `PENDING`            | approve         | `APPROVED` | sets `approvedByUserId` / `approvedAt`; store becomes SEO-indexable (`BR-04-05`)                               |
| `PENDING`/`APPROVED` | remove (reject) | `REJECTED` | sets `removalReason`; excluded from all public surfaces + order picker; row retained as tombstone (`BR-04-22`) |

There is no flag transition. The public report notice is derived from open reports, not from a state (`FR-04-43`, `BR-04-24`), so the only moderation gesture that touches it is resolving or dismissing the underlying reports (`FR-04-44`).

`REJECTED` is treated as a terminal tombstone in this scope: reinstating a removed store is not part of the inline controls. Governance-record transitions (report resolution, change-request review, product-type approval) are covered in [Governance record lifecycles](#governance-record-lifecycles) and the [admin moderation actions](#admin-moderation-actions) requirements.

### Governance record lifecycles

Three viewer-scoped governance records each enforce a one-open-per-store-per-user invariant via upsert:

- `StoreReport` — one open report per (user, store) (`BR-04-14`); admin resolution moves `OPEN` to `REVIEWED` or `DISMISSED` inline (`FR-04-44`), which then lets the user file a new report (`AC-04-12`). The count of `OPEN` rows is also what drives the public report notice (`FR-04-43`) and, at 2 or more, the moderation inbox's collapsed report-cluster row ([PRD-03 (FRD-02)](../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md) `FR-02-05`); both are derived reads, not stored fields.
- `StoreChangeRequest` — one open change request per (user, store) (`BR-04-15`); persists only changed fields and is discarded when no effective diff remains (`BR-04-16`, `AC-04-14`). Admin review either applies it (rebased against the store's current state, relation fields included, `FR-04-46`, status `APPROVED`) or rejects it (`REJECTED`), setting `reviewedByUserId` / `reviewedAt`; any store write can supersede other open requests, moving them to a terminal `SUPERSEDED` status with `reviewedAt` stamped and `reviewedByUserId` null since no human decided them (`FR-04-48`, `BR-04-27`). `StoreChangeRequestStatus` is therefore `PENDING | APPROVED | REJECTED | SUPERSEDED`.
- `StoreProductTypeRequest` — a request to add a new catalog product type, openable from create and edit (`FR-04-28`); admin approval authors the new type into the global catalog with a generated `key` and `es`/`en` names persisted on the catalog row (`FR-04-49`, `BR-04-28`), and rejection closes it without a catalog write. Resolution is audit-only: the request carries no reviewer columns and only its `status` flips to `APPROVED` / `REJECTED`; the reviewing administrator and timestamp are recorded by the `AdminAuditLog` entry. The review surface that invokes these actions is owned by the moderation console (**FRD-02** · WO-02, [`wo-02-moderation-inbox.md`](../../prd-03-admin-and-moderation/frd-02-moderation-console/bp-01-moderation-console/work-orders/wo-02-moderation-inbox.md)).

Admin transitions on these records are gated by `requireAdmin()` and audited (`FR-04-51`). Raw report free-text and reporter identity remain admin-only, read through a server-only admin data-access layer (`FR-04-45`, `BR-04-25`).

## Data Concepts

- `Store`
- `Country`
- `StorePresence`
- `StoreContactChannel`
- `StoreAddress`
- `StoreImportCountry`
- `StoreProductType`
- `StoreProductTypeAssignment`
- `StoreReview`
- `StoreNote`
- `StoreReport`
- `StoreProductTypeRequest`
- `StoreChangeRequest`

## Acceptance Criteria

### `AC-04-01` Create store as non-admin

- Given an authenticated non-admin user on the create-store form
- When they submit a valid new store
- Then the store is persisted with status `PENDING`
- And the user is redirected to `/{locale}/stores/[slug]`
- And the detail page shows the pending disclaimer

### `AC-04-02` Create store as admin

- Given an authenticated admin user
- When they submit a valid new store
- Then the store is persisted with status `APPROVED`
- And `approvedByUserId` and `approvedAt` are stored

## Implementation Notes

- The store listing remains URL-driven.
- Upstream navigation may construct listing URLs with prefilled country and product-type filters from user preferences, but the listing route must continue to treat the final URL as the canonical input state.

### `AC-04-03` Blur duplicate suggestions

- Given a user enters a store name with at least 2 trimmed characters
- When the name field loses focus
- Then the system shows up to 5 duplicate candidates with positive score across all countries
- And each candidate links to the existing store detail page

### `AC-04-04` Submit duplicate confirmation

- Given a user submits a store whose name is similar enough to an existing store in the same country
- When similarity is at least the configured threshold
- Then the system blocks immediate submit
- And shows a confirmation modal with duplicate candidates
- And allows either cancel or create-anyway

### `AC-04-05` Person-store visibility

- Given a public person-store detail page
- When the page loads
- Then public contact channels, addresses, and logo are not exposed in the payload or UI

### `AC-04-18` Proxy store has no catalog and keeps contact info

- Given the store create/edit form
- When the seller type is set to `PROXY`
- Then the product-type selection and the stock / pre-order (`hasStock` / `receivesOrders`) controls are hidden
- And on submit the store persists with empty product types and null `hasStock` / `receivesOrders`, regardless of any previously entered values
- And the logo, import countries, contact channels, and addresses are retained (rendered like a `RETAILER`)
- And the store is always public (the private toggle is not offered)

### `AC-04-19` Proxy store detail signals an intermediary

- Given a public detail page for a `PROXY` store
- When the page loads
- Then the store logo (not the person icon) is shown in the hero
- And a "Proxy" badge is shown near the store name
- And no product-type / stock / pre-order sections are rendered

### `AC-04-06` Pending visibility and SEO

- Given a store with status `PENDING`
- When it appears in listing and detail views
- Then it remains visible in-app
- And the detail view shows a pending disclaimer
- And the route metadata is non-indexable

### `AC-04-07` Listing filter logic

- Given multiple selected filter values in one family
- When listing is queried
- Then those values are treated with OR logic
- And different filter families are combined with AND logic

### `AC-04-08` Detail page reading order

- Given a public store-detail page
- When the page loads
- Then the hero shows identity context plus status and review summary
- And a compact sales/shopping summary appears directly under the hero
- And product types and import countries appear as sibling cards before contact channels and addresses
- And the page avoids a competing metadata right rail for low-priority facts

### `AC-04-09` Public reports-and-suggestions summary visibility

- Given a public store-detail page with existing reports or change-request activity
- When any visitor opens the `Reports and suggestions` summary UI
- Then they can see two primary sections: `Community reports` and `Change requests`
- And each section is structured so personalized viewer information appears before the aggregated community summary when the viewer has an open record
- And they can see report counts grouped by supported reason
- And they can see summaries of pending or historical change requests
- But they do not see requester identity or raw free-text report details from other users

### `AC-04-10` Update open store report

- Given an authenticated user who already has one open report for a store
- When they reopen the report flow and submit new details
- Then the existing report is updated
- And a second open report is not created
- And the `Reports and suggestions` summary surfaces that same viewer report with its submitted date, selected reason, optional description, and an edit CTA that reopens the report form preloaded

### `AC-04-11` Personalized pending change request summary

- Given an authenticated user who already has one pending change request for a store
- When they open the `Reports and suggestions` summary UI
- Then the personalized change-request panel shows the latest update timestamp, changed fields, optional comment, and a CTA to continue editing
- And the aggregated community change summary remains visible as a separate block after the personalized panel

### `AC-04-12` Re-report after resolution

- Given an authenticated user whose previous report for a store is already resolved
- When they submit a new report for that same store
- Then the system creates a new report record
- And the earlier resolved report remains in history

### `AC-04-13` Approved-store change request

- Given an authenticated non-admin user on `/stores/[slug]/edit` for an approved store
- When they submit one or more allowed field changes
- Then the system persists only the changed fields as a store change request
- And direct mutation of the approved store does not occur

### `AC-04-14` No-op change request cleanup

- Given an authenticated user with an open change request for a store
- When they edit that request until it no longer differs from the persisted store
- Then no effective change request remains stored for that user and store

### `AC-04-15` Pending-store direct edit ownership

- Given a pending store
- When the creator or an admin opens `/stores/[slug]/edit`
- Then they can directly edit the store
- But when another authenticated user opens that route
- Then they must follow the change-request path instead

### `AC-04-16` Closed stores hidden by default with opt-in filter

- Given a store marked as closed (inactive)
- When the public store listing is queried without the "show closed" filter
- Then the closed store is excluded from the results
- And when the viewer enables the "show closed" filter
- Then the closed store appears in the listing
- And the closed store is always reachable by its direct detail URL with the inactivity warning, regardless of the filter

### `AC-04-17` Mark store as closed through the edit flow

- Given the store edit form
- When an admin, or the creator of a still-`PENDING` store, toggles "mark store as closed" and saves
- Then the store is set inactive directly
- But when any other authenticated user toggles the same control on an approved store and saves
- Then the closure is recorded as a change request for moderation instead of applying immediately

### `AC-04-20` Approve a pending store inline

- Given an administrator on the detail page of a `PENDING` store
- When they use the inline approve control
- Then the store transitions to `APPROVED`
- And `approvedByUserId` and `approvedAt` are persisted
- And an `AdminAuditLog` entry with action key `store.approve` is written
- But a non-administrator invoking the same action is refused by `requireAdmin()` before any change runs

### `AC-04-21` Remove a store as a tombstone

- Given an administrator on the detail page of a `PENDING` or `APPROVED` store
- When they remove it with a `removalReason`
- Then the store transitions to `REJECTED` and the `removalReason` is persisted
- And the store no longer appears in the public listing, in search, or in the order-creation store picker
- And its direct detail URL returns 404
- And the store row is retained (not hard-deleted) so referencing records still resolve
- And an `AdminAuditLog` entry with action key `store.remove` is written

### `AC-04-22` Order referencing a removed store still renders

- Given a collector order that references a store now `REJECTED`
- When the collector opens that order
- Then the order still renders
- And its store surface shows the neutral tombstone message by default ("Esta tienda ya no esta disponible")
- And when the `removalReason` is an abuse category, the sanction wording is shown instead

### `AC-04-23` Report notice appears and clears automatically

- Given a publicly visible store with no open reports
- When any visitor opens its detail page
- Then no report notice is shown
- And when one authenticated user files a report on that store
- Then every viewer of that detail page, signed in or anonymous, sees the report notice
- And the store keeps its moderation status, stays in the listing and in search, and its metadata is **not** `noindex` if it was `APPROVED`
- And when an administrator resolves or dismisses that store's last open report
- Then the notice and its derived chip are gone on the next read, with no separate action and no write to the store row
- And no control anywhere in the product sets or clears the notice by hand

### `AC-04-24` Resolve or dismiss a report inline

- Given an administrator viewing an open store report in the governance panel
- When they resolve or dismiss it
- Then the `StoreReport` transitions from `OPEN` to `REVIEWED` or `DISMISSED`
- And the reporter may then file a new report for that store (`AC-04-12`)
- And an `AdminAuditLog` entry with action key `report.resolve` or `report.dismiss` is written

### `AC-04-25` Raw report details are admin-only

- Given a store report with free-text detail and a known reporter
- When an administrator opens it through the server-only admin data-access layer
- Then they can see the raw free-text and the reporter identity
- But the public governance read model exposes neither to non-admin viewers (`BR-04-13`, `BR-04-25`)

### `AC-04-26` Change-request approval rebases against current state

- Given an administrator approving an open `StoreChangeRequest`
- When the request applies cleanly to the store's current state
- Then the diff is re-derived against that current state and applied in one transaction, including relation fields (`contactChannels`, `addresses`, `productTypeKeys`, `importCountries`)
- And `reviewedByUserId` and `reviewedAt` are persisted
- And an `AdminAuditLog` entry with action key `changeRequest.apply` is written

### `AC-04-27` Change-request drift is surfaced, not blind-applied

- Given an open `StoreChangeRequest` whose stored diff was computed against an older store state
- When the store's current state has since changed (`store.updatedAt > changeRequest.updatedAt`)
- Then a store-level "changed since filed" banner is shown, any field whose current value already equals the proposal is tagged "already applied" and excluded, and only the changes that still have effect are applied
- And the stored values are never silently applied (the richer per-field three-value conflict view is deferred to the moderation console behind a base-snapshot decision, `FR-04-47`)

### `AC-04-28` Other open change requests are superseded after a store write

- Given two open change requests on the same store
- When any store write (direct edit, an applied change request, or a moderation transition) lands
- Then each remaining open request whose diff is now empty against the new state moves to `SUPERSEDED` (invalidated), while a request that still has a non-empty diff stays `PENDING`

### `AC-04-29` Product-type request approval authors the catalog

- Given an administrator approving a `StoreProductTypeRequest`
- When the approval succeeds
- Then a new `StoreProductType` entry exists with its generated `key` and localized `nameEs` / `nameEn` values, and it is immediately selectable in create/edit and usable as a listing filter through the name resolver
- And an `AdminAuditLog` entry with action key `productType.approve` is written
- But rejecting the request closes it with no catalog write (`productType.reject` audited)

### `AC-04-30` Every moderation action is gated and audited

- Given any admin moderation mutation on a store or governance record
- When it runs
- Then `requireAdmin()` authorizes it before any write
- And an append-only `AdminAuditLog` entry is written with the matching action key and no raw report text or reporter identity

### `AC-04-31` Pending disclaimer reads as non-alarmist review copy

- Given a `PENDING` store detail page
- When the pending disclaimer renders
- Then it frames the store as under review ("en revision"), not as unverified or untrustworthy data

## Current Implementation Notes

- Canonical route in code today is `/stores/[slug]`, not `/store/[slug]`.
- Listing currently supports `q`, `productType`, `category`, `country`, `importCountry`, `presence`, `receivesOrders`, `hasStock`, `includeClosed`, and `page`. `includeClosed=true` opts into showing closed (inactive) stores; by default `buildPublicStoreListingWhere` adds `isActive: true` so closed stores are hidden. The "show closed" control lives in the filter drawer's "Other" switch group alongside `receivesOrders` and `hasStock`.
- Duplicate scoring ignores generic-only terms such as `store`, `shop`, `tienda`, and similar terms unless the normalized name is effectively exact.
- The full set of implemented analytics events for store flows is enumerated in the [Analytics](#analytics) section (the `POSTHOG_EVENTS.STORE` namespace).
- Moderation status chips are **not** rendered on store cards in the public listing (redesign decision S6.1); status chips appear only on the store detail page for the owner/admin.
- Contact channels and addresses use a staged-add pattern in the create/edit forms: the user opens a sub-form, confirms, and the entry is appended — no empty rows are inserted automatically.
- The listing **sort selector is currently a visual no-op**: `StoreListingFilters` writes a `sortBy` value (`topRated` / `alphabetical` / `newest`) into the URL, but `parseListingSearchParams` never reads it and `getPublicStoresListingPage` always orders by a hardcoded `[averageRating desc, reviewCount desc, name asc]`. The control changes the URL without changing result order.
- Person-store field exclusion (logo, contact channels, addresses) is enforced at the **application layer**, not the query: `getStoreBySlug` selects those columns for every store, but only attaches them to the returned payload when `sellerType !== "PERSON"` (i.e. for `RETAILER` and `PROXY`).
- Moderation status chips on store detail state the lifecycle (`En revisión` / `Aprobada`). The "Con reportes" chip beside them is a **derived** trust signal read from the open-report count, not a status (`FR-04-43`).
- Order creation uses a separate, narrower query, `getOrderableStores` (`src/lib/data/stores/storeQueries.ts`, filtered to `visibility: "PUBLIC"`, `status: { in: ["PENDING", "APPROVED"] }`, and `isActive: true`, ordered by name), to populate the store picker — distinct from the public discovery listing queries, also in `src/lib/data/stores/storeQueries.ts`.

## Screens and Data Contract

All store screens live under the collector app shell at `/{locale}/(app)/stores`. Unlike orders and deliveries, the store routes are **partially anonymous**: the listing and detail pages render for unauthenticated visitors (no redirect to sign-in), and viewer-scoped data (reviews, notes, governance viewer context, viewer order activity) is loaded only when a session is present. Mutations always require authentication. Visual layout is owned by the [FDD](fdd-04-store-domain.md); this section fixes purpose, data loaded (named queries), server actions invoked, and states.

### List — `/{locale}/stores`

- **Purpose:** the public store directory and discovery surface, browsed as a responsive card grid.
- **Data loaded:** filter chrome and the heavy listing are split into separate Suspense boundaries so chrome renders instantly:
  - chrome (eager): `listActiveStoreProductTypeKeys(prisma)` and `listCountryCodes(prisma)` feed the filter drawer; `getSession()` resolves the optional viewer.
  - count (suspended skeleton): `countPublicStores(prisma, filters)` for the heading count.
  - grid (suspended): `getPublicStoresListingPage(prisma, filters)` (25/page by default via `DEFAULT_PAGE_SIZE`, user-selectable — 10/25/50/100, `PAGE_SIZE_OPTIONS` — via `?perPage=`; **Updated 2026-07-23, owner-approved:** replaces the earlier store-only `DEFAULT_PUBLIC_STORE_PAGE_SIZE` of 12, unifying the default with orders/deliveries, see [ADR 0018](../../../design/decisions/0018-list-pagination-page-size-and-desktop-summary.md)); when a viewer is present and the page has items, `getViewerOrderCountsByStoreSlugs(prisma, userId, slugs)` adds the per-card viewer order count.
- **Filters / URL:** `q`, `productType`, `category`, `country`, `importCountry`, `presence`, `sellerType`, `receivesOrders`, `hasStock`, `onlyOwnPrivate`, `page`, `perPage` (parsed by `parseListingSearchParams`, which drops any `sellerType` value outside the three real kinds rather than passing it down to a Prisma enum filter). Multi-value families use OR; families combine with AND (`FR-04-14`/`FR-04-15`). Any non-`PUBLIC` store is excluded at the query level, and so are other people's private person stores; the viewer's own private stores are included and marked on the card (`BR-04-21`, `BR-04-21a`, `FR-04-13c`). Pagination links preserve all active params and omit `page` when it is `1` and `perPage` when it equals the default (`25`); changing `perPage` resets the URL to page `1`.
- **Actions:** navigation only — `New delivery`-style primary `Nueva tienda` → `/new`; each card is a whole-card `<a>` to `/{slug}`. No mutations on this route.
- **States:** loading via per-section Suspense skeletons (card-grid skeleton on initial server load and on filter/sort/page transitions via `useTransition`; SSR-delivered, no fake client fallback); empty-initial (directory is seeded, but the same empty surface renders with an accent icon and no clear-filters CTA when `totalCount === 0` and no filters are active); empty-filtered (`totalCount === 0` with active filters → `EmptyState` with a ghost `Limpiar filtros` link back to `/{locale}/stores`).

### Detail — `/{locale}/stores/[slug]`

- **Purpose:** inspect one store's trust context and run viewer governance actions.
- **Data loaded:** `getStoreBySlug(prisma, slug)` (public detail payload; Person stores omit logo, contact channels, and addresses per `FR-04-21`/`FR-04-23`) and `getEditableStoreBySlug(prisma, slug)` (ownership/status for edit-route gating); both must resolve or the route 404s. Then, in parallel: `getStoreGovernanceSummary(prisma, storeId)` (always, even anonymous — public reports/change-request summary per `BR-04-12`/`BR-04-13`); and, **only when a session exists**, `getPublicStoreReviews(prisma, storeId, userId, reviewCount)`, `getStoreViewerContext(prisma, storeId, userId)` (the viewer's own review + private note), `getStoreGovernanceViewerContext(prisma, storeId, userId)` (the viewer's own open report + open change request), `getViewerStoreActivity(prisma, userId, storeId)` (order totals and spend by currency for the aside), **and, added 2026-08-08 (`FR-04-55`/`FR-04-58`),** `getStoreDebtByCurrency(userId, storeId)` (the "Deuda pendiente" rows, [FRD-05 `FR-05-43`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements)) and `getStorePaymentsForStore(userId, storeId)` (the "Pagos a esta tienda" list). Because the community-reviews fetch is session-gated, anonymous visitors load an empty review list and see no community reviews (`FR-04-24`/`BR-04-07`); the two payment queries are likewise only run for a signed-in viewer, since they are viewer-scoped debt/payment data. The detail payload also carries `openReportCount` (the store's `OPEN` `StoreReport` count) so the derived report notice can render without a second round trip (`FR-04-43`). `generateMetadata` calls `getStoreBySlug` and marks `PENDING` stores `noindex` (`BR-04-04`); it deliberately does not read the report count, because reports never affect indexing (`BR-04-24`).
- **Server actions:** `saveStoreReviewAction` (create/update one review), `deleteStoreReviewAction`, `saveStoreNoteAction` (upsert/clear the private note), `saveStoreReportAction` (create/update one open report). Edit is route navigation to `/[slug]/edit` (gated by `canAccessEditRoute` = signed in). Product-type requests (`saveStoreProductTypeRequestAction`) are only reachable from the create/edit wizard catalog step, not from this route. **Added 2026-08-08:** `createStorePaymentAction` (the store payment sheet's own submit, opened from `FR-04-56`'s "Registrar pago" action; mechanics owned by [FRD-05 · `FR-05-42`/`FR-05-43`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements)) and `deleteStorePaymentAction` (the "Pagos a esta tienda" card's own delete, `FR-04-58`).
- **Edit-eligibility flags computed on the server:** `canAccessEditRoute` (session present) and `canDirectlyEdit` (admin, or `PENDING` store owned by the viewer — `FR-04-30`).
- **Planned admin inline controls (`FR-04-40` through `FR-04-51`, not yet shipped):** for an administrator viewer, the detail page gains inline moderation controls (approve, remove with `removalReason`) and inline resolution of reports and change requests from the governance panel, each gated by `requireAdmin()` and audited. There is no flag control: the report notice is derived (`FR-04-43`) and is cleared by resolving the reports themselves. `REJECTED` stores continue to 404 by design.
- **States:** pending disclaimer banner for `PENDING` stores (`FR-04-18`); **derived report notice** for any store with at least one open report, shown to every viewer independently of moderation status and stacked after the pending disclaimer when both apply (`FR-04-43`, `BR-04-24`); inactivity warning for `INACTIVE` stores (`FR-04-19`); Person-store reduced-field variant (`AC-04-05`); a `Lock`-icon info `AlertBanner` shown above the layout when the store `isPrivate` (the creator's own private Person store); **404 (not 403)** when the slug does not resolve, including `REJECTED` stores, which `getStoreBySlug` excludes through `PUBLIC_VISIBLE_STORE_STATUSES`, and additionally when a `private` Person store is requested by anyone other than its creator or an admin (`BR-04-21`, [ADR 0009](../../../design/decisions/0009-private-person-stores.md)). `returnTo` (validated by `safeRelativeReturnTo`) and `returnLabel` drive the back link; when arriving from an order, the back link uses the `storeListing.backToOrder` variant ("Volver al pedido {orderId}" / "Back to order {orderId}") instead of the default "back to listing" label.

### Create — `/{locale}/stores/new` (optional `?returnTo=`)

- **Purpose:** create one store via the 5-step wizard with duplicate protection.
- **Data loaded:** `listCountryCodes(prisma)` and `listActiveStoreProductTypeKeys(prisma)` for the country and category pickers. No session pre-check on the page itself; the create action enforces authentication.
- **Actions:** `createStoreAction` (final submit); `getDuplicateCandidatesAction` is called from the client on name blur — it runs `findDuplicateCandidates` (cross-country, blur suggestions, `AC-04-03`) and, at submit, `findDuplicateCandidatesInCountry` (same-country at/above the similarity threshold, `AC-04-04`/`BR-04-08`/`BR-04-09`).
- **States:** wizard step autosave to `localStorage`; inline name-error variant; blur duplicate suggestions; submit duplicate-confirmation modal; logo crop-and-confirm modal (RETAILER and PROXY only, `FR-04-31`); category-request modal (`FR-04-28`, hidden for PROXY per `FR-04-38`). On success, normal users persist `PENDING` and admins persist `APPROVED`, then redirect to `/{locale}/stores/[slug]` (`BR-04-10`).

### Edit — `/{locale}/stores/[slug]/edit`

- **Purpose:** edit a store directly (creator of a `PENDING` store, or admin) or submit a change request (any other authenticated user editing an `APPROVED` store).
- **Guard:** `getSession()` must resolve a user and `getEditableStoreBySlug` must return a store, else **404**. Type and country are immutable (`BR-04-17`).
- **Data loaded:** `getEditableStoreBySlug(prisma, slug)`; `getStoreGovernanceViewerContext(prisma, storeId, userId)` for any existing open change request; `listCountryCodes` + `listActiveStoreProductTypeKeys`. Initial form values are produced by `mergeEditableStoreWithChangeRequest(store, openChangeRequest?.changes)` so a returning user resumes their pending change request.
- **Actions:** `saveStoreEditAction`. When `canDirectlyEdit`, it calls `updateStoreEditableFields` and redirects to detail; otherwise it calls `upsertStoreChangeRequest`, which persists only changed fields (`BR-04-16`) and **discards/deletes the request when no effective diff remains** (`AC-04-14`) before redirecting to detail.
- **States:** direct-edit vs change-request mode (decided by `canDirectlyEdit`); inline field validation; logo upload (direct mode writes the live object key, change-request mode stages a pending object key).

## Error Contract

Store mutations are Server Actions that return a typed result discriminated by `success`; expected failures are returned as a stable `error` string (plus optional `fieldErrors` keyed by form field) rather than thrown, so the client can recover without noisy monitoring. `redirect()` is rethrown via `unstable_rethrow`; unexpected logo/storage failures are captured once in Sentry with store-safe context. Expected `error` codes by action:

| Action (`*Action`)            | Expected `error` codes                                                                                                                                                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createStore`                 | `unauthorized`, `validation_failed` (with `fieldErrors`), `countryInvalid`, a `StoreLogoError.code` / `logoUploadFailed` (RETAILER/PROXY logo), `create_failed` (slug-collision retries exhausted)                                                                    |
| `saveStoreEdit`               | `unauthorized`, `validation_failed`, `storeUnavailable`, a `StoreLogoError.code` / `logoUploadFailed`, `saveEditFailed`                                                                                                                                               |
| `saveStoreReview`             | `unauthorized`, `validation_failed`, `storeUnavailable`, `saveReviewFailed`                                                                                                                                                                                           |
| `deleteStoreReview`           | `unauthorized`, `validation_failed`, `reviewNotFound`, `deleteReviewFailed`                                                                                                                                                                                           |
| `saveStoreNote`               | `unauthorized`, `fieldErrors` (validation), `storeUnavailable`, `saveNoteFailed`                                                                                                                                                                                      |
| `saveStoreReport`             | `unauthorized`, `validation_failed`, `storeUnavailable`, `saveReportFailed`                                                                                                                                                                                           |
| `saveStoreProductTypeRequest` | `unauthorized`, `validation_failed`, `saveProductTypeRequestFailed`                                                                                                                                                                                                   |
| `deleteStorePayment`          | `unauthorized`, `validation`, `NOT_FOUND`, `server_error` (`FR-04-58`; the store payment sheet's own `createStorePayment` errors are defined by [FRD-05 §Error Contract](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#error-contract), not here) |

Notes:

- `validation_failed` is the generic Zod-boundary rejection; the granular per-field messages travel in `fieldErrors` (e.g. `name`, `countryCode`, `logo`).
- `storeUnavailable` covers the store being missing or no longer mutable when the action runs (concurrent moderation/deletion).
- The change-request path never returns a distinct "no-op" error: a change request with no effective diff is silently discarded and the action still redirects to detail (`AC-04-14`), emitting `store_change_request_noop_discarded`.
- One-open-record invariants (`BR-04-14` one open report, `BR-04-15` one open change request per store) are enforced by upsert in the query layer rather than a dedicated error code; resubmitting updates the existing open record instead of creating a second one.

## Analytics

Store events are namespaced under `POSTHOG_EVENTS.STORE` in `src/lib/constants.ts`. The full implemented set:

- **create / duplicate flow:** `store_created`, `store_duplicate_suggestions_shown`, `store_duplicate_submit_modal_shown`
- **listing:** `store_searched`
- **logo:** `store_logo_upload_started`, `store_logo_upload_succeeded`, `store_logo_upload_failed`, `store_logo_removed`
- **reviews:** `store_review_write_clicked`, `store_review_edit_clicked`, `store_review_saved`, `store_review_deleted`
- **private note:** `store_note_saved`
- **governance — reports:** `store_report_opened`, `store_report_submitted`
- **governance — product-type requests:** `store_product_type_request_opened`, `store_product_type_request_submitted`
- **governance — change requests:** `store_change_request_edit_entered`, `store_change_request_submitted`, `store_change_request_noop_discarded`
- **governance — summary panel:** `store_governance_summary_opened`, `store_governance_summary_continue_change_request_clicked`
- **store-level payments (added 2026-08-08, `FR-04-56`/`FR-04-58`):** `store_payment_sheet_opened`, `store_payment_registered`, `store_payment_deleted`. These are fired from store-detail entry points defined by this FRD, but the sheet's own submission mechanics belong to [FRD-05 · `FR-05-42`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements), which is why FRD-05's own Analytics section also references this namespace instead of duplicating the events.

Planned admin-moderation events (user-visible inline actions, `PENDING`): the moderation mutations must each emit an event alongside their `AdminAuditLog` entry so the console and product analytics can measure moderation throughput:

- **moderation — store state:** `store_approved`, `store_removed`
- **moderation — reports:** `store_report_resolved`, `store_report_dismissed`, each carrying an `open_reports_remaining` count so a resolution that reached `0` is identifiable as the one that cleared the store's public report notice (`FR-04-43`)
- **moderation — change requests:** `store_change_request_applied`, `store_change_request_rejected`
- **moderation — product-type requests:** `store_product_type_request_approved`, `store_product_type_request_rejected`

These moderation events carry the `store_slug` (or request identifier) and an action-scoped context (for example the `removalReason` category for `store_removed`, or `applied_field_count` for `store_change_request_applied`), but never raw report free-text or reporter identity.

Mutation events carry context counts and identifiers (e.g. `store_slug`, `flow`, `mode` direct/change-request, `changed_field_count`, `deleted_existing`, logo `error_code`) but never the free-text note, report description, or change-request comment values.

> Adjacent surface: the order detail "view store" affordance fires `order_view_store_clicked` under `POSTHOG_EVENTS.ORDER`, not the `STORE` namespace.

## Planned Enhancements

- `FR-04-33` / `FR-04-34` (private person stores) were implemented in the S6 redesign: `isPrivate` boolean added to `Store`, creation-form toggle shown only when type is `PERSON`, and listing/search exclusion logic. No equivalent flag exists for `RETAILER` or `PROXY` stores (both are always public). See the Current State list.
- **Admin moderation actions (planned, `FR-04-40` through `FR-04-51`):** the inline moderation controls on the store surfaces (approve, remove/tombstone with `removalReason`, report resolution, change-request rebase-apply, product-type approval) plus the softened pending disclaimer. This scope moves the FRD to `PARTIALLY_IMPLEMENTED`: the discovery, creation, visibility, and community-governance-submission scope is shipped, while the admin-side moderation lifecycle is planned. It depends on the platform in [PRD-03 (FRD-01)](../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md) and is delivered by [BP-01](bp-01-store-public-trust-system/bp-01-store-public-trust-system.md) work orders `WO-09` through `WO-12`. One exception in the store-approval slice ([BP-01 · WO-09](bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md)): the store-side transitions and the `removalReason` persistence are owned there, but the order-side rendering of a removed store (`FR-04-42` / `AC-04-22`) is delivered in the collector order domain by [FRD-05 · BP-02 · WO-08](../frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/work-orders/wo-08-order-side-removed-store-tombstone.md), which consumes the `removalReason` this FRD defines.

- **Derived report notice and flag removal (planned, `FR-04-43` amended):** the public "this store has reports" warning becomes automatic and derived from open reports, the manual flag/unflag control and the `FLAGGED` moderation status are removed, and reports stop affecting indexing. Delivered by [BP-01 · WO-13](bp-01-store-public-trust-system/work-orders/wo-13-derived-report-notice-and-flag-removal.md), which also carries the matching moderation-console changes; the durable principle is recorded in [ADR 0019](../../../design/decisions/0019-derived-trust-signals-moderation-status-lifecycle-only.md). The flag/unflag bullets in [WO-09](bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md) are superseded by it.

## Cross-domain notes

- **Admin platform, [PRD-03 (FRD-01) Admin Identity and Access](../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md):** every moderation action here (`FR-04-40` through `FR-04-51`) is gated by that FRD's `requireAdmin()` helper and the durable `role` on `User`, and writes an append-only `AdminAuditLog` entry through `writeAuditEntry()` using the shared action-key vocabulary (`store.approve`, `store.remove`, `report.resolve`, `report.dismiss`, `changeRequest.apply`, `changeRequest.reject`, `productType.approve`, `productType.reject`, plus the retired-from-writing `store.flag` / `store.unflag`, `BR-01-05`). The foundation is [FRD-01 · WO-01](../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/work-orders/wo-01-role-admin-plugin-and-audit-foundation.md).
- **Moderation console, [PRD-03 (FRD-02) Moderation Console](../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md):** the admin inbox at `/[locale]/admin` aggregates what is pending (pending stores, open reports, pending change requests, pending product-type requests) and routes the administrator to the inline controls defined here. The console is a router; it does not implement these actions (`BR-02-02`). Its collapsed report-cluster row (2 or more open reports on one store, `FR-02-05`) reads the same `OPEN` `StoreReport` count that drives this FRD's public notice, at a separate, independently tunable threshold (`FR-04-43`, [ADR 0019](../../../design/decisions/0019-derived-trust-signals-moderation-status-lifecycle-only.md)).
- **Creator notification, [FRD-09 Reminders and Notifications](../frd-09-reminders-and-notifications/frd-09-reminders-and-notifications.md):** when a store is removed (rejected, `FR-04-41`), the notification that informs the store's creator is owned by FRD-09 (the notification delivery surface), not by this FRD. This FRD owns the state transition and the `removalReason`; FRD-09 owns whether and how the creator is notified.
- **Order-side removed-store tombstone, [FRD-05 Order, Payment, and Shipment](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md):** `FR-04-42` / `AC-04-22` (a collector order that references a `REJECTED` store keeps rendering, showing the neutral tombstone message by default and sanction wording only for an abuse `removalReason`) are a requirement of this FRD but are delivered in the order domain by [FRD-05 · BP-02 · WO-08](../frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/work-orders/wo-08-order-side-removed-store-tombstone.md). That slice depends on the `removalReason` field and the `REJECTED` status introduced by [BP-01 · WO-09](bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md).
- **Store-level payments, [FRD-05 Order, Payment, and Shipment](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md):** `FR-04-55` through `FR-04-58` (the store detail page's debt rows, "Registrar pago" entry point, "Ver mis pedidos en esta tienda" link, and "Pagos a esta tienda" card) are requirements of this FRD, but the money model they present, i.e. `StorePayment`, declared `PaymentAllocation`, the debt/credit derivation, and the `StorePaymentSheet` component itself, is defined and owned by [FRD-05](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements) (`FR-05-42` through `FR-05-44`) per [ADR 0025](../../../design/decisions/0025-store-level-payments-declared-allocations.md). This FRD never re-specifies allocation rules, debt-ceiling checks, or the sheet's own submit contract; it only defines what the store-detail surface shows and where it opens the sheet from.

## Open Questions

- Approved-store logo replacements must stage assets outside the live public object key until moderation applies them.
- Whether a `REJECTED` store can ever be reinstated by an administrator, or whether removal is permanently terminal (the current inline-controls scope treats it as terminal).

The prior open question on moderation-state lifecycle is now resolved: the transitions beyond creation are defined by the admin moderation scope (`FR-04-40` through `FR-04-51`, the [Admin moderation transitions](#admin-moderation-transitions) table) and the console that routes to them ([PRD-03 (FRD-02)](../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md)).

## Source Signals Used For Reverse Engineering

- `src/lib/data/stores/storeQueries.ts`
- `src/lib/data/stores/storeGovernanceQueries.ts`
- `src/lib/data/stores/storeGovernanceMutations.ts`
- `src/app/[locale]/(app)/stores/**/*`
- `src/lib/store/*`
- `src/lib/data/stores/_tests/store.integration.test.ts`
- `e2e/stores.spec.ts`
- `e2e/store-listing.spec.ts`
- `src/app/[locale]/(app)/stores/[slug]/_components/StoreDebtSummaryRows.tsx`
- `src/app/[locale]/(app)/stores/[slug]/_components/StoreRegisterPaymentButton.tsx`
- `src/app/[locale]/(app)/stores/[slug]/_components/StorePaymentStateProvider.tsx`
- `src/app/[locale]/(app)/stores/[slug]/_components/StorePaymentsSection.tsx`
- `src/lib/data/orders/storePaymentQueries.ts`
- GitHub issues `#68`, `#74`, `#75`, `#76`

## Linked Blueprint

- `docs/product/prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/bp-01-store-public-trust-system.md`
