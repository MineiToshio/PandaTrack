import { prisma } from "@/lib/prisma";
import { DeliveryStatus, OrderItemDeliveryState, OrderStatus } from "../../../../generated/prisma/client";
import { resolveExchangeRateBaseCode } from "@/lib/fx/reconciliation";
import { generateOrderHumanReadableId } from "@/lib/orders/orderIdentifier";
import { calculatePaymentSummary } from "@/lib/orders/paymentSummary";
import { appendOrderHistoryEntry, OrderHistoryEventType } from "./orderHistoryMutations";
import { createOrderItems, findInvalidProductTypeKey, replaceOrderItems } from "./orderItemMutations";
import type { OrderCreateInput, OrderEditInput } from "@/lib/orders/orderValidation";

type CreateOrderResult =
  | { ok: true; orderId: string; humanReadableId: string }
  | { ok: false; error: "STORE_NOT_FOUND" | "INVALID_PRODUCT_TYPE" };

type EditOrderResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "ORDER_NOT_FOUND"
        | "ORDER_NOT_EDITABLE"
        | "STORE_NOT_FOUND"
        | "STORE_CHANGE_BLOCKED"
        | "INVALID_PRODUCT_TYPE"
        | "ITEM_HAS_LIVE_DELIVERY"
        // Total can't be lowered below the sum of payments already recorded — collectors
        // must delete payments first if they want to bring the total down past what's paid.
        | "TOTAL_BELOW_PAID";
    };

type CancelOrderResult = { ok: true } | { ok: false; error: "ORDER_NOT_FOUND" | "HAS_LIVE_DELIVERY_LINKS" };

type DeleteOrderResult = { ok: true } | { ok: false; error: "ORDER_NOT_FOUND" | "HAS_LIVE_DELIVERY_LINKS" };

type ReactivateOrderResult = { ok: true } | { ok: false; error: "ORDER_NOT_FOUND" | "ORDER_NOT_CANCELLED" };

/**
 * Sentinel used to refuse an order mutation from a point where a plain `return` would be wrong.
 *
 * Returning normally from a `prisma.$transaction` callback COMMITS the transaction; only a thrown
 * error rolls it back. So any refusal detected after a write must be raised as a throw and mapped
 * back to the public discriminated result outside the transaction, never returned from inside it.
 */
class InvalidProductTypeRollback extends Error {
  constructor() {
    super("INVALID_PRODUCT_TYPE");
    this.name = "InvalidProductTypeRollback";
  }
}

async function hasLiveDeliveryLinks(orderId: string): Promise<boolean> {
  const link = await prisma.deliveryOrderItem.findFirst({
    where: {
      orderItem: { orderId },
      delivery: { status: { not: DeliveryStatus.CANCELLED } },
    },
    select: { deliveryId: true },
  });
  return link !== null;
}

