---
id: WO-05
type: WORK_ORDER
slug: preferences-currency-country-product-types-and-budget
title: Preferences: Currency, Country, Product Types, and Budget
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0013
last_updated: 2026-08-03
implementation_status: IMPLEMENTED
---

# WO-05 Preferences: Currency, Country, Product Types, and Budget

## Summary

Implement the `Preferences` section of `/settings` so each collector can save optional baseline preferences: **base currency** (from a curated list aligned to seeded countries), **preferred country**, **preferred product types** (many-to-many against `StoreProductType`), and a **single active budget** (entered in whole currency units, persisted in minor units, with a nullable **day-of-month** reset rule). Changing **base currency** requires an **explicit inline confirmation** (`Guardar` / `Cancelar`, not autosave), warns that it does not convert historical data, and — when foreign-currency orders remain with stale rates — offers an optional shortcut into the orders FX reconciliation flow.

## In Scope

- `Preferences` UI on the same settings route as `Profile` and `Account` (`BR-07-01`, `FR-07-30`).
- Base currency control as a **searchable single-select** (combobox pattern) over the **curated currency list** (one primary ISO 4217 code per country in `prisma/seed.ts` `COUNTRY_CODES`; document or generate the mapping in code so adding a country revisits currencies).
- Preferred country using **reused** country-selection patterns from the stores domain where feasible (evaluate `Select` vs combobox vs shared catalog picker; prefer reuse, extract to core/modules only when a second consumer needs the same control).
- Preferred product types using the **same multi-tag autocomplete interaction** as store listing filters (`StoreMultiTagAutocomplete` or extracted shared primitive), backed by the seeded `StoreProductType` catalog (`FR-07-22`, `FR-07-23`, `BR-07-16`).
- Budget amount: entered as a **positive integer** in **whole currency units**, persisted in **minor units** (`×100` on save, `÷100` on prefill, via `src/lib/user-settings/budgetAmount.ts`). Validated range `100 … 999999900` minor units (`1 … 9999999` whole units) and must be a multiple of `100`. The cap is bounded by the `INTEGER` column, not by product preference.
- Budget reset: **nullable day of month** `1`–`31`; `null` means reset on the **last calendar day** of each month; short months use the **last valid day** (`FR-07-25`, `FR-07-26`). **Implementation limitation:** the data layer supports `null`, but `SettingsPrefsPane` always persists a clamped `1`–`31` value, so the month-end (`null`) reset rule is currently unreachable from the settings UI.
- **Inline explicit confirmation** (not a modal, not autosave) when the user changes **base currency** from the last persisted value:
  - picking a new value in the base-currency `SearchableSelect` stages a pending choice and reveals a `Guardar` / `Cancelar` confirm row with the hint `"No convierte tus datos anteriores."` (`preferences.collector.currency.dirtyHint`),
  - `Cancelar` (`preferences.collector.currency.cancel`) discards the pending value; only `Guardar` (`preferences.collector.currency.save`) commits it via `updateCurrencyAction({ baseCurrencyCode })`, which persists the new base currency and then counts the orders that cannot be converted into it, returning `pendingFxOrderCount`,
  - after a successful commit, when `pendingFxOrderCount > 0` the row swaps the confirm for a single **optional** shortcut `"Actualizar tasas · {n} pedidos →"` (`preferences.collector.currency.reconcileLink`) linking to `/{locale}/orders?fxPending=true`; no navigation is forced,
  - skipping the shortcut leaves those orders pending manual per-order updates (`FR-07-32`); they surface in the orders list banner and `?fxPending=true` filter.
