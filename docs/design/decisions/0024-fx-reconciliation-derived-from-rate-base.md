---
title: "ADR 0024 - FX reconciliation is derived from the rate's own base currency, not a stored flag"
date: 2026-08-03
status: accepted
session: FX reconciliation source-of-truth investigation (2026-08-03)
owner: Sergio Minei
trigger: the dashboard kept reporting 12 orders as needing FX reconciliation after the collector had already reconciled them; the orders each carried a valid USD-to-PEN rate but had been re-flagged by a base-currency round trip
updates: prisma/schema.prisma, src/lib/fx/reconciliation.ts, docs/development/database-schema.md
---

# ADR 0024 - FX reconciliation is derived from the rate's own base currency, not a stored flag

## Context

An order or delivery is denominated in its own `currencyCode` and carries an `exchangeRate` used to roll it up into the collector's `User.baseCurrencyCode`. Whether that rate is still usable was tracked by a boolean, `needsExchangeRateUpdate`, set in bulk when the base currency changed and cleared whenever a rate was written.

Two things were wrong with that, and they compounded.

**The flag and the data disagreed, and different screens trusted different ones.** The dashboard rollup excluded a row from base-currency totals if the flag was set **or** if the rate was missing. The orders list `?fxPending=true` filter, its count, and the reconciliation modal all keyed on the flag alone. A foreign-currency order created with no rate (the rate field is optional at create time) was therefore excluded from every dashboard figure while remaining invisible to the only screen that could fix it. The banner said "N pedidos por reconciliar" and the list it linked to could not show all N.

**The flag could not distinguish a stale rate from a valid one.** `flagOrdersForFxReconciliation` marked every row whose currency differed from the new base, because a boolean cannot record _which_ base a stored rate was computed against. A collector who moved the base currency PEN → EUR → PEN had all their USD orders re-marked on the way back, even though the stored USD→PEN rates had never stopped being correct. That is the incident that opened this ADR: 12 orders, each holding a perfectly good `3.393232`, reported as pending after the collector had already reconciled them. Re-reconciling would have fixed nothing, because the next round trip would break them again.

Both failures have the same shape. The truth ("can this row be converted into the current base currency?") is a function of data the row already has, and the flag was a hand-maintained cache of that function — one that every write path had to remember to refresh, and one that could not represent the answer accurately even when it was refreshed.

## Decision

**Remove `needsExchangeRateUpdate`. Record the base currency each stored rate converts into, and derive the pending state from it.**

`Order.exchangeRateBaseCode` and `Delivery.exchangeRateBaseCode` are written next to `exchangeRate` by every path that persists a rate. The predicate lives once, in `src/lib/fx/reconciliation.ts`:

```ts
needsFxReconciliation({ currencyCode, exchangeRate, exchangeRateBaseCode }, baseCurrencyCode);
```

false when there is no base currency configured or the row is already in it; true when there is no usable rate; otherwise `exchangeRateBaseCode !== baseCurrencyCode`.

Three consequences follow, and they are the point of the change:

1. **No screen can disagree with another.** The same module exports `buildNeedsFxReconciliationWhere`, a Prisma `where` fragment with the same arms, so the SQL-side filter, the count, the modal rows and the in-memory dashboard rollup are one definition expressed twice rather than two definitions maintained in parallel.
2. **A base-currency change writes nothing.** `flagOrdersForFxReconciliation` and `flagDeliveriesForFxReconciliation` are deleted, and with them `applyBaseCurrencyChange` and its `BaseCurrencyChangeRollback` sentinel; changing the base currency is now a plain preferences patch. A round trip is self-healing: rates tagged `PEN` read as valid again the moment the base is PEN again.
3. **Reconciling is stamping.** `applyOrderExchangeRates` takes the base currency and records it with each confirmed rate. Nothing "clears a flag"; the row simply becomes convertible.

The `exchangeRateBaseCode: null` arm of the `where` fragment is written out explicitly rather than folded into `{ not: base }`, because SQL three-valued logic drops NULL rows from a `<>` comparison — which would have hidden every never-reconciled row from the list built to surface it, reintroducing the original bug through the back door.

### Migration and the honest gap

`20260803053836_derive_fx_reconciliation_from_rate_base` backfills `exchangeRateBaseCode` from the user's current base **only** where the old flag asserted the rate was good (`needsExchangeRateUpdate = false` and a rate present). Rows that were still flagged carry a rate of unknown provenance — that is precisely what the flag meant — so they keep a NULL base code and continue to read as pending.

This is deliberate. Attributing those rates would mean guessing, in a migration, which base a number was computed against; where the guess was wrong it would silently mark an unreconciled order as reconciled and corrupt a dashboard total with no trace. The cost is that a collector mid-incident reconciles those rows once more. After that the state is durable, and the round trip cannot re-break it.

## Alternatives rejected

**Keep the flag and fix only the dashboard.** Making `rollUpToBaseCurrency` exclude on the flag alone would have aligned the two screens, but a foreign-currency order with no rate would then be silently converted (or counted as convertible) — trading a visible inconsistency for an invisible wrong number. It also leaves the round-trip bug entirely untouched.

**Keep the flag and set it correctly at every write.** This was implemented first and does close the create/edit gap. It cannot close the round-trip gap: with no record of a rate's target base, "is this rate stale?" is unanswerable at the moment the base changes, so the only safe bulk answer remains "assume all of them are" — which is the behavior that caused the incident.

**Normalize every rate to a single pivot currency.** Storing all rates against, say, USD makes any base derivable by composition. It is a larger change, introduces float-composition error into every figure, and rewrites historical rates the collector entered by hand — which the product deliberately never does (see the no-silent-bulk-rate-mutation rule the FX modal is built around).

## Consequences

- `needsExchangeRateUpdate` no longer exists on either model. Query DTOs still expose a **derived** `needsExchangeRateUpdate` boolean so detail UIs are unchanged; it is computed, never stored.
- Detail queries now need the collector's base currency, taken from `getCollectorPreferencesSnapshot` (React-`cache()`d, so it is deduped per request).
- `updateExchangeRatesAction` revalidates `/[locale]/dashboard` as well as `/[locale]/orders`; the banner reads the same derivation and would otherwise stay stale after a successful reconcile.
- A rate entered while the collector has no base currency configured records a NULL base and reads as pending once one is set. That is correct: nothing established what it converted into.