export async function createOrder(userId: string, input: OrderCreateInput): Promise<CreateOrderResult> {
  return prisma
    .$transaction<CreateOrderResult>(async (tx) => {
      const store = await tx.store.findFirst({
        where: { id: input.storeId },
        select: { id: true },
      });

      if (!store) {
        return { ok: false, error: "STORE_NOT_FOUND" };
      }

      // Category validation runs here, before the order row exists, even though `createOrderItems`
      // below validates again. Returning normally from a `$transaction` callback COMMITS it — only a
      // thrown error rolls it back — so refusing after `order.create` would leave a phantom order
      // (no items, no history entry) in the collector's list while the UI reported a failure.
      if (input.items && input.items.length > 0) {
        const productTypeKeys = input.items
          .map((item) => item.productTypeKey)
          .filter((key): key is string => key != null);
        const invalidKey = await findInvalidProductTypeKey(tx, productTypeKeys);
        if (invalidKey !== null) {
          return { ok: false, error: "INVALID_PRODUCT_TYPE" };
        }
      }

      const now = new Date();
      const humanReadableId = await generateOrderHumanReadableId(tx, userId, now);

      const user = await tx.user.findUnique({ where: { id: userId }, select: { baseCurrencyCode: true } });
      const exchangeRate = input.exchangeRate ?? null;

      const order = await tx.order.create({
        data: {
          storeId: input.storeId,
          userId,
          humanReadableId,
          orderDate: input.orderDate,
          expectedDeliveryFrom: input.expectedDeliveryFrom ?? null,
          expectedDeliveryTo: input.expectedDeliveryTo ?? null,
          currencyCode: input.currencyCode,
          exchangeRate,
          exchangeRateBaseCode: resolveExchangeRateBaseCode(exchangeRate, user?.baseCurrencyCode ?? null),
          totalCost: input.totalCost,
          note: input.note ?? null,
          status: OrderStatus.OPEN,
        },
        select: { id: true, humanReadableId: true },
      });

      if (input.items && input.items.length > 0) {
        const itemResult = await createOrderItems(tx, order.id, userId, input.items);
        if (!itemResult.ok) {
          // Unreachable while the pre-write check above covers every refusal `createOrderItems` can
          // raise, and deliberately a throw rather than a return: this point is past `order.create`,
          // where a return would commit the phantom order instead of discarding it.
          throw new InvalidProductTypeRollback();
        }
      }

      await appendOrderHistoryEntry({
        tx,
        orderId: order.id,
        userId,
        eventType: OrderHistoryEventType.ORDER_CREATED,
      });

      return { ok: true, orderId: order.id, humanReadableId: order.humanReadableId };
    })
    .catch((error: unknown) => {
      if (error instanceof InvalidProductTypeRollback) {
        return { ok: false, error: "INVALID_PRODUCT_TYPE" } as const;
      }
      throw error;
    });
}

export async function editOrder(orderId: string, userId: string, input: OrderEditInput): Promise<EditOrderResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      select: { status: true, storeId: true },
    });

    if (!order) {
      return { ok: false, error: "ORDER_NOT_FOUND" };
    }

    if (order.status === OrderStatus.CANCELLED) {
      return { ok: false, error: "ORDER_NOT_EDITABLE" };
    }

    if (input.storeId !== undefined && input.storeId !== order.storeId) {
      const hasDeliveries = await tx.deliveryOrderItem.findFirst({
        where: { orderItem: { orderId } },
        select: { deliveryId: true },
      });
      if (hasDeliveries || order.status !== OrderStatus.OPEN) {
        return { ok: false, error: "STORE_CHANGE_BLOCKED" };
      }
      const store = await tx.store.findFirst({ where: { id: input.storeId }, select: { id: true } });
      if (!store) {
        return { ok: false, error: "STORE_NOT_FOUND" };
      }
    }

    // Total guard — server-side safety net for the client check in `OrderEditForm`. We
    // refuse to update the total to a value below the sum of payments already recorded;
    // doing so would produce a negative `remainingAmount` everywhere downstream (hero,
    // sticky bar, list cards).
    let paymentCacheUpdate: { paidAmountMinor: number; paymentPercent: number } | undefined;
    if (input.totalCost !== undefined) {
      const paid = await tx.orderPayment.aggregate({ where: { orderId }, _sum: { amount: true } });
      const paidAmount = paid._sum.amount ?? 0;
      if (input.totalCost < paidAmount) {
        return { ok: false, error: "TOTAL_BELOW_PAID" };
      }
      // The paid ratio is relative to the total, so changing the total shifts paymentPercent even
      // though the paid amount is unchanged. Refresh the denormalized cache the orders list reads.
      const summary = calculatePaymentSummary(input.totalCost, [{ amount: paidAmount }]);
      paymentCacheUpdate = { paidAmountMinor: summary.paidAmount, paymentPercent: summary.paymentPercentage };
    }

    // Items are replaced before the order row is touched, because this is the last step that can
    // still refuse the edit. Returning normally from a `$transaction` callback COMMITS it — only a
    // thrown error rolls it back — so a refusal raised after `order.update` would persist the new
    // dates/total/note while telling the caller the edit failed. `replaceOrderItems` decides both of
    // its refusals before its own first write, so this whole block is all-or-nothing; keep it that
    // way if new failure modes are ever added there.
    if (input.items !== undefined) {
      const replaceResult = await replaceOrderItems(tx, orderId, userId, input.items);
      if (!replaceResult.ok) {
        if (replaceResult.error === "ITEM_HAS_LIVE_DELIVERY") {
          return { ok: false, error: "ITEM_HAS_LIVE_DELIVERY" };
        }
        return { ok: false, error: "INVALID_PRODUCT_TYPE" };
      }
    }

    // Re-stamped whenever the rate is submitted, so a stored rate always carries the base it was
    // entered against. An edit that leaves the rate untouched must not restamp it: the existing
    // base code still describes the existing rate.
    let rateUpdate: { exchangeRate: number | null; exchangeRateBaseCode: string | null } | undefined;
    if (input.exchangeRate !== undefined) {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { baseCurrencyCode: true } });
      rateUpdate = {
        exchangeRate: input.exchangeRate,
        exchangeRateBaseCode: resolveExchangeRateBaseCode(input.exchangeRate, user?.baseCurrencyCode ?? null),
      };
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        ...(input.storeId !== undefined ? { storeId: input.storeId } : {}),
        ...(input.orderDate !== undefined ? { orderDate: input.orderDate } : {}),
        ...(input.expectedDeliveryFrom !== undefined ? { expectedDeliveryFrom: input.expectedDeliveryFrom } : {}),
        ...(input.expectedDeliveryTo !== undefined ? { expectedDeliveryTo: input.expectedDeliveryTo } : {}),
        ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
        ...(rateUpdate ?? {}),
        ...(input.totalCost !== undefined ? { totalCost: input.totalCost } : {}),
        ...(paymentCacheUpdate ?? {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });

    return { ok: true };
  });
}