- The settings flow **writes nothing to orders**: changing the base currency is a plain preferences patch. Whether an order still needs FX reconciliation is **derived** from its own `currencyCode`, `exchangeRate` and `exchangeRateBaseCode` against the current base (`needsFxReconciliation` / `buildNeedsFxReconciliationWhere` in `src/lib/fx/reconciliation.ts`, ADR 0024), so no bulk write happens and `exchangeRate` is never mutated. Reconciliation itself is owned by the orders domain ([**FRD-05 · BP-02 · WO-07**](../../../frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/work-orders/wo-07-currency-reconciliation-filter-and-bulk-fx-reconciliation.md)), where the collector applies real rates per row and each applied rate is stamped with the base it converts into. Prior orders are preserved in the database untouched; an order reads as pending exactly while its stored rate cannot convert it into the current base currency, which also makes a base-currency round trip self-healing.
- **Single primary submit** for the whole `Preferences` form: **Save** stays **disabled** until the form is **dirty** vs last loaded server state; reverting all fields to initial values disables Save again. (Separate flows such as email change, password, or dedicated username save remain outside this form, per `WO-03` / `WO-04`.)
- **PostHog** on preferences save attempt: emit success and failure with **which logical field groups changed** (booleans or enum flags, not raw monetary values or email-like PII) plus outcome. On failure, also capture with **Sentry**.
- Register new event name(s) in `POSTHOG_EVENTS` and attach via the project's standard analytics pattern.

## Out of Scope

- Multiple active budgets in MVP (`FR-07-27` future-proofing stays in persistence architecture, not UI).
- Email delivery preferences inside settings (`BR-07-15`).
- Provider-aware account settings.
- Store navigation URL generation (`WO-06`).
- Automatic **revaluation** of historical orders when base currency changes (see **Cross-domain notes**).

## Requirements

- `FR-07-20` through `FR-07-26`
- `FR-07-32`
- `FR-07-34`
- `BR-07-01`
- `BR-07-16`

## Blueprints

- `BP-01` preference contract (including budget integer rule, currency-change reconciliation flow, junction table for product types)

## Cross-domain notes

- **Orders** already persist **order currency** and optional **exchange rate into the user's base currency at save time** (`FR-05-14`–`FR-05-16`, `BR-05-07` in [`FRD-05`](../../../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements)). Changing **base currency** in settings does **not** rewrite old orders; **dashboard** rollups must follow [`FR-06-13`](../../../frd-06-dashboard/frd-06-dashboard.md#functional-requirements) ([`FRD-06`](../../../frd-06-dashboard/frd-06-dashboard.md)) so totals in the **new** base currency do not silently mix stale conversion context.
- **Upcoming payments** and order surfaces should continue to show amounts in **order currency** where that is the faithful representation.

## Assumptions

- `WO-01` defines Prisma fields, junction table for preferred product types, curated currency list, budget integer + reset day columns, and server actions/schemas consumed by this slice.
- All preference fields remain **optional** until the user saves; partial saves are valid when validation passes for the fields present.
- Locale and geolocation do **not** auto-fill preferences in MVP (inherited from `WO-01`).

## UX Notes

- Use clear section hierarchy inside `Preferences`: currency, country, product types (with `FR-07-23` copy), then budget and reset rule.
- Empty states: explain that preferences drive defaults (e.g. store listing via [WO-06 _store-entry-defaults-from-user-preferences_](wo-06-store-entry-defaults-from-user-preferences.md)) without forcing completion.
- Loading and error states should mirror patterns used in other settings sections for consistency.
- Currency-change confirmation must be **explicit** (inline `Guardar` / `Cancelar` on the select, not autosave) and require confirm to proceed with save.
- The inline confirmation should not list individual orders. Keep it concise (a one-line hint); then, only when foreign-currency orders remain, expose the optional post-save shortcut into the follow-up reconciliation flow that handles updates by currency pair.

## Technical Notes

