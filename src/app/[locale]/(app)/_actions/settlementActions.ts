"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { getDeliveryDetail } from "@/lib/data/deliveries/deliveryQueries";
import { getOrderDetail, type OrderDetailFull } from "@/lib/data/orders/orderQueries";
import { getOpenBalanceMinorByOrderIds, getStoreDebtByCurrency } from "@/lib/data/orders/storePaymentQueries";
import {
  restoreSettlementPayments,
  runOrderCloseMoneyTransaction,
  type RestoreSettlementPaymentSnapshot,
} from "@/lib/data/orders/storePaymentMutations";
import { markDeliveryDelivered, cancelDelivery } from "@/lib/data/deliveries/deliveryMutations";
import {
  retrySettlementSchema,
  settlementContextRequestSchema,
  undoReopenSchema,
  type SettlementOrderIntent,
} from "@/lib/deliveries/deliveryValidation";
import { revalidateCollectionSurfaces } from "@/lib/cache/revalidateCollectionSurfaces";
import {
  attachCurrencyCodes,
  buildClosedOrderInputs,
  buildOpenOrderSettlementInputs,
  summarizeSettlementAnalytics,
  type SettlementMoneyOutcome,
} from "./settlementActionHelpers";

// ---------------------------------------------------------------------------
// getSettlementContextAction — preview for QuickArrivalModal
// ---------------------------------------------------------------------------

export type SettlementPlanPreview =
  | { kind: "nothingToSettle" }
  | { kind: "computedFull"; amountMinor: number; appliedUnassignedMinor: number }
  | { kind: "computedPartial"; amountMinor: number; undetailed: boolean }
  | { kind: "manual"; reasonCode: "missingPrice" | "undetailedMoney"; referenceAmountMinor: number };

export type SettlementOrderContext = {
  orderId: string;
  currencyCode: string;
  /** Whether THIS prospective arrival (given the productIds the caller passed) would leave every
      product of the order DELIVERED. Purely a client-facing prediction: the actual write always
      re-derives this from the delivery transaction's own commit (`persistDerivedOrderStatuses`). */
  closesOrder: boolean;
  /** Unassigned money currently sitting in this order's (store, currency) pool. */
  unassignedMinor: number;
  plan: SettlementPlanPreview;
  /** The checkbox's recommended default for this order, per the double-counting guard (`FR-08-44`,
      `FR-08-46`): pre-marked unless the arrival leaves the order open AND unassigned money exists. */
  defaultChecked: boolean;
};

export type GetSettlementContextActionResult =
  { ok: true; contexts: SettlementOrderContext[] } | { ok: false; error: string };

/**
 * Resolves what `QuickArrivalModal` should show for the settlement checkbox, before anything is
 * submitted (`WO-08`). Deliberately reads through `getOrderDetail` (item-level `deliveryState`,
 * `allocatedMinor`, `undetailedPaidMinor`) and `getStoreDebtByCurrency` (`unassignedMinor`) — both
 * already-exported, non-transactional query functions — rather than the write path's own
 * `resolveSettlementPlan`: that resolver reads the order's CURRENT `deliveryState` to decide the
 * full-vs-partial branch, which is only correct once the arrival has actually been committed. Before
 * submission the products this arrival would deliver are still NONE/ARRIVED_AT_STORE, so calling the
 * resolver directly here would misjudge "closes the order" as false even when this exact arrival is
 * the one that completes it. This function simulates that post-arrival state itself instead.
 *
 * `openBalanceApprox` reads the canonical NET balance (`getOpenBalanceMinorByOrderIds`, `ADR 0034`)
 * rather than `order.remainingAmount` (`totalCost - allocated`, gross): a store reconciliation
 * write-off (`StoreAccountAdjustmentLine`) lowers what the order genuinely still owes without ever
 * touching `allocatedAmountMinor`, so the gross figure used to keep offering a settlement checkbox
 * for an order the collector had already written off entirely (MAJOR D1, 2026-08-20 review). The
 * actual write always goes through this same net-aware resolver inside
 * `runOrderCloseMoneyTransaction`, so this was purely a preview-display bug, never a wrong write.
 */
