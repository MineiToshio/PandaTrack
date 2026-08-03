import type { Prisma } from "../../../../generated/prisma/client";
import { DeliveryStatus, OrderItemDeliveryState, OrderStatus } from "../../../../generated/prisma/client";
import { deriveOrderStatus } from "@/lib/orders/orderState";
import { getNextItemDeliveryState, mapToItemDeliveryState } from "@/lib/deliveries/deliveryState";
import { generateDeliveryHumanReadableId } from "@/lib/deliveries/deliveryIdentifier";
import { resolveExchangeRateBaseCode } from "@/lib/fx/reconciliation";
import { prisma } from "@/lib/prisma";
import type { DeliveryCreateInput, DeliveryEditInput } from "@/lib/deliveries/deliveryValidation";

export type CreateDeliveryResult =
  | { ok: true; deliveryId: string; productCount: number; orderCount: number }
  | {
      ok: false;
      error: "STORE_NOT_FOUND" | "NO_PRODUCTS_SELECTED" | "PRODUCTS_FROM_DIFFERENT_STORE" | "PRODUCT_NOT_ELIGIBLE";
      /** OrderItem ids that were no longer eligible — drives the client retry copy. */
      ineligibleProductIds?: string[];
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

  // Single batched read instead of one findFirst per order — avoids an N+1 inside the transaction.
  const orders = await tx.order.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      status: true,
      items: { select: { id: true, deliveryState: true } },
    },
  });

  // Group the orders whose derived status actually changed by their target status, then write each
  // distinct status with a single updateMany. This keeps the write count bounded by the number of
  // OrderStatus values rather than the number of affected orders.
  const idsByTargetStatus = new Map<OrderStatus, string[]>();
  for (const order of orders) {
    if (order.status === OrderStatus.CANCELLED) continue;

    const derived = deriveOrderStatus(
      order.items.map((item) => ({ itemId: item.id, deliveryState: mapToItemDeliveryState(item.deliveryState) })),
    );

    if (derived === order.status) continue;

    const bucket = idsByTargetStatus.get(derived);
    if (bucket) bucket.push(order.id);
    else idsByTargetStatus.set(derived, [order.id]);
  }

  for (const [status, ids] of idsByTargetStatus) {
    await tx.order.updateMany({ where: { id: { in: ids } }, data: { status } });
  }
}

export async function createDelivery(userId: string, input: DeliveryCreateInput): Promise<CreateDeliveryResult> {
  const uniqueProductIds = [...new Set(input.productIds)];
  if (uniqueProductIds.length === 0) {
    return { ok: false, error: "NO_PRODUCTS_SELECTED" };
  }

  return prisma
    .$transaction<CreateDeliveryResult>(async (tx) => {
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
        const foundIds = new Set(selectedItems.map((item) => item.id));
        return {
          ok: false,
          error: "PRODUCT_NOT_ELIGIBLE",
          ineligibleProductIds: uniqueProductIds.filter((id) => !foundIds.has(id)),
        };
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
      const ineligibleProductIds = selectedItems
        .filter((item) => !eligibleStates.includes(item.deliveryState))
        .map((item) => item.id);
      if (ineligibleProductIds.length > 0) {
        return { ok: false, error: "PRODUCT_NOT_ELIGIBLE", ineligibleProductIds };
      }

      const humanReadableId = await generateDeliveryHumanReadableId(tx, userId, input.deliveryDate);
      const user = await tx.user.findUnique({ where: { id: userId }, select: { baseCurrencyCode: true } });
      const exchangeRate = input.exchangeRate ?? null;
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
          exchangeRate,
          exchangeRateBaseCode: resolveExchangeRateBaseCode(exchangeRate, user?.baseCurrencyCode ?? null),
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
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === "DELIVERY_PRODUCT_CONCURRENT_STATE_CHANGE") {
        return { ok: false, error: "PRODUCT_NOT_ELIGIBLE" };
      }
      throw error;
    });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export type DeliveryLifecycleError =
  "DELIVERY_NOT_FOUND" | "INVALID_STATUS" | "PRODUCTS_IN_OTHER_DELIVERY" | "RECEIVED_DATE_REQUIRED";

export type DeliveryLifecycleResult = { ok: true; productCount: number } | { ok: false; error: DeliveryLifecycleError };

type DeliveryWithItems = {
  id: string;
  status: DeliveryStatus;
  orderItems: Array<{ orderItem: { id: string; orderId: string } }>;
};