export async function cancelOrder(
  orderId: string,
  userId: string,
  cancellationReason: string | null = null,
  paymentsChoice: "keep" | "remove" = "keep",
): Promise<CancelOrderResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true },
    });

    if (!order) {
      return { ok: false, error: "ORDER_NOT_FOUND" };
    }

    const liveLink = await tx.deliveryOrderItem.findFirst({
      where: {
        orderItem: { orderId },
        delivery: { status: { not: DeliveryStatus.CANCELLED } },
      },
      select: { deliveryId: true },
    });

    if (liveLink) {
      return { ok: false, error: "HAS_LIVE_DELIVERY_LINKS" };
    }

    // Cancellation preserves payments and history by default — the order is archived, not
    // destroyed, and the reactivate flow relies on the payment trail still being available so
    // the collector can see what they paid before they paused the order. Kept payments are
    // treated as sunk/lost money on the dashboard.
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED, cancellationReason },
    });

    // Remove branch: the collector was refunded, or moved the money as credit to another order,
    // so the payments must not linger here (they would double-count or read as lost money). Drop
    // the ledger and reset the denormalized payment cache the orders list reads.
    if (paymentsChoice === "remove") {
      await tx.orderPayment.deleteMany({ where: { orderId } });
      await tx.order.update({
        where: { id: orderId },
        data: { paidAmountMinor: 0, paymentPercent: 0 },
      });
    }

    await appendOrderHistoryEntry({
      tx,
      orderId,
      userId,
      eventType: OrderHistoryEventType.ORDER_CANCELLED,
    });

    return { ok: true };
  });
}

export async function reactivateOrder(orderId: string, userId: string): Promise<ReactivateOrderResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      select: { status: true },
    });

    if (!order) {
      return { ok: false, error: "ORDER_NOT_FOUND" };
    }

    if (order.status !== OrderStatus.CANCELLED) {
      return { ok: false, error: "ORDER_NOT_CANCELLED" };
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.OPEN, cancellationReason: null },
    });

    await appendOrderHistoryEntry({
      tx,
      orderId,
      userId,
      eventType: OrderHistoryEventType.ORDER_REACTIVATED,
    });

    return { ok: true };
  });
}

/**
 * Applies collector-confirmed exchange rates to the given orders. Each order is scoped by
 * `userId` so a tampered payload can only ever touch the caller's own orders. Stamping each rate
 * with the base currency it was entered against is what takes the order out of the FX-pending set,
 * because pending-ness is derived from that pair rather than from a stored flag (ADR 0024). All
 * updates commit in a single transaction. Returns the number of orders actually updated.
 */