export async function getSettlementContextAction(input: {
  orders: { orderId: string; deliveredItemIds: string[] }[];
}): Promise<GetSettlementContextActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = settlementContextRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };

  try {
    const debtRowsByStoreId = new Map<string, Awaited<ReturnType<typeof getStoreDebtByCurrency>>>();
    const contexts: SettlementOrderContext[] = [];
    const openBalanceByOrderId = await getOpenBalanceMinorByOrderIds(
      userId,
      parsed.data.orders.map((order) => order.orderId),
    );

    for (const { orderId, deliveredItemIds } of parsed.data.orders) {
      const order: OrderDetailFull | null = await getOrderDetail(orderId, userId);
      if (!order) continue;

      const deliveredIdSet = new Set(deliveredItemIds);
      const closesOrder = order.items.every(
        (item) => item.deliveryState === "delivered" || deliveredIdSet.has(item.id),
      );

      let debtRows = debtRowsByStoreId.get(order.storeId);
      if (!debtRows) {
        debtRows = await getStoreDebtByCurrency(userId, order.storeId);
        debtRowsByStoreId.set(order.storeId, debtRows);
      }
      const unassignedMinor = debtRows.find((row) => row.currencyCode === order.currencyCode)?.unassignedMinor ?? 0;

      const openBalanceApprox = openBalanceByOrderId.get(orderId) ?? order.remainingAmount;

      if (openBalanceApprox <= 0) {
        contexts.push({
          orderId,
          currencyCode: order.currencyCode,
          closesOrder,
          unassignedMinor,
          plan: { kind: "nothingToSettle" },
          defaultChecked: false,
        });
        continue;
      }

      if (closesOrder) {
        const appliedUnassignedMinor = Math.max(0, Math.min(openBalanceApprox, unassignedMinor));
        contexts.push({
          orderId,
          currencyCode: order.currencyCode,
          closesOrder,
          unassignedMinor,
          plan: {
            kind: "computedFull",
            amountMinor: openBalanceApprox - appliedUnassignedMinor,
            appliedUnassignedMinor,
          },
          // Informative branch (WO-08 "double-counting guard"): consumption always runs first when
          // the arrival closes the order, so there is nothing left to double-count against.
          defaultChecked: true,
        });
        continue;
      }

      const deliveredItems = order.items.filter((item) => deliveredIdSet.has(item.id));
      const hasMissingPrice = deliveredItems.some((item) => item.unitPrice === null);
      const hasUndetailedAllocation = order.undetailedPaidMinor > 0;

      if (hasMissingPrice || hasUndetailedAllocation) {
        contexts.push({
          orderId,
          currencyCode: order.currencyCode,
          closesOrder,
          unassignedMinor,
          plan: {
            kind: "manual",
            reasonCode: hasMissingPrice ? "missingPrice" : "undetailedMoney",
            referenceAmountMinor: openBalanceApprox,
          },
          defaultChecked: unassignedMinor === 0,
        });
        continue;
      }

      const isSingleProductOrder = order.items.length === 1;
      let computedSum = 0;
      for (const item of deliveredItems) {
        const base = isSingleProductOrder ? order.totalCost : (item.unitPrice as number) * item.quantity;
        computedSum += Math.max(0, base - item.allocatedMinor);
      }
      const cappedAmount = Math.min(computedSum, openBalanceApprox);

      contexts.push({
        orderId,
        currencyCode: order.currencyCode,
        closesOrder,
        unassignedMinor,
        plan: { kind: "computedPartial", amountMinor: cappedAmount, undetailed: cappedAmount < computedSum },
        defaultChecked: unassignedMinor === 0,
      });
    }

    return { ok: true, contexts };
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("feature", "delivery_settlement");
      scope.setContext("settlementContext", { orderCount: parsed.data.orders.length });
      Sentry.captureException(error);
    });
    return { ok: false, error: "server_error" };
  }
}

// ---------------------------------------------------------------------------
// retrySettlementAction
// ---------------------------------------------------------------------------

export type RetrySettlementActionResult =
  | { ok: true; noLongerPending: false; outcomes: SettlementMoneyOutcome[] }
  | { ok: true; noLongerPending: true }
  | { ok: false; error: string };

