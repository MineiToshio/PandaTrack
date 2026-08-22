---
title: "ADR 0031 - A row in the base currency never persists an FX pair"
date: 2026-08-17
status: accepted
session: FX 1.1 artifact forensics and cleanup (2026-08-17)
owner: Sergio Minei
trigger: 544 of 565 orders in the dev database carried `exchangeRate=1.1, exchangeRateBaseCode='USD'` while being PEN orders of a PEN-base collector; forensics traced the write to the FX-reconciliation e2e spec, which switched the account's base currency to USD and bulk-applied a placeholder rate to the whole real PEN pair, twice (2026-08-08 and 2026-08-09), re-polluting data that had already been cleaned once on 2026-08-06
updates: src/lib/fx/reconciliation.ts, src/lib/data/orders/orderMutations.ts, src/lib/data/deliveries/deliveryMutations.ts, src/lib/data/orders/storePaymentMutations.ts, e2e/orders.spec.ts, .agents/rules/testing-strategy.mdc
extends: ADR 0024 (FX reconciliation derived from the rate's base)
---

# ADR 0031 - A row in the base currency never persists an FX pair

## Context

ADR 0024 made "needs FX reconciliation" a pure derivation over `(currencyCode, exchangeRate, exchangeRateBaseCode)` against the collector's current base currency. The derivation deliberately ignores rows already denominated in the base — there is nothing to convert — which means it also cannot *see* garbage stored on those rows. A base-currency row carrying a rate is invisible while the base stays put, and becomes a silently wrong "already reconciled" claim the moment the base currency moves to the stored target.

That is not hypothetical. The FX e2e spec seeded an order in the account's base currency (PEN), switched the base to USD to trigger the pending state, and reconciled through the modal by filling the PEN→USD pair — but the modal groups **every** pending order into per-pair cards and applies one rate to the whole pair, so "Apply to N orders" stamped `1.1 / USD` onto all ~540 real PEN orders of the shared dev account, in one second, twice on different nights. Restoring the base to PEN afterwards hid the damage from every screen. The pollution then propagated: a payment raised against one order inherits that order's FX shape (`addOrderPayment`), so contaminated orders started giving birth to contaminated `store_payment` rows.

Three layers failed at once: the write paths accepted a rate for a row whose currency equals the base, the bulk apply trusted its payload's ids, and the e2e spec pointed a pair-wide action at the pair every real order lives in.

## Decision

**No write path persists `exchangeRate` / `exchangeRateBaseCode` on a row whose `currencyCode` equals the collector's base currency.** The rule lives once, in `resolveFxPair` (`src/lib/fx/reconciliation.ts`), next to the derivation it protects:

- `createOrder` / `editOrder` resolve the pair through it. An edit that restates the order **into** the base currency with the rate untouched also drops the old pair — keeping it would recreate the artifact.
- `createDelivery` / `editDelivery` do the same, keyed on the currency the write leaves the row in.
- `applyOrderExchangeRates` (the bulk apply) additionally excludes base-currency orders in the `updateMany` where-clause itself, so neither a tampered payload nor a UI-grouping regression can reach them.
- `createStorePayment` nulls both fields when the payment is in the base currency; a **foreign**-currency payment keeps the caller's pair verbatim, because an inherited base code older than the current base must keep reading as still-unreconciled rather than be restamped.

**The e2e spec keeps its blast radius off real data by construction.** It seeds its order in a third currency no real order uses (GBP/JPY/CLP, avoiding both base codes involved), reconciles only that pair, and presses an apply button located by its exact count — `Apply to 1 order` — so pooling one extra order into the pair fails the test instead of writing through it. The generalized rule ("a bulk action in an e2e test must be pinned to seeded fixtures and assert its affected count before committing") went to `testing-strategy.mdc`.

## Alternatives considered

- **A database CHECK constraint.** The base currency lives on `User`, not on the row, so the invariant is cross-table; a trigger could see it, but this repo keeps invariants in the data layer (ADR 0022 territory), and a trigger would also have blocked the legitimate transient state during a base switch (rows written under base USD *were* consistent when written — the guard is about the write's own view, which is exactly what `resolveFxPair` expresses).
- **Periodic cleanup instead of a guard.** Treats the symptom; the 2026-08-06 cleanup was re-polluted within 48 hours by the next e2e run.
- **Fixing only the e2e spec.** Leaves every mutation open to the next caller that inherits, prefills, or replays a stale pair — the two contaminated `store_payment` rows were created by the normal payment flow, not by the test.

## Consequences

- A submitted rate for a base-currency row is silently dropped, not refused. The UI never offers the field in that state, so a refusal would only ever fire on stale prefills and replayed payloads — exactly the writes that must not win.
- `CreateStorePaymentInput.exchangeRateBaseCode` remains caller-supplied for foreign-currency payments (inheritance honesty), so the payment boundary nulls on the base-currency condition alone rather than re-deriving the base code.
- The dev database was cleaned in the same session (544 orders + 2 store payments → `NULL/NULL`, census before/after, `updatedAt` untouched); the 12 legitimate USD rows with `3.393232 / PEN` were preserved.
