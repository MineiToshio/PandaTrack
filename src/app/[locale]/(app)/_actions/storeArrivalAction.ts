"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { createDelivery } from "@/lib/data/deliveries/deliveryMutations";
import { getEligibleProductsForStore } from "@/lib/data/deliveries/deliveryQueries";
import { getOrderDetail } from "@/lib/data/orders/orderQueries";
import { runOrderCloseMoneyTransaction, type ClosedOrderInput } from "@/lib/data/orders/storePaymentMutations";
import { getCollectorPreferencesSnapshot } from "@/lib/data/user-settings/userSettingsQueries";
import { deliveryStoreArrivalSchema, type SettlementOrderIntent } from "@/lib/deliveries/deliveryValidation";
import { revalidateCollectionSurfaces } from "@/lib/cache/revalidateCollectionSurfaces";
import {
  attachCurrencyCodes,
  buildClosedOrderInputs,
  buildOpenOrderSettlementInputs,
  summarizeSettlementAnalytics,
  type SettlementMoneyOutcome,
} from "./settlementActionHelpers";

export type StoreArrivalActionInput = {
  storeId: string;
  productIds: string[];
  receivedDate: Date;
  /** Omitted when the collector does not know when the store dispatched it. */
  shippedDate: Date | null;
  /** Minor units, already parsed by the client form. */
  cost: number;
  currencyCode: string;
  exchangeRate: number | null;
  /** Settlement on arrival (`WO-08`, `ADR 0032`), applied per closed order in the batch. */
  settleRemainder: boolean;
  settlementDate?: Date;
  settlementIntents?: SettlementOrderIntent[];
};

export type StoreArrivalActionResult =
  | { ok: true; deliveryId: string; productCount: number; orderCount: number; moneyOutcomes: SettlementMoneyOutcome[] }
  | { ok: false; error: string; ineligibleProductIds?: string[] };

/**
 * Records a delivery that already reached the collector, scoped to a store rather than to a single
 * order ("ya me llegó" from the orders list "Por tienda" view).
 *
 * One `Delivery` per confirmation, never one per order, even when the selection spans several
 * orders of that store (`FR-08-02`, `BR-08-12`): the physical fact is one box, so N rows would mean
 * N `DLV-*` identifiers and N shipping-cost questions for a cost that belongs to the box.
 *
 * The products are never trusted as sent: `createDelivery` re-reads every item inside its own
 * transaction and refuses anything not owned by the caller (`PRODUCTS_FROM_DIFFERENT_STORE`), not
 * from `storeId`, not still eligible (`PRODUCT_NOT_ELIGIBLE`, with the offending ids so the client
 * can flag exactly those rows), or belonging to a cancelled order (`ORDER_CANCELLED`). This action
 * therefore does no ownership read of its own: adding one would be a second, drift-prone copy of a
 * rule the transaction already enforces atomically.
 *
 * `currencyCode` is the currency of the *shipping cost*, not of the products. A store-scoped
 * selection can legitimately mix orders denominated in different currencies; with the default cost
 * of 0 (`BR-08-10`) the code is only a unit label on the delivery row.
 */