/**
 * Re-attempts the money transaction for a delivery whose settlement failed after its delivery
 * transaction already committed (`FR-08-42`, `WO-08` risk 4).
 *
 * Re-reads the delivery fresh and refuses unless it still reads `DELIVERED` (`Retry`'s precondition,
 * Technical Notes): a reopen in the gap between the original failure and this call means there is
 * nothing left to settle against. Every source order's fresh status decides which of the two
 * branches it falls into today, never trusted from the client's stored intent: `COMPLETED` is the
 * closed branch (consumption always runs, settlement follows the checkbox), anything else is the
 * partial-still-open branch (`closed: false`, settlement only when checked and only when enabled by
 * `buildOpenOrderSettlementInputs`) — the partial branch used to be skipped entirely here (BLOCKER
 * F3, this same 2026-08-20 review), so a partial arrival's Retry silently did nothing for it. Only
 * the checkbox state, the date, and any manual figures survive from what the collector typed.
 *
 * Both sets are passed to ONE `runOrderCloseMoneyTransaction` call, never one call per order
 * (review minor, same pass): a per-order call defeats that function's own stop-on-refusal ordering
 * and its shared-pool draining sequence (`FR-08-45`), both of which only hold across a single
 * invocation given the whole batch at once.
 */
export async function retrySettlementAction(input: {
  deliveryId: string;
  settleRemainder: boolean;
  settlementDate: Date;
  settlementIntents?: SettlementOrderIntent[];
}): Promise<RetrySettlementActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = retrySettlementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };

  try {
    const delivery = await getDeliveryDetail(parsed.data.deliveryId, userId);
    if (!delivery || delivery.status !== "DELIVERED") {
      return { ok: true, noLongerPending: true };
    }

    // Fresh per-order status: a source order that reads COMPLETED right now closed for good; any
    // other status is the partial branch, still open, still eligible for its own settlement.
    const currencyByOrderId = new Map<string, string>();
    const closedOrderIds: string[] = [];
    const openOrderIds: string[] = [];
    for (const group of delivery.sourceOrders) {
      const order = await getOrderDetail(group.orderId, userId);
      if (!order) continue;
      currencyByOrderId.set(group.orderId, order.currencyCode);
      if (order.status === "COMPLETED") closedOrderIds.push(group.orderId);
      else openOrderIds.push(group.orderId);
    }

    if (closedOrderIds.length === 0 && openOrderIds.length === 0) {
      return { ok: true, noLongerPending: true };
    }

    // The union of every source order's own items, passed uniformly to every entry: the resolver
    // intersects it with each order's own item set (the same established convention
    // `quickArrivalAction`/`storeArrivalAction` already rely on), so an id belonging to a different
    // order in the same delivery is simply ignored rather than mis-attributed.
    const submittedProductIds = delivery.sourceOrders.flatMap((group) => group.items.map((item) => item.id));
    const buildParams = {
      submittedProductIds,
      settleRemainder: parsed.data.settleRemainder,
      settlementDate: parsed.data.settlementDate,
      settlementIntents: parsed.data.settlementIntents,
    };
    const closedOrderInputs = [
      ...buildClosedOrderInputs(closedOrderIds, buildParams),
      ...buildOpenOrderSettlementInputs(openOrderIds, buildParams),
    ];

    if (closedOrderInputs.length === 0) {
      // Only open orders, and the checkbox is unchecked: nothing closed (so no consumption to run
      // either) and nothing to settle. Genuinely nothing left pending.
      return { ok: true, noLongerPending: true };
    }

    const rawOutcomes = await runOrderCloseMoneyTransaction({
      userId,
      deliveryId: parsed.data.deliveryId,
      closedOrders: closedOrderInputs,
    });

    revalidateCollectionSurfaces();

    const outcomes = attachCurrencyCodes(rawOutcomes, currencyByOrderId);
    const summary = summarizeSettlementAnalytics(outcomes, parsed.data.settlementIntents);

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.DELIVERY.SETTLEMENT_RETRIED,
      properties: {
        deliveryId: parsed.data.deliveryId,
        settled: summary.settled,
        settlement_branch: summary.branch,
        settlement_amount_minor: summary.amountMinor,
        consumed_unassigned_minor: summary.consumedMinor,
        any_refused: outcomes.some((outcome) => outcome.status === "refused"),
      },
    });
    await posthog.shutdown();

    return { ok: true, noLongerPending: false, outcomes };
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("feature", "delivery_settlement_retry");
      scope.setContext("settlementRetry", { deliveryId: input.deliveryId });
      Sentry.captureException(error);
    });
    return { ok: false, error: "server_error" };
  }
}

