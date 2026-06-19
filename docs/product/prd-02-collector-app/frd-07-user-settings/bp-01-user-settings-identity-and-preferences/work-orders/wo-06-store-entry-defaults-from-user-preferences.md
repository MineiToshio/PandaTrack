---
id: WO-06
type: WORK_ORDER
slug: store-entry-defaults-from-user-preferences
title: Store Entry Defaults from User Preferences
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0013
last_updated: 2026-04-18
implementation_status: IMPLEMENTED
---

# WO-06 Store Entry Defaults from User Preferences

## Summary

Build the private-shell `Stores` navigation target URL from the authenticated user's **saved** preferences (preferred country and preferred product types), using the **same query-string shape** as the public store listing today. The listing remains **URL-canonical** (`FR-07-29`): no server-side redirect that injects filters without the user-visible URL changing.

## In Scope

- `Stores` link `href` generation for **primary private shell navigation** (desktop sidebar rail and expanded sidebar links, and mobile/tablet drawer links) driven by the same nav config model as today (`getPrivateAppNavItems` / `navigationConfig`).
- Reuse of existing listing query keys: repeat `country` for each selected country code and `productType` for each selected product-type key (match `StoreListingFilters` and `parseListingSearchParams` in `src/app/[locale]/(app)/stores`).
- **Partial preferences:** include **only** query params for preference dimensions the user has **saved**; omit missing dimensions entirely (no placeholder params).
- **Catalog sanity:** when resolving the user's saved country or product-type keys at link-build time, **omit** any value that does not exist in the **active** `Country` / `StoreProductType` catalog used by the listing (inactive types, removed codes, etc.).
- **Shell re-entry:** each activation of the shell `Stores` nav item builds the href from **current** saved preferences again, even if the user had previously navigated to a bare `/{locale}/stores` or different filters (the shell link is not a no-op based on current pathname).
- Doc alignment with store-domain listing behavior and with FRD-06 for **future** dashboard CTAs ([FRD-06 · Cross-domain notes](../../../frd-06-dashboard-reminders/frd-06-dashboard-reminders.md#cross-domain-notes); see Assumptions).

## Out of Scope

- Changes to store moderation, store create/edit flows, recommendation ranking, or onboarding.
- Implementing dashboard CTAs to the stores listing in this slice (see Assumptions).
- Changing server-side listing query semantics beyond what the listing already supports.

## Requirements

- `FR-07-28`
- `FR-07-29`

## Blueprints

- `BP-01` URL-canonical preference consumption and store-entry URL contract

## Assumptions

- **Preferred country** maps to the listing filter **`country`** (store country), not `importCountry`, matching `FR-07-28` wording.
- **MVP implementation** touches only shell navigation surfaces that already link to `ROUTES.stores`. When FRD-06 introduces dashboard (or other) links to the same listing, those links **must** reuse the **same URL-building helper** and rules; the reminder lives in [FRD-06 · Cross-domain notes](../../../frd-06-dashboard-reminders/frd-06-dashboard-reminders.md#cross-domain-notes) so the dashboard slice does not ship a divergent pattern.
- `WO-05` (and `WO-01` persistence) has landed so preferred country and product-type junction data are readable for the session user.

## UX Notes

- If the user has **no** saved country and **no** saved product types, the shell `Stores` href remains the plain listing path with **no** query string.
- Users who clear filters on the listing and land on a bare URL will get preference-driven query params again the **next** time they use the shell `Stores` link, which may feel like a reset; this is intentional and matches explicit URL defaults from the shell.

## Technical Notes

- Resolve preferences in the **private app layout** (or a dedicated small server helper called from it) and pass the computed **stores listing path+query** into shell components so client nav links stay synchronous and avoid client-side preference fetching for this purpose.
- Centralize URL construction in a **single shared helper** (e.g. under `src/lib/` or `src/app/[locale]/(app)/_utils/`) used by sidebar and drawer so the two surfaces cannot drift.
- Use the **same** multi-value encoding as the filters component (`URLSearchParams` with repeated keys). Do **not** use the legacy `category` alias for nav-generated links; use `productType` only.
- After save in settings, the next render of shell nav should reflect updated prefs (normal RSC/navigation refresh behavior is sufficient; document if a `router.refresh()` is required in the settings success path).

## Security Notes

- Only the authenticated user's own preferences feed the href; no new trust boundary. Do not put sensitive values into analytics payloads.

## Observability Notes

- Extend `POSTHOG_EVENTS.APP_SHELL.NAV_CLICKED` usage for the `stores` destination with a **non-sensitive** prop distinguishing plain listing href vs href that includes preference-derived query params (e.g. `stores_href_kind: "plain" | "preference_filters"`). Register the prop shape in the Work Order / constants comment if needed; follow the project's declarative `data-ph-props` pattern.

## Dependencies

- `WO-01` (user preference fields and catalog-backed validation).
- `WO-05` (user can save preferred country and product types).
- [`FRD-04`](../../../frd-04-store-domain/frd-04-store-domain.md) seeded `Country` and `StoreProductType` catalogs.
- [`FRD-03`](../../../frd-03-collector-app-shell/frd-03-collector-app-shell.md) shell navigation structure.

## Testing Notes

- **Unit or integration:** URL builder with combinations: no prefs; country only; product types only; both; invalid or inactive catalog keys dropped; stable ordering of repeated params if product is required for snapshot tests.
- **E2E:** shell `Stores` from sidebar and from drawer; direct `/{locale}/stores` without params shows unfiltered listing; manual query params on first load unchanged by server; optional assertion that PostHog payload includes `stores_href_kind` when stores nav is clicked (if E2E captures analytics).

## E2E Acceptance Tests

- Given saved **country only**, when the user opens `Stores` from the shell nav, then the URL includes `country` for that code and no `productType` params unless the user also saved types.
- Given saved **product types only**, when the user opens `Stores` from the shell nav, then the URL includes `productType` for each saved key and no `country` param unless the user also saved a country.
- Given saved **both**, when the user opens `Stores` from the shell nav, then the URL includes both `country` and `productType` params consistent with the listing filters.
- Given **no** saved country and **no** saved product types, when the user opens `Stores` from the shell nav, then the URL has **no** preference query string.
- Given a saved product-type key or country code that **no longer exists** in the active catalog at render time, when the user opens `Stores` from the shell nav, then the generated URL **omits** that invalid value (and still includes any remaining valid saved values).
- Entering `Stores` **directly** by URL without query params still loads the unfiltered listing (no middleware or RSC redirect that adds hidden filters).
- Entering `Stores` with **user-supplied** query params on first navigation still honors those params (`FR-07-29`); the server does not overwrite them with saved preferences.
- Given the user is already on `/{locale}/stores` with no query string, when they click `Stores` again from the shell nav and they have saved prefs, then the navigation target includes the preference-derived query string again.