async function findDeliveryWithItems(
  tx: Prisma.TransactionClient,
  deliveryId: string,
  userId: string,
): Promise<DeliveryWithItems | null> {
  return tx.delivery.findFirst({
    where: { id: deliveryId, userId },
    select: {
      id: true,
      status: true,
      orderItems: { select: { orderItem: { select: { id: true, orderId: true } } } },
    },
  });
}

function collectItemAndOrderIds(delivery: DeliveryWithItems): { itemIds: string[]; orderIds: string[] } {
  const itemIds = delivery.orderItems.map((link) => link.orderItem.id);
  const orderIds = delivery.orderItems.map((link) => link.orderItem.orderId);
  return { itemIds, orderIds };
}

/**
 * Marks an IN_TRANSIT delivery as DELIVERED: persists the required received date
 * and moves every linked product to DELIVERED, re-deriving the source order
 * statuses in the same transaction.
 */
export async function markDeliveryDelivered(
  deliveryId: string,
  userId: string,
  receivedDate: Date,
): Promise<DeliveryLifecycleResult> {
  return prisma.$transaction(async (tx) => {
    const delivery = await findDeliveryWithItems(tx, deliveryId, userId);
    if (!delivery) return { ok: false, error: "DELIVERY_NOT_FOUND" };
    if (delivery.status !== DeliveryStatus.IN_TRANSIT) return { ok: false, error: "INVALID_STATUS" };

    const { itemIds, orderIds } = collectItemAndOrderIds(delivery);

    await tx.delivery.update({
      where: { id: deliveryId },
      data: { status: DeliveryStatus.DELIVERED, receivedDate },
    });

    if (itemIds.length > 0) {
      await tx.orderItem.updateMany({
        where: { id: { in: itemIds }, userId },
        data: { deliveryState: getNextItemDeliveryState("mark-delivered") },
      });
    }

    await persistDerivedOrderStatuses(tx, orderIds);

    return { ok: true, productCount: itemIds.length };
  });
}

/**
 * Reopens a DELIVERED or CANCELLED delivery back to IN_TRANSIT.
 * Clears the received date and moves linked products back to IN_TRANSIT.
 * Reopening a cancelled delivery is rejected when any of its products joined
 * another live delivery in the meantime (one delivery per product).
 */
export async function reopenDelivery(deliveryId: string, userId: string): Promise<DeliveryLifecycleResult> {
  return prisma.$transaction(async (tx) => {
    const delivery = await findDeliveryWithItems(tx, deliveryId, userId);
    if (!delivery) return { ok: false, error: "DELIVERY_NOT_FOUND" };
    if (delivery.status === DeliveryStatus.IN_TRANSIT) return { ok: false, error: "INVALID_STATUS" };

    const { itemIds, orderIds } = collectItemAndOrderIds(delivery);

    if (delivery.status === DeliveryStatus.CANCELLED && itemIds.length > 0) {
      const conflicting = await tx.deliveryOrderItem.count({
        where: {
          orderItemId: { in: itemIds },
          deliveryId: { not: deliveryId },
          delivery: { status: { not: DeliveryStatus.CANCELLED } },
        },
      });
      if (conflicting > 0) return { ok: false, error: "PRODUCTS_IN_OTHER_DELIVERY" };
    }

    await tx.delivery.update({
      where: { id: deliveryId },
      data: { status: DeliveryStatus.IN_TRANSIT, receivedDate: null },
    });

    if (itemIds.length > 0) {
      await tx.orderItem.updateMany({
        where: { id: { in: itemIds }, userId },
        data: { deliveryState: getNextItemDeliveryState("reopen") },
      });
    }

    await persistDerivedOrderStatuses(tx, orderIds);

    return { ok: true, productCount: itemIds.length };
  });
}

/**
 * Cancels an IN_TRANSIT delivery: the record is kept, products return to
 * ARRIVED_AT_STORE and become eligible again.
 */
export async function cancelDelivery(deliveryId: string, userId: string): Promise<DeliveryLifecycleResult> {
  return prisma.$transaction(async (tx) => {
    const delivery = await findDeliveryWithItems(tx, deliveryId, userId);
    if (!delivery) return { ok: false, error: "DELIVERY_NOT_FOUND" };
    if (delivery.status !== DeliveryStatus.IN_TRANSIT) return { ok: false, error: "INVALID_STATUS" };

    const { itemIds, orderIds } = collectItemAndOrderIds(delivery);

    await tx.delivery.update({
      where: { id: deliveryId },
      data: { status: DeliveryStatus.CANCELLED },
    });

    if (itemIds.length > 0) {
      await tx.orderItem.updateMany({
        where: { id: { in: itemIds }, userId },
        data: { deliveryState: getNextItemDeliveryState("cancel") },
      });
    }

    await persistDerivedOrderStatuses(tx, orderIds);

    return { ok: true, productCount: itemIds.length };
  });
}