export async function applyOrderExchangeRates(
  userId: string,
  baseCurrencyCode: string | null,
  updates: Array<{ orderId: string; exchangeRate: number }>,
): Promise<number> {
  const results = await prisma.$transaction(
    updates.map((update) =>
      prisma.order.updateMany({
        where: { id: update.orderId, userId },
        data: {
          exchangeRate: update.exchangeRate,
          exchangeRateBaseCode: resolveExchangeRateBaseCode(update.exchangeRate, baseCurrencyCode),
        },
      }),
    ),
  );

  return results.reduce((sum, result) => sum + result.count, 0);
}

type SetItemDeliveryStateResult =
  | { ok: true; deliveryState: OrderItemDeliveryState }
  | { ok: false; error: "ITEM_NOT_FOUND" | "ITEM_HAS_LIVE_DELIVERY" | "ORDER_CANCELLED" };

/**
 * Toggles between `NONE` (pending in store) and `ARRIVED_AT_STORE` (ready at store).
 * Refuses when the item is already linked to a non-cancelled delivery — the delivery owns
 * `in_transit` / `delivered`, so the user shouldn't be able to flip the read-only state.
 */
export async function setOrderItemArrivedAtStore(
  itemId: string,
  userId: string,
  arrived: boolean,
): Promise<SetItemDeliveryStateResult> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findFirst({
      where: { id: itemId, userId },
      select: { id: true, orderId: true, deliveryState: true, order: { select: { status: true } } },
    });

    if (!item) return { ok: false, error: "ITEM_NOT_FOUND" };
    if (item.order.status === OrderStatus.CANCELLED) return { ok: false, error: "ORDER_CANCELLED" };

    const liveLink = await tx.deliveryOrderItem.findFirst({
      where: { orderItemId: itemId, delivery: { status: { not: DeliveryStatus.CANCELLED } } },
      select: { deliveryId: true },
    });
    if (liveLink) return { ok: false, error: "ITEM_HAS_LIVE_DELIVERY" };

    const next = arrived ? OrderItemDeliveryState.ARRIVED_AT_STORE : OrderItemDeliveryState.NONE;
    if (item.deliveryState === next) return { ok: true, deliveryState: next };

    await tx.orderItem.update({ where: { id: itemId }, data: { deliveryState: next } });

    return { ok: true, deliveryState: next };
  });
}

export async function deleteOrder(orderId: string, userId: string): Promise<DeleteOrderResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true },
    });

    if (!order) {
      return { ok: false, error: "ORDER_NOT_FOUND" };
    }

    const liveLink = await tx.deliveryOrderItem.findFirst({
      where: {
        orderItem: { orderId },
        delivery: { status: { not: DeliveryStatus.CANCELLED } },
      },
      select: { deliveryId: true },
    });

    if (liveLink) {
      return { ok: false, error: "HAS_LIVE_DELIVERY_LINKS" };
    }

    await tx.orderPayment.deleteMany({ where: { orderId } });

    await tx.deliveryOrderItem.deleteMany({
      where: { orderItem: { orderId } },
    });

    await tx.orderHistory.deleteMany({ where: { orderId } });
    await tx.orderItem.deleteMany({ where: { orderId } });
    await tx.order.delete({ where: { id: orderId } });

    return { ok: true };
  });
}

type SaveOrderNoteResult =
  { ok: true; note: string | null; updatedAt: Date; changed: boolean } | { ok: false; error: "ORDER_NOT_FOUND" };

export async function saveOrderNote(
  orderId: string,
  userId: string,
  rawNote: string | null,
): Promise<SaveOrderNoteResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      select: { note: true, updatedAt: true },
    });

    if (!order) return { ok: false, error: "ORDER_NOT_FOUND" };

    const newTrimmed = rawNote?.trim() ?? "";
    const oldTrimmed = order.note?.trim() ?? "";

    if (newTrimmed === oldTrimmed) {
      return { ok: true, note: order.note, updatedAt: order.updatedAt, changed: false };
    }

    const persistedNote = newTrimmed.length > 0 ? newTrimmed : null;

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: { note: persistedNote },
      select: { updatedAt: true },
    });

    return { ok: true, note: persistedNote, updatedAt: updatedOrder.updatedAt, changed: true };
  });
}

export { hasLiveDeliveryLinks };