- Prefer **Server Actions** for persistence; validate with Zod at the boundary; revalidate settings paths after success.
- Enforce **budget amount** as integer **≥ 1** when the user enters a budget (if the field is left empty, persist as no budget per optional-prefs model).
- **Base currency change** on successful save after the inline confirm: `updateCurrencyAction({ baseCurrencyCode })` persists the new base currency through `parseAndApplyCollectorPreferencesPatch` and writes nothing to `Order` records; it never mutates `exchangeRate`. It then counts, **only when the base currency actually changed** (`current.baseCurrencyCode !== trimmed`), the orders that cannot be converted into the new base (`countOrdersPendingFxReconciliation`, which shares the derivation in `src/lib/fx/reconciliation.ts`) and returns it as `pendingFxOrderCount`; when it is `> 0` the pane surfaces an **optional** shortcut `"Actualizar tasas · {n} pedidos →"` to `/{locale}/orders?fxPending=true`, where the FX reconciliation flow (owned by [**FRD-05 · BP-02 · WO-07**](../../../frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/work-orders/wo-07-currency-reconciliation-filter-and-bulk-fx-reconciliation.md)) applies the same derivation and lets the collector apply rates per currency pair. No navigation is forced; when the collector skips the shortcut those orders keep reading as pending and the orders list banner guides reconciliation at their own pace.
- Budget calculations in current/future periods must exclude non-reconciled affected orders and show an explicit warning until reconciliation is complete.
- Budget reset and period cutoffs should be evaluated in user timezone when available, fallback to `UTC`.
- Reuse i18n for country and product-type labels; add locale keys for preferences labels, helper text, and modal copy (no hardcoded user-facing strings in TS/TSX).

## Security Notes

- Only the authenticated user may read or update their own preferences.
- Do not add secret tokens or PII to PostHog payloads; use **change flags** and safe metadata only.

## Observability Notes

- **PostHog**: one event (e.g. `preferences_save` / `PREFERENCES_SAVE`) for submit outcomes with props such as `success`, `changedCurrency`, `changedCountry`, `changedProductTypes`, `changedBudget`, `changedResetRule`, and `errorCode` or `errorType` on failure.
- **Sentry**: capture unexpected failures on the server action; for **expected** validation errors, do not spam Sentry unless they indicate a bug or abnormal volume.

## Dependencies

- `WO-01` (persistence, validation, shared modules).
- Seeded `Country` and `StoreProductType` catalogs ([`FRD-04`](../../../frd-04-store-domain/frd-04-store-domain.md)).
- `WO-06` consumes saved preferences after this slice.

## Testing Notes

- Unit or integration tests for Zod rules: budget integer range, reset day bounds, short-month resolution logic (shared with `WO-01` if implemented there).
- Prove curated currency list contains only allowed codes and stays aligned with country seed strategy.
- Prove base currency change requires the inline confirmation gate and, when foreign-currency orders remain, exposes the optional reconcile shortcut.
- Prove non-reconciled affected orders are excluded from budget calculations and trigger a visible warning.
- Integration or E2E: save partial preferences, dirty-state Save button behavior, inline confirm gate on currency change.

## E2E Acceptance Tests

- User can save (or leave unset) country, base currency, preferred product types, and budget amount independently where valid.
- User can choose month-end reset (`null` day) or a specific day `1`–`31`; a reset day beyond the month length resolves to the last day of that month.
- When the user changes base currency and confirms with `Guardar`, the base currency is saved and no order row is written (no `exchangeRate` is mutated); orders whose stored rate cannot convert into the new base start reading as pending, and when any remain the pane exposes the optional `"Actualizar tasas · {n} pedidos →"` shortcut to `/{locale}/orders?fxPending=true`, where the FX reconciliation flow surfaces the eligible currency pairs to apply or skip.
- When the user takes the reconcile shortcut, they land on the orders list filtered to `?fxPending=true`; when they skip it, those orders keep reading as pending and the orders list banner/`?fxPending=true` filter guides the collector to reconcile at their own pace.
- Returning the base currency to a previously used value (for example `PEN → EUR → PEN`) does not re-surface orders that were already reconciled against it, because each stored rate carries the base it converts into.
- If the user skips reconciliation, budget totals exclude affected non-reconciled orders and show a warning explaining that manual per-order updates are required to reach full accuracy.
- Save remains disabled until a preference field changes from its loaded values; reverting disables Save again.
