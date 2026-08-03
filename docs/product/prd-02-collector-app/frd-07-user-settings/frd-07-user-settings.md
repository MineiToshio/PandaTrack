---
id: FRD-07
type: FRD
slug: user-settings
title: User Settings and Account Preferences
status: ACTIVE
parent: PRD-02
children:
  - BP-01
last_updated: 2026-08-03
source_features:
  - FEAT-0013
implementation_status: IMPLEMENTED
---

# FRD-07 User Settings and Account Preferences

## Overview

This FRD defines the self-service settings layer for the PandaTrack collector workspace.

It covers:

- identity visibility inside the private shell
- profile basics such as username, name, and image
- account entry controls such as password setup/change and email-change rules
- collector preferences such as country, base currency, product types, and budget defaults
- the preference contract that can later drive store discovery defaults and other personalization

## Domain Goal

Give every authenticated collector one clear place to manage their account identity and the minimum preferences needed for a personalized MVP workflow.

## Current State

### Implemented

- private collector shell with lower navigation areas in the sidebar and drawer
- app-shell drawer and sidebar navigation framework with lower-shell identity trigger and account menu entry to `Settings`
- shell identity surface showing avatar plus username in the lower shell navigation area (desktop and mobile drawer); the surface reflects the latest values on each full load (it is not refreshed in-session after a settings profile edit — see `FR-07-13`)
- dedicated settings page on one route exposing `Profile`, `Account`, and `Preferences` sections
- `Account` section for provider-aware email and password flows (see `WO-04`)
- profile basics in `Profile`: username save flow (format validation, debounced availability, seven-day limit stated in field helper, server-enforced uniqueness and rate limit), display-name save flow, profile image upload/replace (persist on crop-modal confirm), and remove (confirmation modal); success feedback via toasts; field-level errors below inputs per `docs/design/interface-patterns.md`
- unique username persistence and editing (aligned with `WO-01` / `WO-03`)
- user-uploaded profile image pipeline backed by Cloudflare R2 (`user-images/{userId}.webp`)
- Better Auth account foundation with email/password and Google
- current user model fields for `name`, `email`, `emailVerified`, and `image`
- current verification banner and seven-day blocking lifecycle
- seeded country and store product-type catalogs that can be reused by settings
- redesigned settings vertical (`SettingsShell` + `SettingsNav`) exposing `Profile`, `Account`, and `Preferences` on one route, with vertical tabs on desktop and a sticky segmented control on mobile (see `BR-07-01` note)
- six adaptive modals (username with live cooldown, display name with counter, avatar with circular crop, avatar removal, email change, password change with inline rules and strength meter); the base-currency change is **not** a modal — it is an inline explicit-confirm select in the `Preferences` pane (`FR-07-20`, `FR-07-32`)
- collector preferences persisted on `User` (`WO-05`): preferred country, base currency, preferred product types, and budget amount plus reset day, saved through autosaving server actions; the base-currency change is gated behind the `FR-07-32` confirmation flow rather than the autosave path
- avatar crop reuses the shared `ImageCropper` module (circular avatar / rectangular store logo) extracted from the store-logo pattern
- store-entry defaults derived from saved user preferences (`WO-06`, `FR-07-28`): the private `Stores` nav item href is recomputed per render from the user's saved preferred country and product types by the shared `buildStoresNavHref` builder (`src/app/[locale]/(app)/_utils/storesNavHref.ts`), wired in `src/app/[locale]/(app)/layout.tsx` and consumed by both the sidebar and the drawer nav; catalog-invalid saved codes are dropped at build time and `parseListingSearchParams` URL encoding (repeated `country` / `productType` keys) is honored

## User Stories

### US-07-01 Recognize myself in the app

As a collector, I want to see my avatar and username in the private shell so I always know which account I am using.

### US-07-02 Manage my identity safely

As a collector, I want to update my username, name, photo, password, and in some cases my email so I can keep my account current without support.

### US-07-03 Set preferences once and reuse them

As a collector, I want to save my country, preferred currency, collected product types, and budget defaults so the app can align to how I buy.

### US-07-04 Keep auth-method rules consistent

As a product owner, I want settings behavior to respect whether a user signed up with credentials, Google, or both so identity handling stays predictable.

## Functional Requirements