/**
 * Physically deletes a delivery. Only allowed while IN_TRANSIT or CANCELLED
 * (a DELIVERED delivery must be reopened first). Products still in
 * transit return to ARRIVED_AT_STORE; source orders are re-derived but never
 * deleted.
 */
export async function deleteDelivery(deliveryId: string, userId: string): Promise<DeliveryLifecycleResult> {
  return prisma.$transaction(async (tx) => {
    const delivery = await findDeliveryWithItems(tx, deliveryId, userId);
    if (!delivery) return { ok: false, error: "DELIVERY_NOT_FOUND" };
    if (delivery.status === DeliveryStatus.DELIVERED) return { ok: false, error: "INVALID_STATUS" };

    const { itemIds, orderIds } = collectItemAndOrderIds(delivery);

    if (delivery.status === DeliveryStatus.IN_TRANSIT && itemIds.length > 0) {
      await tx.orderItem.updateMany({
        where: { id: { in: itemIds }, userId },
        data: { deliveryState: getNextItemDeliveryState("delete") },
      });
    }

    // Cascade removes the delivery_order_item links.
    await tx.delivery.delete({ where: { id: deliveryId } });

    await persistDerivedOrderStatuses(tx, orderIds);

    return { ok: true, productCount: itemIds.length };
  });
}

export type UpdateDeliveryNoteResult =
  { ok: true; note: string | null; updatedAt: Date; changed: boolean } | { ok: false; error: "DELIVERY_NOT_FOUND" };

/** Saves the private note; an empty/whitespace note clears the field. */
export async function updateDeliveryNote(
  deliveryId: string,
  userId: string,
  rawNote: string | null,
): Promise<UpdateDeliveryNoteResult> {
  return prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.findFirst({
      where: { id: deliveryId, userId },
      select: { note: true, updatedAt: true },
    });

    if (!delivery) return { ok: false, error: "DELIVERY_NOT_FOUND" };

    const newTrimmed = rawNote?.trim() ?? "";
    const oldTrimmed = delivery.note?.trim() ?? "";

    if (newTrimmed === oldTrimmed) {
      return { ok: true, note: delivery.note, updatedAt: delivery.updatedAt, changed: false };
    }

    const persistedNote = newTrimmed.length > 0 ? newTrimmed : null;

    const updated = await tx.delivery.update({
      where: { id: deliveryId },
      data: { note: persistedNote },
      select: { updatedAt: true },
    });

    return { ok: true, note: persistedNote, updatedAt: updated.updatedAt, changed: true };
  });
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

export type EditDeliveryResult =
  | { ok: true; productCount: number; addedCount: number; removedCount: number }
  | {
      ok: false;
      error:
        | "DELIVERY_NOT_FOUND"
        | "INVALID_STATUS"
        | "NO_PRODUCTS_SELECTED"
        | "PRODUCTS_FROM_DIFFERENT_STORE"
        | "PRODUCT_NOT_ELIGIBLE";
    };

/**
 * Edits an IN_TRANSIT delivery: metadata (dates, cost, currency, FX) and product
 * membership. Added products move to IN_TRANSIT; removed products return to
 * ARRIVED_AT_STORE. Status and eligibility are revalidated inside the
 * transaction so stale edits fail atomically. The store never changes.
 */
