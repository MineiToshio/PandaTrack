import { prisma } from "@/lib/prisma";
import { DeliveryStatus, OrderStatus } from "../../../../generated/prisma/client";
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
        | "ITEM_HAS_LIVE_DELIVERY";
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

export async function cancelOrder(orderId: string, userId: string): Promise<CancelOrderResult> {
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

    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
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
      data: { status: OrderStatus.OPEN },
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
  | { ok: true; note: string | null; changed: boolean }
  | { ok: false; error: "ORDER_NOT_FOUND" };

export async function saveOrderNote(
  orderId: string,
  userId: string,
  rawNote: string | null,
): Promise<SaveOrderNoteResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      select: { note: true },
    });

    if (!order) return { ok: false, error: "ORDER_NOT_FOUND" };

    const newTrimmed = rawNote?.trim() ?? "";
    const oldTrimmed = order.note?.trim() ?? "";

    if (newTrimmed === oldTrimmed) {
      return { ok: true, note: order.note, changed: false };
    }

    const persistedNote = newTrimmed.length > 0 ? newTrimmed : null;

    await tx.order.update({
      where: { id: orderId },
      data: { note: persistedNote },
    });

    return { ok: true, note: persistedNote, changed: true };
  });
}

export { hasLiveDeliveryLinks };