- `FR-07-01`: The private collector shell must show the authenticated user's avatar and username instead of a plain sign-out label in both desktop and mobile navigation surfaces.
- `FR-07-02`: The user menu opened from the shell identity surface must expose `Settings`, `Sign out`, `Privacy Policy`, and `Terms and Conditions` in MVP.
- `FR-07-03`: Every user account must have a stored username.
- `FR-07-04`: Usernames must be unique across the platform using case-insensitive comparison.
- `FR-07-05`: Usernames must allow only letters, numbers, and single hyphen separators, must reject spaces, must reject leading and trailing hyphens, and must reject consecutive hyphens.
- `FR-07-06`: Usernames must be between 3 and 30 characters inclusive.
- `FR-07-07`: The system must auto-generate a valid default username for newly created accounts using the email local part plus a random suffix, with a safe fallback when normalization cannot satisfy the format rules.
- `FR-07-08`: The settings page must let the user edit username through a dedicated save flow with inline format validation, availability feedback, and uniqueness enforcement before persistence. Field helper text under the username control must state that successful username changes are limited to at most one every seven days (see `FR-07-33`).
- `FR-07-09`: The settings page must let the user edit their display name as a single free-form field with trim handling, a maximum length of `50` characters, and reserved-name, PandaTrack brand, and blocked-token protections.
- `FR-07-10`: The settings page must let the user upload, replace, and remove a profile image using the same crop-and-confirm interaction pattern already used for store logos. **Successful upload or replacement persists when the user confirms in the crop modal** (no separate “save photo” step after cropping). **Removal requires explicit confirmation in a modal** that explains the effect and that the exact image cannot be restored, while a new upload remains possible.
- `FR-07-11`: Profile images uploaded by the user must be stored in Cloudflare R2 under the `user-images` namespace and keyed to the user identity so later uploads replace the current asset.
- `FR-07-12`: When a user has no profile image, avatar fallbacks must use the username initial, including after a collector intentionally removes a Google-provided or user-uploaded avatar.
- `FR-07-13`: Successful username and avatar changes in settings update the settings pane's own local state immediately. As implemented, the shell identity surface (avatar + username in the lower navigation area) is **not** refreshed in-session: `SettingsProfilePane` never calls the shell identity context, so the shell shows the updated value only after the next full load. Live shell refresh remains a future enhancement.
- `FR-07-14`: Accounts created with email/password must be able to change their email address through a dedicated flow that includes a confirmation modal.
- `FR-07-15`: After a successful email change for an email/password account, the new email becomes the credential-login identifier.
- `FR-07-16`: Changing the email for an email/password account must restart the current verification lifecycle, including the existing verification banner, resend action, and seven-day block.
- `FR-07-17`: Accounts created with Google must not be allowed to change email inside PandaTrack in MVP.
- `FR-07-18`: Accounts created with Google must be able to set a password while keeping the same email.
- `FR-07-19`: Accounts that have both Google and credential access must follow the Google email rule in MVP and therefore must not be allowed to change email inside PandaTrack.
- `FR-07-20`: The settings page must let each user define one base currency.
- `FR-07-21`: The settings page must let each user define one preferred country.
- `FR-07-22`: The settings page must let each user define multiple preferred product types using the seeded store product-type catalog.
- `FR-07-23`: The user-facing copy for preferred product types must ask `What types of products do you collect?`
- `FR-07-24`: The settings page must let each user define one active budget amount in the same currency as the base currency. The collector enters it in **whole currency units** with **no fractional subunits** (minimum `1`, upper bound enforced by validation). It is **persisted in minor units**, like every other money field in the app (`Order.totalCost`, `OrderPayment.amount`) — the settings boundary multiplies on save and divides on prefill, and both validation and a database `CHECK` enforce that the stored value is a whole number of major units.
- `FR-07-25`: The settings page must let each user choose whether the budget resets at month end or on one specific day of the month.
- `FR-07-26`: When the configured reset day does not exist in a given month, the system must use the last day of that month.
- `FR-07-27`: The persistence and architecture for budget settings must be prepared to support multiple budgets later even though MVP exposes only one active budget.
- `FR-07-28`: Entering the `Stores` listing from the private app navigation must prefill the listing URL with the user's saved country and preferred product-type filters.
- `FR-07-29`: Direct navigation to `/{locale}/stores` without query params, or with user-supplied query params, must continue to honor the URL as the canonical listing input.
- `FR-07-30`: The settings page must expose `Profile`, `Account`, and `Preferences` as three distinct sections on the same route. The `Account` section contains email and password management controls.
- `FR-07-31`: When a credential-account user successfully submits an email change, the system must send an informational security notification to the old email address that includes the support contact (`hello@pandatrack.app`) and does not include an approval or reversal link.
- `FR-07-32`: When the user changes their saved base currency, the settings flow must present an explicit confirmation step (not an autosave) that warns the change does not convert historical data and requires manual per-order reconciliation later. **Implemented** as an inline explicit-confirm on the `Preferences` pane, not a modal: picking a new value in the base-currency select stages a pending choice and reveals `"Guardar"` / `"Cancelar"` with the hint `"No convierte tus datos anteriores."`; only `"Guardar"` commits it via `updateCurrencyAction({ baseCurrencyCode })`. The action persists the new base through `parseAndApplyCollectorPreferencesPatch` and **writes nothing to any order or delivery**: "needs FX reconciliation" is derived per row from its own `currencyCode`, `exchangeRate` and `exchangeRateBaseCode` against the current base currency (`needsFxReconciliation` in `src/lib/fx/reconciliation.ts`, ADR 0024), so there is no flag to set and no order's `exchangeRate` is ever mutated (the deliberate "no silent bulk rate mutation" rule; the collector reconciles per-row). Because each stored rate records the base it converts into, a base-currency round trip (`PEN → EUR → PEN`) leaves already-reconciled orders valid instead of re-marking them. The action still returns `pendingFxOrderCount` (the number of foreign-currency orders that cannot be converted into the new base), now derived by `countOrdersPendingFxReconciliation`. When that count is `> 0`, the pane surfaces a single **optional** shortcut — `"Actualizar tasas · {n} pedidos →"` — linking to `/{locale}/orders?fxPending=true`, where the existing FX reconciliation flow lets the collector preview and apply rates per currency pair (stamping the new base alongside each applied rate). No navigation is forced; when the collector skips the shortcut those orders keep reading as pending so the orders-list banner surfaces them later. (Replaces the former two-path `CurrencyModal` "save without / save and update" footer — a single save plus a conditional shortcut is enough because the reconcile entry point already lives on `/orders`.)
- `FR-07-33`: Username changes must be rate-limited to **one successful change per user per seven days**, using the same window semantics as email-change rate limiting. The username modal surfaces this as a live cooldown chip (remaining days plus the exact next-eligible date) that disappears once the window expires and keeps the modal save action disabled while the cooldown is active.
- `FR-07-34`: Budget-period boundaries and budget-reset execution must use the user's configured timezone when available; if user timezone is missing, the system must fall back to `UTC`. **Note:** `User.timezone` exists in the schema and is read/validated/patched server-side, but it is excluded from `SettingsPageSnapshot` / the preferences payload and has no settings UI — the collector cannot set their timezone in MVP, so the `UTC` fallback applies in practice.
- `FR-07-35`: The `Preferences` section must autosave country, preferred product types, and budget (amount + reset day) without an explicit save button: each change debounces (`300ms`) and persists through a single autosaving server action, surfacing a `saving` / `saved` / `error` autosave indicator. On a failed save the pane must revert the affected fields to the last committed values. The base-currency change is the explicit exception — it is gated behind the `FR-07-32` confirmation flow rather than the autosave path.
- `FR-07-36`: The `Preferences` interface card must let the user switch UI language between `es` and `en`. The selection is persisted to the `NEXT_LOCALE` cookie (one-year max-age, `path=/`, `sameSite=lax`) via a dedicated server action and the client then refreshes to the localized route. Language is a presentation control, not a persisted `User` preference (there is no `preferredLanguageCode` field).

