/**
 * Pure, synchronous helpers shared by the settlement-on-arrival actions (`WO-08`, `ADR 0032`):
 * `quickArrivalAction.ts`, `storeArrivalAction.ts`, and `settlementActions.ts` itself. Deliberately
 * NOT in `settlementActions.ts`: that file carries `"use server"`, and Next.js requires every
 * top-level export of a `"use server"` module to be an async Server Action — a plain synchronous
 * helper exported alongside them fails the production build ("Server Actions must be async
 * functions"). Keeping these here, with no directive, is what lets the async actions import them
 * without becoming actions themselves.
 */

import type { ClosedOrderInput, OrderCloseMoneyOutcome } from "@/lib/data/orders/storePaymentMutations";
import type { SettlementBranchHint, SettlementOrderIntent } from "@/lib/deliveries/deliveryValidation";

/**
 * One order's money outcome, as any settlement-capable action returns it to the client: the raw
 * {@link OrderCloseMoneyOutcome} plus the currency it settled in, so the client can format a toast
 * without a second lookup.
 */
export type SettlementMoneyOutcome = {
  orderId: string;
  currencyCode: string;
  status: OrderCloseMoneyOutcome["status"];
  consumedMinor: number | null;
  settledAmountMinor: number | null;
  error?: string;
};

type BuildOrderInputsParams = {
  submittedProductIds: string[];
  settleRemainder: boolean;
  settlementDate: Date;
  settlementIntents?: SettlementOrderIntent[];
};

/**
 * Builds one batch of {@link ClosedOrderInput}s, all sharing the same `closed` value. Shared by
 * {@link buildClosedOrderInputs} and {@link buildOpenOrderSettlementInputs} so the "settlement
 * enabled only when the checkbox was checked, deliveredItemIds always the full submitted selection"
 * rule lives in exactly one place regardless of which branch (full close or partial-still-open) an
 * order falls into.
 *
 * `submittedProductIds` is passed uniformly to every order, closed or open: `resolveSettlementPlan`
 * itself intersects it with each order's own items, so an id belonging to a different order in the
 * same batch is simply ignored rather than mis-attributed.
 */
function buildOrderInputs(orderIds: string[], closed: boolean, params: BuildOrderInputsParams): ClosedOrderInput[] {
  const manualByOrderId = new Map(
    (params.settlementIntents ?? [])
      .filter((intent) => intent.manualAmountMinor !== undefined)
      .map((intent) => [intent.orderId, intent.manualAmountMinor as number]),
  );

  return orderIds.map((orderId) => ({
    orderId,
    closed,
    settlement: params.settleRemainder
      ? {
          enabled: true,
          deliveredItemIds: params.submittedProductIds,
          settlementDate: params.settlementDate,
          manualAmountMinor: manualByOrderId.get(orderId),
        }
      : undefined,
  }));
}

/**
 * Builds the money transaction's per-order input for every order THIS event actually closed
 * (`WO-08`, `FR-08-46`). Shared by `quickArrivalAction`, `storeArrivalAction`, and (with a freshly
 * re-derived closed-order set) `retrySettlementAction`. `closed: true` always: consumption runs for
 * every one of these regardless of the checkbox, only the settlement half follows it.
 */
export function buildClosedOrderInputs(closedOrderIds: string[], params: BuildOrderInputsParams): ClosedOrderInput[] {
  return buildOrderInputs(closedOrderIds, true, params);
}

/**
 * Builds the partial branch's own entries (BLOCKER F3 wiring, 2026-08-20 review): an order this
 * event AFFECTED (delivered some of its items) but did not close. `closed` stays `false` for every
 * one of these, so consumption never runs for them — there is nothing to close — but the settlement
 * half, when enabled, does: `resolveSettlementPlan` is itself what tells a genuine partial arrival
 * from a full close, by reading the order's own current per-item delivery state rather than trusting
 * a flag passed in from here.
 *
 * Returns nothing at all when the collector left "Ya pagué el resto" unchecked: an open order with
 * no settlement enabled has no consumption to run either (`closed: false`), so a closedOrder entry
 * for it would be a pure no-op, not worth a wasted `runSerializableTransaction` per order.
 */
export function buildOpenOrderSettlementInputs(
  openOrderIds: string[],
  params: BuildOrderInputsParams,
): ClosedOrderInput[] {
  if (!params.settleRemainder || openOrderIds.length === 0) return [];
  return buildOrderInputs(openOrderIds, false, params);
}

/** Zips money outcomes with the currency each order settled in, for client-side toast formatting. */
export function attachCurrencyCodes(
  outcomes: OrderCloseMoneyOutcome[],
  currencyByOrderId: Map<string, string>,
): SettlementMoneyOutcome[] {
  return outcomes.map((outcome) => ({
    ...outcome,
    currencyCode: currencyByOrderId.get(outcome.orderId) ?? "",
  }));
}

/**
 * Aggregate analytics figures for a batch of money outcomes (`WO-08` Analytics section):
 * `settled` is true the moment any order actually wrote a settlement payment, `settledAmountMinor`
 * sums every settled order's own figure (summed across currencies when a batch spans more than
 * one, which is rare — a per-currency breakdown is not worth a second property today), and
 * `branch` is the client-observed hint for whichever order actually settled, defaulting to "full"
 * (the dominant case, `ADR 0032`'s own census) when no hint was supplied for it.
 */
export function summarizeSettlementAnalytics(
  outcomes: SettlementMoneyOutcome[],
  settlementIntents?: SettlementOrderIntent[],
): { settled: boolean; branch: SettlementBranchHint; amountMinor: number; consumedMinor: number } {
  const hintByOrderId = new Map((settlementIntents ?? []).map((intent) => [intent.orderId, intent.branchHint]));
  let amountMinor = 0;
  let consumedMinor = 0;
  let branch: SettlementBranchHint = "not_settled";
  let settled = false;

  for (const outcome of outcomes) {
    consumedMinor += outcome.consumedMinor ?? 0;
    if (outcome.status !== "settled" || !outcome.settledAmountMinor) continue;
    settled = true;
    amountMinor += outcome.settledAmountMinor;
    const hint = hintByOrderId.get(outcome.orderId);
    if (hint && hint !== "not_settled") branch = hint;
    else if (branch === "not_settled") branch = "full";
  }

  return { settled, branch, amountMinor, consumedMinor };
}
