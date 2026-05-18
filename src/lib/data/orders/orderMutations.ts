import { prisma } from "@/lib/prisma";
import { DeliveryStatus, OrderItemDeliveryState, OrderStatus } from "../../../../generated/prisma/client";
import { generateOrderHumanReadableId } from "@/lib/orders/orderIdentifier";
import { appendOrderHistoryEntry, OrderHistoryEventType } from "./orderHistoryMutations";
import { createOrderItems, replaceOrderItems } from "./orderItemMutations";
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
  return prisma.$transaction(async (tx) => {
    const store = await tx.store.findFirst({
      where: { id: input.storeId },
      select: { id: true },
    });

    if (!store) {
      return { ok: false, error: "STORE_NOT_FOUND" };
    }

    const now = new Date();
    const humanReadableId = await generateOrderHumanReadableId(tx, userId, now);

    const order = await tx.order.create({
      data: {
        storeId: input.storeId,
        userId,
        humanReadableId,
        orderDate: input.orderDate,
        expectedDeliveryFrom: input.expectedDeliveryFrom ?? null,
        expectedDeliveryTo: input.expectedDeliveryTo ?? null,
        currencyCode: input.currencyCode,
        exchangeRate: input.exchangeRate ?? null,
        totalCost: input.totalCost,
        note: input.note ?? null,
        status: OrderStatus.OPEN,
      },
      select: { id: true, humanReadableId: true },
    });

    if (input.items && input.items.length > 0) {
      const itemResult = await createOrderItems(tx, order.id, userId, input.items);
      if (!itemResult.ok) {
        return { ok: false, error: "INVALID_PRODUCT_TYPE" };
      }
    }

    await appendOrderHistoryEntry({
      tx,
      orderId: order.id,
      userId,
      eventType: OrderHistoryEventType.ORDER_CREATED,
    });

    return { ok: true, orderId: order.id, humanReadableId: order.humanReadableId };
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
    if (input.totalCost !== undefined) {
      const paid = await tx.orderPayment.aggregate({ where: { orderId }, _sum: { amount: true } });
      const paidAmount = paid._sum.amount ?? 0;
      if (input.totalCost < paidAmount) {
        return { ok: false, error: "TOTAL_BELOW_PAID" };
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        ...(input.storeId !== undefined ? { storeId: input.storeId } : {}),
        ...(input.orderDate !== undefined ? { orderDate: input.orderDate } : {}),
        ...(input.expectedDeliveryFrom !== undefined ? { expectedDeliveryFrom: input.expectedDeliveryFrom } : {}),
        ...(input.expectedDeliveryTo !== undefined ? { expectedDeliveryTo: input.expectedDeliveryTo } : {}),
        ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
        ...(input.exchangeRate !== undefined ? { exchangeRate: input.exchangeRate } : {}),
        ...(input.totalCost !== undefined ? { totalCost: input.totalCost } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });

    if (input.items !== undefined) {
      const replaceResult = await replaceOrderItems(tx, orderId, userId, input.items);
      if (!replaceResult.ok) {
        if (replaceResult.error === "ITEM_HAS_LIVE_DELIVERY") {
          return { ok: false, error: "ITEM_HAS_LIVE_DELIVERY" };
        }
        return { ok: false, error: "INVALID_PRODUCT_TYPE" };
      }
    }

    return { ok: true };
  });
}

export async function cancelOrder(
  orderId: string,
  userId: string,
  cancellationReason: string | null = null,
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

    // Cancellation preserves payments and history per spec — the order is archived,
    // not destroyed. The reactivate flow relies on the payment trail still being
    // available so the collector can see what they paid before they paused the order.
    // (Previously this called `tx.orderPayment.deleteMany(...)` which contradicted the
    // cancel modal copy and broke `Reactivar pedido`.)
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED, cancellationReason },
    });

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
  | { ok: true; note: string | null; updatedAt: Date; changed: boolean }
  | { ok: false; error: "ORDER_NOT_FOUND" };

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