## Business Rules

- `BR-07-01`: The settings route remains one page in MVP and must expose `Profile`, `Account`, and `Preferences` as sections on the same page rather than separate routes or tabs. **Redesign note (ADR 0001 D15):** the single-route, no-extra-navigation intent is preserved, but the section switcher is presented as vertical tabs on desktop and a sticky segmented control on mobile (in-page panes, not separate routes) — overriding the original "sections not tabs" wording while keeping `FR-07-30` (one route, three sections) intact.
- `BR-07-02`: The shell identity surface uses username as the primary human-facing account identifier rather than email.
- `BR-07-03`: The canonical account affordance for settings and sign-out lives in the lower shell navigation area rather than in the content header.
- `BR-07-04`: On desktop, the identity surface appears above the sidebar expand/collapse control and opens an upward menu.
- `BR-07-05`: On desktop collapsed sidebar state, the lower shell area keeps the avatar or fallback visible even before the rail expands to reveal the username.
- `BR-07-06`: On mobile and tablet, the same identity surface appears in the lower drawer area and opens an inline anchored menu pattern inside the drawer.
- `BR-07-07`: Privacy Policy and Terms and Conditions links remain visible inside the opened user menu and open in a new browser tab.
- `BR-07-08`: `Settings` is removed from primary shell navigation in MVP once the lower account menu is available.
- `BR-07-09`: Username uniqueness is case-insensitive because the persisted username is normalized to canonical lowercase form.
- `BR-07-10`: Reserved usernames such as `admin`, `support`, `pandatrack`, `team`, `help`, `root`, and `system` must never be claimable.
- `BR-07-11`: Offensive-term filtering for usernames must avoid substring false positives and should only reject explicit blocked tokens according to the configured normalization rules.
- `BR-07-12`: Display names must remain non-unique but must still reject reserved system names, PandaTrack brand impersonation, and blocked tokens according to the configured normalization rules.
- `BR-07-13`: The account email-change flow is intentionally stricter than normal field editing and must never be bundled into a generic profile-form save action.
- `BR-07-14`: Google-provider trust continues to count as verified identity for email-verification purposes.
- `BR-07-15`: MVP does not expose a settings toggle for email delivery preferences; PandaTrack may continue to send product emails by default while provider-side unsubscribe handles opt-out.
- `BR-07-16`: Preferred product types in user settings are collector-interest inputs, not a replacement for the store product-type catalog or store moderation rules.
- `BR-07-17`: Email changes are rate-limited to one successful change per user per seven days to prevent abuse and spam to arbitrary new addresses.
- `BR-07-18`: Username changes are rate-limited to one successful change per user per seven days to prevent abuse and handle churn, separate from email-change limits.

