"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { createDelivery } from "@/lib/data/deliveries/deliveryMutations";
import { getDeliverySourceOrder } from "@/lib/data/deliveries/deliveryQueries";
import { getOrderDetail } from "@/lib/data/orders/orderQueries";
import { runOrderCloseMoneyTransaction, type ClosedOrderInput } from "@/lib/data/orders/storePaymentMutations";
import { getCollectorPreferencesSnapshot } from "@/lib/data/user-settings/userSettingsQueries";
import { deliveryQuickArrivalSchema, type SettlementOrderIntent } from "@/lib/deliveries/deliveryValidation";
import { revalidateCollectionSurfaces } from "@/lib/cache/revalidateCollectionSurfaces";
import type { ProgressionDelta } from "@/lib/data/progression/accrual";
import {
  attachCurrencyCodes,
  buildClosedOrderInputs,
  buildOpenOrderSettlementInputs,
  summarizeSettlementAnalytics,
  type SettlementMoneyOutcome,
} from "./settlementActionHelpers";

export type QuickArrivalActionInput = {
  orderId: string;
  productIds: string[];
  receivedDate: Date;
  /** Omitted when the collector does not know when the store dispatched it. */
  shippedDate: Date | null;
  /** Minor units, already parsed by the client form. */
  cost: number;
  currencyCode: string;
  exchangeRate: number | null;
  /** Settlement on arrival (`WO-08`, `ADR 0032`). */
  settleRemainder: boolean;
  settlementDate?: Date;
  settlementIntents?: SettlementOrderIntent[];
};

export type QuickArrivalActionResult =
  | {
      ok: true;
      deliveryId: string;
      productCount: number;
      moneyOutcomes: SettlementMoneyOutcome[];
      /** `null` when the credit step itself failed; never a partial or guessed delta. */
      progression: ProgressionDelta | null;
    }
  | { ok: false; error: string };

/**
 * Records a delivery that already reached the collector, in one step ("ya me llegó").
 *
 * The store is resolved from the owned order rather than trusted from the client, and the write
 * itself goes through the shared `createDelivery` transaction with `receivedDate` set, so the
 * delivery is born DELIVERED and the source order status is re-derived exactly as it would be
 * through the wizard plus mark-delivered.
 */