export async function editDelivery(
  deliveryId: string,
  userId: string,
  input: Omit<DeliveryEditInput, "deliveryId"> & { productIds: string[] },
): Promise<EditDeliveryResult> {
  const uniqueProductIds = [...new Set(input.productIds)];
  if (uniqueProductIds.length === 0) {
    return { ok: false, error: "NO_PRODUCTS_SELECTED" };
  }

  return prisma
    .$transaction<EditDeliveryResult>(async (tx) => {
      const delivery = await tx.delivery.findFirst({
        where: { id: deliveryId, userId },
        select: {
          id: true,
          status: true,
          storeId: true,
          currencyCode: true,
          orderItems: { select: { orderItem: { select: { id: true, orderId: true } } } },
        },
      });

      if (!delivery) return { ok: false, error: "DELIVERY_NOT_FOUND" };
      if (delivery.status !== DeliveryStatus.IN_TRANSIT) return { ok: false, error: "INVALID_STATUS" };

      const currentIds = delivery.orderItems.map((link) => link.orderItem.id);
      const currentIdSet = new Set(currentIds);
      const selectedIdSet = new Set(uniqueProductIds);
      const addedIds = uniqueProductIds.filter((id) => !currentIdSet.has(id));
      const removedIds = currentIds.filter((id) => !selectedIdSet.has(id));

      const selectedItems = await tx.orderItem.findMany({
        where: { id: { in: uniqueProductIds }, userId },
        select: {
          id: true,
          orderId: true,
          deliveryState: true,
          order: { select: { storeId: true, userId: true } },
        },
      });

      if (selectedItems.length !== uniqueProductIds.length) {
        return { ok: false, error: "PRODUCT_NOT_ELIGIBLE" };
      }

      const hasDifferentStore = selectedItems.some(
        (item) => item.order.storeId !== delivery.storeId || item.order.userId !== userId,
      );
      if (hasDifferentStore) {
        return { ok: false, error: "PRODUCTS_FROM_DIFFERENT_STORE" };
      }

      // Added products must still be eligible (kept products are IN_TRANSIT in THIS delivery).
      const eligibleStates: OrderItemDeliveryState[] = [
        OrderItemDeliveryState.NONE,
        OrderItemDeliveryState.ARRIVED_AT_STORE,
      ];
      const addedIdSet = new Set(addedIds);
      const hasIneligibleAdded = selectedItems.some(
        (item) => addedIdSet.has(item.id) && !eligibleStates.includes(item.deliveryState),
      );
      if (hasIneligibleAdded) {
        return { ok: false, error: "PRODUCT_NOT_ELIGIBLE" };
      }

      if (addedIds.length > 0) {
        const stateUpdate = await tx.orderItem.updateMany({
          where: { id: { in: addedIds }, userId, deliveryState: { in: eligibleStates } },
          data: { deliveryState: getNextItemDeliveryState("edit-add") },
        });
        if (stateUpdate.count !== addedIds.length) {
          throw new Error("DELIVERY_PRODUCT_CONCURRENT_STATE_CHANGE");
        }
        await tx.deliveryOrderItem.createMany({
          data: addedIds.map((orderItemId) => ({ deliveryId, orderItemId })),
        });
      }

      if (removedIds.length > 0) {
        await tx.orderItem.updateMany({
          where: { id: { in: removedIds }, userId },
          data: { deliveryState: getNextItemDeliveryState("edit-remove") },
        });
        await tx.deliveryOrderItem.deleteMany({
          where: { deliveryId, orderItemId: { in: removedIds } },
        });
      }

      // The edit form always resends the rate (it is never a partial patch), so the write below is
      // the delivery's final rate and gets stamped with the base it was entered against. Editing
      // is the per-delivery reconciliation path: a saved rate leaves the FX-pending set because
      // pending-ness is derived from that pair, not from a stored flag (ADR 0024).
      const exchangeRate = input.exchangeRate ?? null;
      const user = await tx.user.findUnique({ where: { id: userId }, select: { baseCurrencyCode: true } });

      await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          ...(input.deliveryDate !== undefined ? { deliveryDate: input.deliveryDate } : {}),
          expectedArrivalFrom: input.expectedArrivalFrom ?? null,
          expectedArrivalTo: input.expectedArrivalTo ?? null,
          ...(input.cost !== undefined ? { cost: input.cost } : {}),
          ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
          exchangeRate,
          exchangeRateBaseCode: resolveExchangeRateBaseCode(exchangeRate, user?.baseCurrencyCode ?? null),
        },
      });

      const affectedOrderIds = [
        ...delivery.orderItems.map((link) => link.orderItem.orderId),
        ...selectedItems.map((item) => item.orderId),
      ];
      await persistDerivedOrderStatuses(tx, affectedOrderIds);

      return {
        ok: true,
        productCount: uniqueProductIds.length,
        addedCount: addedIds.length,
        removedCount: removedIds.length,
      };
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === "DELIVERY_PRODUCT_CONCURRENT_STATE_CHANGE") {
        return { ok: false, error: "PRODUCT_NOT_ELIGIBLE" } as const;
      }
      throw error;
    });
}