## Acceptance Criteria

### `AC-07-01`

- Given an authenticated user opens the private app shell
- When the lower shell navigation area renders on desktop or the lower drawer area renders on mobile/tablet
- Then the shell shows avatar plus username
- And the opened user menu shows `Settings`, `Sign out`, `Privacy Policy`, and `Terms and Conditions`

### `AC-07-02`

- Given a new user account is created through email/password or Google
- When account creation completes
- Then the user already has a valid unique username

### `AC-07-03`

- Given the user edits their username in settings
- When the candidate format is invalid or already taken
- Then the UI shows inline feedback and the username is not saved

### `AC-07-04`

- Given the user successfully saves a new username or avatar in settings
- When the save completes in the current session
- Then the settings UI reflects the new value immediately without a full page refresh
- And the shell identity surface (avatar + username in the lower navigation area) reflects the new value on the next full load (it is **not** refreshed in-session as implemented)

### `AC-07-05`

- Given an email/password user changes their email
- When they confirm the modal and the new email is accepted
- Then the login email changes to the new value
- And the current verification banner lifecycle restarts

### `AC-07-06`

- Given a Google-only user opens settings
- When they review account controls
- Then they may set a password
- But they may not change their email in MVP

### `AC-07-07`

- Given a user saves country and preferred product types in settings
- When they open `Stores` from the private navigation
- Then the listing route opens with matching query-string filters derived from those preferences

### `AC-07-08`

- Given a credential-only user opens the `Account` section of settings and clicks "Change email"
- When they enter a new email and their current password in the modal and confirm
- Then the change is submitted, an informational security email is sent to the old address, the verification link is sent to the new address, the new email appears in the settings field, and the verification banner lifecycle restarts

### `AC-07-09`

- Given a Google-only or Google-linked credential user opens the `Account` section of settings
- When they view the email field
- Then the field is read-only with no action button and shows helper text explaining they must update their email directly in their Google account

### `AC-07-10`

- Given a Google-only user opens the `Account` section and sets a password successfully
- When the save completes
- Then the section transitions to show the "Change password" form on the next component load

### `AC-07-11`

- Given a credential-only user has already successfully changed their email within the past seven days
- When they attempt to change their email again
- Then the system rejects the request with an error before sending any emails or calling Better Auth

### `AC-07-12`

- Given a user edits base currency in `Preferences` to a value different from the persisted base currency
- When they change the selection
- Then the change is not autosaved; the flow stages a pending choice and requires an explicit `"Guardar"` confirmation, warning that the change does not convert historical data and that affected orders may need currency reconciliation
- And after saving, when foreign-currency orders remain with stale rates, the pane offers an optional shortcut into `/{locale}/orders` to reconcile by currency pair; the collector may take it or reconcile manually later
- And the settings flow only persists the new base currency — it writes nothing to any order, never converts amounts, and never mutates any order's exchange rate; the affected orders start reading as pending because the derivation now compares their stored rates against the new base

### `AC-07-13`

- Given a user has successfully changed their username within the past seven days
- When they attempt another username change
- Then the system rejects the request with an error before persisting a new username

### `AC-07-14`

