import type { Prisma } from "../../../../generated/prisma/client";
import { DeliveryStatus, OrderItemDeliveryState, OrderStatus } from "../../../../generated/prisma/client";
import { deriveOrderStatus } from "@/lib/orders/orderState";
import { getNextItemDeliveryState, mapToItemDeliveryState } from "@/lib/deliveries/deliveryState";
import { generateDeliveryHumanReadableId } from "@/lib/deliveries/deliveryIdentifier";
import { prisma } from "@/lib/prisma";
import type { DeliveryCreateInput } from "@/lib/deliveries/deliveryValidation";

export type CreateDeliveryResult =
  | { ok: true; deliveryId: string; productCount: number; orderCount: number }
  | {
      ok: false;
      error:
        | "STORE_NOT_FOUND"
        | "NO_PRODUCTS_SELECTED"
        | "PRODUCTS_FROM_DIFFERENT_STORE"
        | "PRODUCT_NOT_ELIGIBLE";
    };

/**
 * Re-derives and persists the OrderStatus for every affected order within the
 * caller's transaction. Must be called after any delivery mutation that changes
 * product-to-delivery associations (create, edit, mark delivered, reopen,
 * cancel, delete).
 *
 * Orders with status CANCELLED are never updated by delivery mutations — their
 * status is exclusively managed by the order lifecycle.
 */
export async function persistDerivedOrderStatuses(tx: Prisma.TransactionClient, orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return;

  const unique = [...new Set(orderIds)];

  for (const orderId of unique) {
    const order = await tx.order.findFirst({
      where: { id: orderId },
      select: {
        status: true,
        items: { select: { id: true, deliveryState: true } },
      },
    });

    if (!order || order.status === OrderStatus.CANCELLED) continue;

    const itemStates = order.items.map((item) => ({
      itemId: item.id,
      deliveryState: mapToItemDeliveryState(item.deliveryState),
    }));

    const derived = deriveOrderStatus(itemStates);

    if (derived !== order.status) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: derived },
      });
    }
  }
}

export async function createDelivery(userId: string, input: DeliveryCreateInput): Promise<CreateDeliveryResult> {
  const uniqueProductIds = [...new Set(input.productIds)];
  if (uniqueProductIds.length === 0) {
    return { ok: false, error: "NO_PRODUCTS_SELECTED" };
  }

  return prisma.$transaction<CreateDeliveryResult>(async (tx) => {
    const store = await tx.store.findFirst({
      where: { id: input.storeId },
      select: { id: true },
    });

    if (!store) {
      return { ok: false, error: "STORE_NOT_FOUND" };
    }

    const selectedItems = await tx.orderItem.findMany({
      where: {
        id: { in: uniqueProductIds },
        userId,
      },
      select: {
        id: true,
        orderId: true,
        deliveryState: true,
        order: {
          select: {
            storeId: true,
            userId: true,
          },
        },
      },
    });

    if (selectedItems.length !== uniqueProductIds.length) {
      return { ok: false, error: "PRODUCT_NOT_ELIGIBLE" };
    }

    const hasDifferentStore = selectedItems.some(
      (item) => item.order.storeId !== input.storeId || item.order.userId !== userId,
    );
    if (hasDifferentStore) {
      return { ok: false, error: "PRODUCTS_FROM_DIFFERENT_STORE" };
    }

    const eligibleStates: OrderItemDeliveryState[] = [
      OrderItemDeliveryState.NONE,
      OrderItemDeliveryState.ARRIVED_AT_STORE,
    ];
    const hasIneligibleProduct = selectedItems.some((item) => !eligibleStates.includes(item.deliveryState));
    if (hasIneligibleProduct) {
      return { ok: false, error: "PRODUCT_NOT_ELIGIBLE" };
    }

    const humanReadableId = await generateDeliveryHumanReadableId(tx, userId, input.deliveryDate);
    const delivery = await tx.delivery.create({
      data: {
        humanReadableId,
        storeId: input.storeId,
        userId,
        status: DeliveryStatus.IN_TRANSIT,
        deliveryDate: input.deliveryDate,
        expectedArrivalFrom: input.expectedArrivalFrom ?? null,
        expectedArrivalTo: input.expectedArrivalTo ?? null,
        cost: input.cost,
        currencyCode: input.currencyCode,
        exchangeRate: input.exchangeRate ?? null,
        carrier: input.carrier?.trim() || null,
        trackingNumber: input.trackingNumber?.trim() || null,
      },
      select: { id: true },
    });

    const stateUpdate = await tx.orderItem.updateMany({
      where: {
        id: { in: uniqueProductIds },
        userId,
        deliveryState: { in: eligibleStates },
      },
      data: { deliveryState: getNextItemDeliveryState("create") },
    });

    if (stateUpdate.count !== uniqueProductIds.length) {
      throw new Error("DELIVERY_PRODUCT_CONCURRENT_STATE_CHANGE");
    }

    await tx.deliveryOrderItem.createMany({
      data: uniqueProductIds.map((orderItemId) => ({
        deliveryId: delivery.id,
        orderItemId,
      })),
    });

    const orderIds = selectedItems.map((item) => item.orderId);
    await persistDerivedOrderStatuses(tx, orderIds);

    return {
      ok: true,
      deliveryId: delivery.id,
      productCount: uniqueProductIds.length,
      orderCount: new Set(orderIds).size,
    };
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "DELIVERY_PRODUCT_CONCURRENT_STATE_CHANGE") {
      return { ok: false, error: "PRODUCT_NOT_ELIGIBLE" };
    }
    throw error;
  });
}

// ---------------------------------------------------------------------------
// Stubs — filled in by WO-02 through WO-05
// ---------------------------------------------------------------------------

// editDelivery — WO-05
// markDeliveryDelivered — WO-04
// reopenDelivery — WO-04
// cancelDelivery — WO-04
// deleteDelivery — WO-04
// updateDeliveryNote — WO-04