export async function storeArrivalAction(input: StoreArrivalActionInput): Promise<StoreArrivalActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }
  const userId = session.user.id;

  const parsed = deliveryStoreArrivalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };
  }

  const preferences = await getCollectorPreferencesSnapshot(userId);
  const baseCurrencyCode = preferences?.baseCurrencyCode ?? null;
  if (baseCurrencyCode && parsed.data.currencyCode !== baseCurrencyCode && parsed.data.exchangeRate == null) {
    return { ok: false, error: "EXCHANGE_RATE_REQUIRED" };
  }

  try {
    // Partial branch (BLOCKER F3 wiring, 2026-08-20 review): resolving which order each submitted
    // product belongs to has to happen BEFORE `createDelivery` writes, because that same write is
    // what moves these products out of the NONE/ARRIVED_AT_STORE states this query itself filters
    // on — reading it after the write would silently find nothing. Only done when the checkbox is
    // checked: an unchecked box has no open-order entry to build (`buildOpenOrderSettlementInputs`
    // returns nothing for it either way), so there is no reason to pay for the extra read.
    const orderIdByProductId = new Map<string, string>();
    if (parsed.data.settleRemainder) {
      const eligible = await getEligibleProductsForStore(parsed.data.storeId, userId);
      for (const group of eligible.byOrder) {
        for (const product of group.products) orderIdByProductId.set(product.orderItemId, group.orderId);
      }
    }

    const result = await createDelivery(userId, {
      storeId: parsed.data.storeId,
      // Same standing-in rule as the per-order quick arrival: once the box is here the dispatch
      // date is unknowable, so the arrival date fills the required column (`FR-08-37`).
      deliveryDate: parsed.data.shippedDate ?? parsed.data.receivedDate,
      receivedDate: parsed.data.receivedDate,
      cost: parsed.data.cost,
      currencyCode: parsed.data.currencyCode,
      exchangeRate: parsed.data.exchangeRate,
      productIds: parsed.data.productIds,
    });

    if (!result.ok) {
      return { ok: false, error: result.error, ineligibleProductIds: result.ineligibleProductIds };
    }

    // Any cached copy of a list or the dashboard is now wrong; see the helper for why
    // `router.refresh()` on the client is not enough.
    revalidateCollectionSurfaces();

    // Money transaction (`FR-08-42`, `ADR 0032`, `FR-08-45`): one attempt per order this batch just
    // closed, PLUS one for every order the batch affected without closing when the checkbox was
    // checked (BLOCKER F3 wiring), in the deterministic `orderDate ASC, humanReadableId ASC` order
    // `runOrderCloseMoneyTransaction` already applies internally for the closed set. Independent
    // from the delivery transaction above — a throw here must never turn into `ok: false`, since the
    // arrival (and the whole batch) already committed.
    const settlementDate = parsed.data.settlementDate ?? parsed.data.receivedDate;
    const currencyByOrderId = new Map(result.closedOrders.map((order) => [order.orderId, order.currencyCode]));
    const closedOrderIdSet = new Set(result.closedOrders.map((order) => order.orderId));

    // Every order this batch's own products belong to, that did NOT close (the partial branch): the
    // submitted products minus whichever ones landed in a closed order.
    const openOrderIds = [
      ...new Set(
        parsed.data.productIds
          .map((productId) => orderIdByProductId.get(productId))
          .filter((orderId): orderId is string => orderId !== undefined && !closedOrderIdSet.has(orderId)),
      ),
    ];
    if (openOrderIds.length > 0) {
      for (const orderId of openOrderIds) {
        const order = await getOrderDetail(orderId, userId);
        if (order) currencyByOrderId.set(orderId, order.currencyCode);
      }
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
      ...buildOpenOrderSettlementInputs(openOrderIds, buildParams),
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
          scope.setContext("storeArrivalSettlement", { deliveryId: result.deliveryId, storeId: parsed.data.storeId });
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
      event: POSTHOG_EVENTS.DELIVERY.STORE_ARRIVAL_LOGGED,
      properties: {
        deliveryId: result.deliveryId,
        store_id: parsed.data.storeId,
        product_count: result.productCount,
        order_count: result.orderCount,
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
      orderCount: result.orderCount,
      moneyOutcomes,
    };
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("feature", "delivery_store_arrival");
      scope.setContext("storeArrival", {
        storeId: parsed.data.storeId,
        productCount: parsed.data.productIds.length,
        currencyCode: parsed.data.currencyCode,
        hasExchangeRate: parsed.data.exchangeRate != null,
      });
      Sentry.captureException(error);
    });
    return { ok: false, error: "server_error" };
  }
}