- Given a user has a configured timezone and a budget reset day
- When period boundaries are evaluated for budget calculations and reset behavior
- Then the system applies that timezone
- And if no user timezone is available, it applies `UTC`

### `AC-07-15`

- Given a user edits country, a preferred product type, or budget in `Preferences`
- When the change settles after the autosave debounce
- Then the change persists without an explicit save button and the autosave indicator shows `saved`
- And if the save fails, the affected fields revert to their last committed values and the indicator shows `error`

### `AC-07-16`

- Given a user opens the `Stores` listing from the private app navigation with a saved preferred country and/or preferred product types
- When the nav href is built
- Then the listing URL is prefilled with the saved country and product-type filters, dropping any saved code not in the active catalog
- And direct navigation to `/{locale}/stores` without those params still honors the URL as canonical (`FR-07-29`)

## Implementation Notes

- Private shell entry: `src/app/[locale]/(app)/layout.tsx`
- Shell UI: `src/app/[locale]/(app)/_components/AppLayout/*`
- Auth server/client: `src/lib/auth/auth.ts`, `src/lib/auth/auth-server.ts`, `src/lib/auth/auth-client.ts`
- Current user model: `prisma/schema.prisma` `User`
- Store product-type and country catalogs already exist and should be reused rather than duplicated
- The image-upload UX should reuse the store-logo crop and optimization pattern instead of introducing a second bespoke image pipeline
- Username checks should combine fast client-side format validation with server-enforced uniqueness on save
- Username generation should happen during server-side account creation so every new account persists a valid username before entering the private app
- Account-management capabilities should be derived at runtime from linked auth accounts rather than persisted as duplicated settings flags
- MVP may keep budget and collector-preference persistence on `User` even while preserving clean query and validation boundaries for a later migration if multi-budget support becomes necessary
- The shell should reuse one account-menu component across desktop sidebar, collapsed-sidebar hover state, and mobile drawer placements rather than maintaining separate interaction logic per surface
- The lower shell identity trigger should open upward on desktop and render as an inline anchored menu in the drawer on mobile/tablet
- The account menu should close on outside click, route change, and any menu-action selection
- Preference-driven store listing URLs: primary shell navigation implements [`FR-07-28`](frd-07-user-settings.md#functional-requirements) per [WO-06 _store-entry-defaults-from-user-preferences_](bp-01-user-settings-identity-and-preferences/work-orders/wo-06-store-entry-defaults-from-user-preferences.md) and [BP-01](bp-01-user-settings-identity-and-preferences/bp-01-user-settings-identity-and-preferences.md) (**FRD-07**). Any future dashboard (or other) links to the same listing must follow the shared builder rule in [FRD-06 · Cross-domain notes](../frd-06-dashboard/frd-06-dashboard.md#cross-domain-notes).
- Settings success feedback follows the app-wide toast pattern: validation errors and save/server errors for profile fields stay **inline** (see field stack and placement rules in `docs/design/interface-patterns.md` — _Success vs. Error Feedback Placement_); confirmed saves (username, display name, avatar upload, avatar removal, password change, password setup) show a transient toast notification via `src/contexts/ToastContext.tsx`. See `docs/design/interface-patterns.md` — _Toast Notifications_ for the full rule and component references.
- The profile-image crop reuses the shared `ImageCropper` module (`src/components/modules/`) — extracted from the store-logo crop pattern and parameterized for a circular avatar preview versus the rectangular store-logo preview — rather than introducing a second bespoke cropper.
- The `Preferences` section also surfaces an `Interfaz` card with **theme** (light / dark) and **language** (es / en) toggles. These are **presentation controls, not persisted user preferences**: theme is held in the client `ThemeContext` (no `system` option, per redesign ADR 0003) and language is written to the `NEXT_LOCALE` cookie consumed by next-intl (there is no `preferredLanguageCode` field on `User`). Both mirror the equivalent toggles in the app-shell header defined by [FRD-03 · Collector App Shell](../frd-03-collector-app-shell/frd-03-collector-app-shell.md); they are not part of the settings data model and add no new functional requirements here.

## Screens and Data Contract

Settings is a single authenticated route under `/{locale}/(app)/settings`, scoped to the session user. Unlike the domain workspaces it has **no list / detail / wizard grammar**: it is one page (`SettingsShell`) hosting three in-page panes driven by a `tablist` (vertical tabs on desktop, sticky segmented control on mobile — `BR-07-01`). All visual layout is owned by the [FDD](fdd-07-user-settings.md) and the prototype; this section fixes purpose, data loaded, server actions, and states. Component sources live under `src/app/[locale]/(app)/settings/`.

### Settings page — `/{locale}/settings` (optional `?returnTo=order-create`)

- **Purpose:** the self-service identity-and-preferences workspace; the only non-domain collector workspace.
- **Guard:** the route is inside the authenticated `(app)` segment; if there is no session user the page renders nothing (`return null`). An invalid `locale` param resolves to 404. `?returnTo=order-create` renders a back link to `/{locale}/orders/new` (resume-order-creation affordance, `RETURN_TO_ORDER_CREATE`).
- **Data loaded (one round-trip each, in parallel):**
  - `getSettingsPageSnapshot(userId)` → `email`, `emailVerified`, `username`, `name`, `image`, `preferredCountryCode`, `baseCurrencyCode`, `budgetAmount`, `budgetResetDayOfMonth`, `preferredProductTypeKeys`, `usernameChangedAt` (drives the cooldown chip, `FR-07-33`), and `passwordChangedAt` (the credential `Account.updatedAt`, null when there is no credential provider — drives the "last updated" helper).
  - `getAccountCapabilitiesForUser(userId)` → `{ hasGoogleAccount, hasCredentialAccount, canChangeEmail, canChangePassword, canSetPassword }`, derived at runtime from linked provider ids (no persisted capability flags).
- **States:** always-populated (data-light; no list-empty / loading / filtered-empty states). Field-level states only: inline validation/availability under the username input (`available / taken / cooldown`; a `checking` state exists in the type and copy but is currently dead code — `UsernameModal` never enters it), inline field/server errors below the affected control, confirmation toasts on success, and the `Preferences` autosave indicator (`saving / saved / error`). No 404/403 path beyond the guards above.

#### Profile pane (`SettingsProfilePane`)

- **Server actions:** `checkUsernameAvailabilityAction` (live availability), `saveUsernameAction` (`FR-07-08`/`FR-07-33`), `saveDisplayNameAction` (`FR-07-09`), `saveAvatarAction` (multipart `FormData`: file + crop area; `FR-07-10`/`FR-07-11`), `removeAvatarAction` (`FR-07-12`), and `getProfileSnapshotAction` (read-only profile reload — username/name/image). Each mutation opens its own modal/sheet (`BR-07-13`); none is bundled into a page-level save.
- **States:** active username cooldown renders the `CooldownChip` below the value and disables the modal save (`FR-07-33`); avatar row shows replace + destructive-ghost remove only when an image is present, else the username-initial fallback hint. Successful username/avatar changes update this pane's local state immediately; the shell identity surface is not refreshed in-session and updates on the next full load (`FR-07-13`, `AC-07-04`).

#### Account pane (`SettingsAccountPane`)

- **Server actions:** `submitEmailChangeAction` (`FR-07-14`–`FR-07-16`, credential only), `submitChangePasswordAction` (credential-bearing), `submitSetPasswordAction` (Google-only adding a password, `FR-07-18`). All re-derive capabilities server-side and reject with `notAllowed` if the posture does not permit the action.
- **States:** provider-aware (three shapes per §5.3 of the FDD) — credential (email editable + change password), Google-only (email read-only helper + **set** password), Google-linked credential (email read-only, Google rule wins, `FR-07-19`). The email row shows either a "Cambiar" action or a read-only helper, never both (`AC-07-09`).

#### Preferences pane (`SettingsPrefsPane`)

- **Server actions:** `savePreferencesAction` (autosaving patch for country / product types / budget, `FR-07-35`), `updateCurrencyAction` (explicit-confirm base-currency change, `FR-07-32`), `updateLanguageAction` (`NEXT_LOCALE` cookie, `FR-07-36`), and `getPreferencesSnapshotAction` (read-only preferences reload). Theme is client-only (`ThemeContext`), persisted to `THEME_STORAGE_KEY` local storage — no server action.
- **States:** autosave indicator (`saving / saved / error`) with optimistic local apply + revert-on-failure; budget inputs disabled until a base currency is set (`baseCurrencyCode == null`); the base-currency change uses an inline `"Guardar"` / `"Cancelar"` confirm on the select (plus a conditional post-save "reconcile rates" shortcut) instead of autosaving; mobile-only full-width `"Cerrar sesión"` ghost-destructive button at the foot of the pane.

## State Model

User Settings has **no lifecycle entity** like the order/delivery domains — there is no status field that transitions through actions. Its stateful surfaces are (a) rate-limit cooldown windows and (b) the runtime account-capability matrix derived from auth providers.

### Username & email change cooldowns (7-day windows)

| Operation       | Window source                             | Window length                       | Server enforcement                                                                                                            | Surfaced as                                                                                                                              |
| --------------- | ----------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Username change | `User.usernameChangedAt`                  | `USERNAME_CHANGE_COOLDOWN_DAYS = 7` | `assertUsernameChangeCooldownAllows` before persist; `recordSuccessfulUsernameChange` on success                              | live `CooldownChip` (remaining days + exact next-eligible date) that disappears on expiry; modal save disabled while active (`FR-07-33`) |
| Email change    | credential email-change rate-limit record | `EMAIL_CHANGE_COOLDOWN_DAYS = 7`    | `assertEmailChangeCooldownAllows` before any email is sent or Better Auth is called; `recordSuccessfulEmailChange` on success | inline `rateLimited` error carrying `retryAfterIso` (`AC-07-11`, `BR-07-17`)                                                             |

Both windows are computed server-side from the stored timestamp; the client chip is a derived display (`computeCooldownDays`) and is never the authority.

### Account-capability matrix (`deriveAccountCapabilities`)

Derived at runtime from the linked provider ids (`google`, `credential`) on every load — never persisted as flags.

| Linked providers    | `canChangeEmail` | `canChangePassword` | `canSetPassword` |
| ------------------- | ---------------- | ------------------- | ---------------- |
| credential only     | yes              | yes                 | no               |
| Google only         | no (`FR-07-17`)  | no                  | yes (`FR-07-18`) |
| Google + credential | no (`FR-07-19`)  | yes                 | no               |

### Email-change persistence effect

`applyEmailChangeTransaction` (atomic): sets `User.email` to the new normalized address, `emailVerified = false`, restarts the 7-day grace (`unverifiedGraceStartsAt`), and updates the credential `Account.accountId`. The active session is **not** revoked — the new email is the login identifier immediately, and the standard credential verification banner/lifecycle resumes (`FR-07-16`, `AC-07-05`). The informational security email to the old address (`FR-07-31`) and the verification link to the new address are sent after the transaction; a Resend failure on the old-address notification is captured to Sentry but does not roll back the change.

## Error Contract

Settings mutations return typed, expected error codes (not thrown exceptions) so flows recover inline; unexpected failures are captured once with `Sentry.captureException` and safe context (`action`, `userId` — never the field value).

- **Profile** (`ProfileErrorCode`): `unauthorized`, `validation`, `usernameTaken`, `rateLimited` (carries `retryAfterIso`), `avatarInvalidType`, `avatarTooLarge`, `avatarMalformed`, `avatarProcessingFailed`, `generic`. Avatar codes originate from `processAvatarFile` / `AvatarProcessingError`; R2 upload failures map to `generic`. Avatar removal clears `User.image` first, then attempts R2 cleanup; a cleanup failure is logged to Sentry but does **not** revert the user-facing removal (observability-only path, per the BP-01 risk on orphaned objects).
- **Account** (`SettingsAccountErrorCode`): `unauthorized`, `notAllowed` (capability mismatch), `rateLimited` (carries `retryAfterIso`), `sameEmail`, `emailTaken` (also from a `P2002` unique-constraint race inside the transaction), `invalidPassword`, `passwordTooShort`, `passwordTooLong`, `passwordAlreadySet`, `validation`, `generic`. Better Auth `APIError` codes (`INVALID_PASSWORD`, `PASSWORD_TOO_SHORT`, `PASSWORD_TOO_LONG`, `PASSWORD_ALREADY_SET`) are mapped to these; anything else falls through to `generic` and is captured.
- **Preferences** (`PreferencesErrorCode`): `unauthorized`, `validation`, `generic`. Validation runs in the data layer (`collectorPreferencesValidation`): country must be in the active catalog (`INVALID_COUNTRY`), currency in the allowed base-currency set (`INVALID_CURRENCY`), budget a positive integer in minor units `100 … 999_999_900` (`MIN_BUDGET_AMOUNT_MINOR` / `MAX_BUDGET_AMOUNT_MINOR`, i.e. `1 … 9_999_999` whole currency units) that must be a multiple of `100` (`BUDGET_FRACTIONAL_SUBUNITS`), reset day `1 … 31`, timezone a valid IANA zone, product-type keys in the catalog (max 64, de-duplicated), and a budget amount requires a base currency (`BASE_CURRENCY_REQUIRED_FOR_BUDGET`). `updateCurrencyAction` additionally rejects a base currency that is not a 3-letter code. `updateLanguageAction` rejects any locale outside `es` / `en`.
- The full-state validator (`validateCollectorPreferencesState`) re-validates the merged next state inside the transaction so a partial patch can never persist an invalid combination.

## Analytics

Settings events are namespaced under `POSTHOG_EVENTS.SETTINGS` in `src/lib/constants.ts`:

- profile: `settings_profile_username_saved`, `settings_profile_display_name_saved`, `settings_profile_avatar_uploaded`, `settings_profile_avatar_removed`
- account: `settings_account_email_change_modal_opened`, `settings_account_email_change_submitted`, `settings_account_password_change_submitted`, `settings_account_password_set_submitted`
- preferences: `settings_preferences_saved`

Implementation note: these event names are **defined** in `POSTHOG_EVENTS.SETTINGS` but, as of the S16 audit, are **not yet wired** to capture sites in the settings panes/modals — no `posthog.capture` or `data-ph-event` call references them. Wiring them is outstanding instrumentation work (tracked under GitHub follow-up), not a spec change.

Theme and language toggles in the `Interfaz` card are presentation controls owned by [FRD-03](../frd-03-collector-app-shell/frd-03-collector-app-shell.md); their analytics (`app_shell_theme_changed`, `app_shell_locale_changed`) live under `POSTHOG_EVENTS.APP_SHELL` and are not Settings-owned. The `Stores` nav item carries a `stores_href_kind` property on the FRD-03 `app_shell_nav_clicked` event indicating whether the preference-derived href (`FR-07-28`) was used.

## Confirmed

- FRD-07 extends the existing user-settings scope rather than creating a new FRD
- MVP uses one blueprint for this domain
- `/settings` stays one page with three sections: `Profile`, `Account`, and `Preferences`
- No onboarding is required immediately after sign-up in MVP
- Budget currency equals base currency in MVP
- Username is the primary shell identity surface and a future profile handle foundation
- Settings preferences are optional until the collector explicitly saves them
- Reserved names and blocked tokens for usernames are maintained in code/config for MVP
- Display names remain non-unique but follow the same reserved-name, PandaTrack brand, and blocked-token protections as usernames
- Google profile image URLs may remain the initial value of `User.image` until the collector uploads a replacement
- Removing a profile image always returns the account to the username-initial fallback instead of restoring a provider image automatically
- The canonical account trigger moves from the content header to the lower sidebar/drawer area
- The shell user menu should visually follow the upward-opening account-menu pattern used by modern productivity apps such as ChatGPT
- Privacy Policy and Terms and Conditions links stay visible inside the menu alongside the MVP account actions
- Desktop collapsed sidebar keeps only the avatar or fallback visible until hover/focus expansion reveals the username
- Desktop uses a floating upward menu while mobile/tablet use an inline menu inside the drawer
- `Settings` moves fully into the account menu and no longer appears in primary shell navigation
- The email change flow sends the verification link to the new email only; the old email receives an informational-only security notification via Resend (no approval or reversal link)
- The email change server action must validate the current password manually before calling Better Auth, regardless of Better Auth's native session-only behavior
- Email changes are rate-limited to 1 successful change per user per 7 days
- Username changes are rate-limited to 1 successful change per user per 7 days
- Budget amount is entered in whole currency units only (no fractional subunits) and stored in minor units, consistent with all other money in the app
- Google-only users set a password via `auth.api.setPassword` (server-only); after success the UI transitions to "Change password"
- The active session is not revoked after an email change; `User.email` becomes the new login identifier immediately and `emailVerified` is set false until the user completes the verification link (banner and resend use the standard credential verification flow)

## Open Questions

- whether a dedicated profanity library should replace a local blocked-token list once the profile domain expands
- whether future social/profile visibility should expose usernames publicly without a separate privacy setting
- whether later post-MVP account-provider management should support unlinking Google or adding more providers

## Out of Scope

- public user profile pages
- follower/friend/social graph features
- multi-email account support
- multiple active budgets in MVP
- provider unlink flows in MVP
- in-product email notification opt-out controls in MVP
- additional menu destinations beyond `Settings`, `Sign out`, `Privacy Policy`, and `Terms and Conditions`
- list-density preference (`dense` / `comfortable`) — considered during the settings redesign (S8) and **deferred**; revisit if real demand emerges
- active-session management UI in settings (viewing active sessions / "sign out other sessions") — **deferred**; the underlying capability remains in Better Auth but has no dedicated settings surface in MVP

## Linked Blueprints

- `docs/product/prd-02-collector-app/frd-07-user-settings/bp-01-user-settings-identity-and-preferences/bp-01-user-settings-identity-and-preferences.md`