export async function quickArrivalAction(input: QuickArrivalActionInput): Promise<QuickArrivalActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }
  const userId = session.user.id;

  const parsed = deliveryQuickArrivalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };
  }

  const sourceOrder = await getDeliverySourceOrder(parsed.data.orderId, userId);
  if (!sourceOrder) {
    return { ok: false, error: "ORDER_NOT_FOUND" };
  }
  // The cancelled-order refusal is no longer checked here: it lives inside `createDelivery`, so
  // every entry point into a delivery inherits it instead of only this one.

  const preferences = await getCollectorPreferencesSnapshot(userId);
  const baseCurrencyCode = preferences?.baseCurrencyCode ?? null;
  if (baseCurrencyCode && parsed.data.currencyCode !== baseCurrencyCode && parsed.data.exchangeRate == null) {
    return { ok: false, error: "EXCHANGE_RATE_REQUIRED" };
  }

  try {
    const result = await createDelivery(userId, {
      storeId: sourceOrder.storeId,
      // The shipping date is genuinely unknowable once the box is already here; standing it in
      // with the arrival date keeps the required column honest about the only fact we have.
      deliveryDate: parsed.data.shippedDate ?? parsed.data.receivedDate,
      receivedDate: parsed.data.receivedDate,
      cost: parsed.data.cost,
      currencyCode: parsed.data.currencyCode,
      exchangeRate: parsed.data.exchangeRate,
      productIds: parsed.data.productIds,
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    // Any cached copy of a list or the dashboard is now wrong; see the helper for why

    // `router.refresh()` on the client is not enough.

    revalidateCollectionSurfaces();

    // Money transaction (`FR-08-42`, `ADR 0032`): attempted only once the delivery transaction
    // above has already committed, and INDEPENDENT from it — a failure past this point must never
    // turn into an `ok: false` for the whole action, or the collector would be told their arrival
    // failed when it in fact already persisted. Any throw here is caught locally and reported as a
    // "pending" outcome per order instead, which is exactly the state the client's Retry affordance
    // exists to resolve.
    const settlementDate = parsed.data.settlementDate ?? parsed.data.receivedDate;
    const currencyByOrderId = new Map(result.closedOrders.map((order) => [order.orderId, order.currencyCode]));

    // Partial branch (BLOCKER F3 wiring, 2026-08-20 review): this flow's one order can stay OPEN —
    // this arrival only delivered some of its own items — while the collector still checked "Ya
    // pagué el resto". Before this, an order that stayed open got no `ClosedOrderInput` at all, so
    // the money transaction was never even called for it: consumption never runs for it (nothing
    // closed), but the checked settlement still should, off the fresh, adjustment-aware resolver.
    const orderStayedOpen = !result.closedOrders.some((order) => order.orderId === parsed.data.orderId);
    if (orderStayedOpen && parsed.data.settleRemainder && !currencyByOrderId.has(parsed.data.orderId)) {
      const order = await getOrderDetail(parsed.data.orderId, userId);
      if (order) currencyByOrderId.set(parsed.data.orderId, order.currencyCode);
    }

    const buildParams = {
      submittedProductIds: parsed.data.productIds,
      settleRemainder: parsed.data.settleRemainder,
      settlementDate,
      settlementIntents: parsed.data.settlementIntents,
    };
    const closedOrderInputs: ClosedOrderInput[] = [
      ...buildClosedOrderInputs(
        result.closedOrders.map((order) => order.orderId),
        buildParams,
      ),
      ...buildOpenOrderSettlementInputs(orderStayedOpen ? [parsed.data.orderId] : [], buildParams),
    ];

    let moneyOutcomes: SettlementMoneyOutcome[] = [];
    if (closedOrderInputs.length > 0) {
      try {
        moneyOutcomes = attachCurrencyCodes(
          await runOrderCloseMoneyTransaction({
            userId,
            deliveryId: result.deliveryId,
            closedOrders: closedOrderInputs,
          }),
          currencyByOrderId,
        );
      } catch (moneyError) {
        Sentry.withScope((scope) => {
          scope.setTag("feature", "delivery_settlement_money_transaction");
          scope.setContext("quickArrivalSettlement", { deliveryId: result.deliveryId });
          Sentry.captureException(moneyError);
        });
        moneyOutcomes = closedOrderInputs.map((input) => ({
          orderId: input.orderId,
          currencyCode: currencyByOrderId.get(input.orderId) ?? "",
          status: "pending" as const,
          consumedMinor: null,
          settledAmountMinor: null,
        }));
      }
    }

    const summary = summarizeSettlementAnalytics(moneyOutcomes, parsed.data.settlementIntents);

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.DELIVERY.QUICK_ARRIVAL_LOGGED,
      properties: {
        deliveryId: result.deliveryId,
        product_count: result.productCount,
        order_id: parsed.data.orderId,
        had_shipped_date: parsed.data.shippedDate != null,
        backdated: parsed.data.receivedDate.toDateString() !== new Date().toDateString(),
        settled: summary.settled,
        settlement_branch: summary.branch,
        settlement_amount_minor: summary.amountMinor,
        settlement_date_edited: settlementDate.getTime() !== parsed.data.receivedDate.getTime(),
      },
    });
    await posthog.shutdown();

    return {
      ok: true,
      deliveryId: result.deliveryId,
      productCount: result.productCount,
      moneyOutcomes,
      progression: result.progression,
    };
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("feature", "delivery_quick_arrival");
      scope.setContext("quickArrival", {
        orderId: parsed.data.orderId,
        productCount: parsed.data.productIds.length,
        currencyCode: parsed.data.currencyCode,
        hasExchangeRate: parsed.data.exchangeRate != null,
      });
      Sentry.captureException(error);
    });
    return { ok: false, error: "server_error" };
  }
}