// ---------------------------------------------------------------------------
// undoReopenAction
// ---------------------------------------------------------------------------

export type UndoReopenActionResult = { ok: true } | { ok: false; error: string };

/**
 * The ONE Server Action that undoes a reopen (BLOCKER F1, 2026-08-20 review), sequential, never
 * two independent dispatches racing each other:
 *
 * 1. FIRST, restores the settlement `StorePayment`(s) the reopen deleted, verbatim (`FR-08-43`,
 *    `ADR 0032` §9) — never recomputed, since the order's balance may have moved since the reopen.
 *    A `NOT_FOUND` here (a crafted or stale snapshot naming a row the caller no longer owns) is a
 *    genuine refusal: the lifecycle re-write below never runs, because re-marking delivered and
 *    running consumption against a balance that was never actually refilled would be exactly the
 *    double-count this whole ordering exists to prevent.
 * 2. ONLY THEN re-applies the delivery's previous lifecycle state: `markDeliveryDelivered` when it
 *    was `DELIVERED` (consumption runs for whatever this re-closes, but settlement is ALWAYS
 *    disabled — `closed: true, settlement: undefined` for every one of `result.closedOrders` — since
 *    step 1 already refilled the balance the original settlement paid down; a fresh settlement here
 *    would double it), or `cancelDelivery` when it was `CANCELLED` (never produces a settlement of
 *    its own, so there is nothing for step 1 to have restored in that branch).
 *
 * Before this, `DeliveryDetailClient` fired `undoReopenSettlementAction` and the lifecycle action
 * concurrently (`void` + a separate `.then`), so the restore and the re-close's own consumption read
 * of the balance could interleave in either order.
 */
export async function undoReopenAction(input: {
  deliveryId: string;
  previousStatus: "DELIVERED" | "CANCELLED";
  receivedDate: Date | null;
  snapshot: RestoreSettlementPaymentSnapshot[];
}): Promise<UndoReopenActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = undoReopenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };

  try {
    if (parsed.data.snapshot.length > 0) {
      const restoreResult = await restoreSettlementPayments({ userId, snapshot: parsed.data.snapshot });
      if (!restoreResult.ok) return { ok: false, error: restoreResult.error };
    }

    if (parsed.data.previousStatus === "CANCELLED") {
      const result = await cancelDelivery(parsed.data.deliveryId, userId);
      if (!result.ok) return { ok: false, error: result.error };
    } else {
      // `undoReopenSchema` already refused a null `receivedDate` for this branch.
      const result = await markDeliveryDelivered(parsed.data.deliveryId, userId, parsed.data.receivedDate as Date);
      if (!result.ok) return { ok: false, error: result.error };

      // Consumption-only re-close, settlement NEVER enabled (F1): step 1 above already refilled
      // whatever balance the original settlement paid down, so running settlement again here would
      // write a second one against money that is no longer missing.
      if (result.closedOrders.length > 0) {
        try {
          await runOrderCloseMoneyTransaction({
            userId,
            deliveryId: parsed.data.deliveryId,
            closedOrders: result.closedOrders.map((order) => ({ orderId: order.orderId, closed: true })),
          });
        } catch (moneyError) {
          Sentry.withScope((scope) => {
            scope.setTag("feature", "delivery_undo_reopen_money_transaction");
            scope.setContext("undoReopen", { deliveryId: parsed.data.deliveryId });
            Sentry.captureException(moneyError);
          });
        }
      }
    }

    revalidateCollectionSurfaces();

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.DELIVERY.REOPEN_UNDONE,
      properties: { deliveryId: parsed.data.deliveryId, restoredPaymentsCount: parsed.data.snapshot.length },
    });
    await posthog.shutdown();

    return { ok: true };
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("feature", "delivery_settlement_undo");
      scope.setContext("undoReopenSettlement", { deliveryId: input.deliveryId });
      Sentry.captureException(error);
    });
    return { ok: false, error: "server_error" };
  }
}
