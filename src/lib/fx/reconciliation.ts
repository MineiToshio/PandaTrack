/**
 * The single definition of "this order/delivery still needs FX reconciliation".
 *
 * There is no stored flag. The state is derived from the row's own currency data against the
 * collector's current base currency, so the dashboard rollup, the `?fxPending=true` list filter,
 * the reconciliation modal, and every write path all read the same truth by construction. See
 * ADR 0024 for why the previous `needsExchangeRateUpdate` boolean was removed.
 *
 * `exchangeRateBaseCode` is the base currency the stored `exchangeRate` converts INTO, captured at
 * write time. It is what makes the derivation possible: a rate alone cannot tell you whether it is
 * still meaningful, because changing the base currency invalidates it without touching it. Keeping
 * the target base next to the rate also means a base-currency round trip (PEN → USD → PEN) leaves
 * previously reconciled rows correct instead of re-marking them.
 */

/** Amount-carrying FX context shared by orders and deliveries. */
export type FxContext = {
  currencyCode: string;
  exchangeRate: number | null;
  exchangeRateBaseCode: string | null;
};

/**
 * True when the row cannot be converted into the given base currency and the collector must supply
 * a rate. False when no base currency is configured yet (nothing can be stale without one) or the
 * row is already denominated in the base currency.
 */
export function needsFxReconciliation(context: FxContext, baseCurrencyCode: string | null): boolean {
  if (!baseCurrencyCode || context.currencyCode === baseCurrencyCode) return false;
  if (context.exchangeRate === null || context.exchangeRate <= 0) return true;
  return context.exchangeRateBaseCode !== baseCurrencyCode;
}

/**
 * The same predicate as a Prisma `where` fragment, so SQL-side filters and counts cannot drift from
 * the in-memory derivation above. Returns null when there is no base currency, which callers treat
 * as "nothing is pending".
 *
 * The `exchangeRateBaseCode: null` arm is spelled out rather than folded into `{ not: base }`
 * because SQL three-valued logic drops NULL rows from a `<>` comparison, which would silently hide
 * every never-reconciled row from the very list meant to surface it.
 */
export function buildNeedsFxReconciliationWhere(baseCurrencyCode: string | null | undefined) {
  if (!baseCurrencyCode) return null;
  return {
    currencyCode: { not: baseCurrencyCode },
    OR: [
      { exchangeRate: null },
      { exchangeRate: { lte: 0 } },
      { exchangeRateBaseCode: null },
      { exchangeRateBaseCode: { not: baseCurrencyCode } },
    ],
  };
}

/**
 * The base code to persist next to a rate being written. Null whenever there is no usable rate, so
 * a cleared rate never leaves a stale base code behind claiming the row is reconciled.
 */
export function resolveExchangeRateBaseCode(
  exchangeRate: number | null,
  baseCurrencyCode: string | null,
): string | null {
  if (exchangeRate === null || exchangeRate <= 0) return null;
  return baseCurrencyCode;
}
