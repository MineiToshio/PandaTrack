import { prisma } from "@/lib/prisma";
import { DeliveryStatus } from "../../../../generated/prisma/client";
import type { Prisma } from "../../../../generated/prisma/client";
import type { OrderItemRowInput } from "@/lib/orders/orderValidation";

// `@@unique([orderId, position])` rejects any transient duplicate, so a straight per-row renumber
// would fail whenever two items swap positions. We first shift every item being renumbered above
// the final 1..N range by this offset (well beyond any realistic item count), then write the final
// positions into the now-empty range. Both phases stay collision-free.
const POSITION_SHIFT_OFFSET = 1_000_000;

export type CreateOrderItemsResult =
  | { ok: true }
  | { ok: false; error: "INVALID_PRODUCT_TYPE"; productTypeKey: string };

export type DeleteOrderItemResult =
  | { ok: true }
  | { ok: false; error: "ITEM_NOT_FOUND" | "ITEM_HAS_LIVE_DELIVERY"; deliveryId?: string };

export type ReplaceOrderItemsResult =
  | { ok: true }
  | { ok: false; error: "ITEM_HAS_LIVE_DELIVERY" | "INVALID_PRODUCT_TYPE"; detail?: string };

/**
 * Normalizes a list of item inputs to consecutive positions starting at 1,
 * sorted by the client-provided position value.
 */
function normalizePositions<T extends { position: number }>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  return sorted.map((item, index) => ({ ...item, position: index + 1 }));
}

/**
 * Validates that all referenced productTypeKeys exist and are active.
 * Returns the first invalid key found, or null if all are valid.
 */
async function findInvalidProductTypeKey(tx: Prisma.TransactionClient, keys: string[]): Promise<string | null> {
  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) return null;

  const validTypes = await tx.storeProductType.findMany({
    where: { key: { in: uniqueKeys }, isActive: true },
    select: { key: true },
  });

  const validKeySet = new Set(validTypes.map((t) => t.key));
  return uniqueKeys.find((k) => !validKeySet.has(k)) ?? null;
}

/**
 * Creates order items in bulk within a transaction.
 * Normalizes positions before persistence.
 * Validates all productTypeKey references against the active catalog.
 */
export async function createOrderItems(
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
  items: OrderItemRowInput[],
): Promise<CreateOrderItemsResult> {
  if (items.length === 0) return { ok: true };

  const productTypeKeys = items.map((i) => i.productTypeKey).filter((k): k is string => k != null);

  const invalidKey = await findInvalidProductTypeKey(tx, productTypeKeys);
  if (invalidKey !== null) {
    return { ok: false, error: "INVALID_PRODUCT_TYPE", productTypeKey: invalidKey };
  }

  const normalized = normalizePositions(items);

  await tx.orderItem.createMany({
    data: normalized.map((item) => ({
      orderId,
      userId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? null,
      productTypeKey: item.productTypeKey ?? null,
      position: item.position,
    })),
  });

  return { ok: true };
}

/**
 * Replaces all items for an order atomically.
 * Items present in the current DB but absent from the new list are deleted after a
 * delivery-association guard: any removed item linked to a non-cancelled delivery blocks the operation.
 * Positions are normalized before persistence.
 */
export async function replaceOrderItems(
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
  items: Array<OrderItemRowInput & { id?: string }>,
): Promise<ReplaceOrderItemsResult> {
  const existingItems = await tx.orderItem.findMany({
    where: { orderId, userId },
    select: { id: true },
  });

  const submittedIds = new Set(items.map((i) => i.id).filter((id): id is string => id != null));
  const toDeleteIds = existingItems.filter((e) => !submittedIds.has(e.id)).map((e) => e.id);

  if (toDeleteIds.length > 0) {
    const liveLink = await tx.deliveryOrderItem.findFirst({
      where: {
        orderItemId: { in: toDeleteIds },
        delivery: { status: { not: DeliveryStatus.CANCELLED } },
      },
      select: { deliveryId: true, orderItemId: true },
    });

    if (liveLink) {
      return {
        ok: false,
        error: "ITEM_HAS_LIVE_DELIVERY",
        detail: liveLink.deliveryId,
      };
    }

    await tx.orderItem.deleteMany({ where: { id: { in: toDeleteIds } } });
  }

  const productTypeKeys = items.map((i) => i.productTypeKey).filter((k): k is string => k != null);

  const invalidKey = await findInvalidProductTypeKey(tx, productTypeKeys);
  if (invalidKey !== null) {
    return { ok: false, error: "INVALID_PRODUCT_TYPE", detail: invalidKey };
  }

  const normalized = normalizePositions(items);

  // Phase 1: shift the surviving existing items out of the final 1..N range before renumbering, so
  // reordered or swapped positions can't transiently violate the unique constraint. Newly created
  // items don't exist yet, so they never collide.
  const keptExistingIds = existingItems.map((e) => e.id).filter((id) => submittedIds.has(id));
  if (keptExistingIds.length > 0) {
    await tx.orderItem.updateMany({
      where: { orderId, userId, id: { in: keptExistingIds } },
      data: { position: { increment: POSITION_SHIFT_OFFSET } },
    });
  }

  // Phase 2: write the final positions (updates land in the vacated range; creates fill the rest).
  for (const item of normalized) {
    if (item.id && submittedIds.has(item.id)) {
      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice ?? null,
          productTypeKey: item.productTypeKey ?? null,
          position: item.position,
        },
      });
    } else {
      await tx.orderItem.create({
        data: {
          orderId,
          userId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice ?? null,
          productTypeKey: item.productTypeKey ?? null,
          position: item.position,
        },
      });
    }
  }

  return { ok: true };
}

/**
 * Deletes a single order item.
 * Blocked when the item is linked to any non-cancelled delivery.
 * The delivery-association check and the delete run in the same transaction to prevent TOCTOU races.
 */
export async function deleteOrderItem(itemId: string, orderId: string, userId: string): Promise<DeleteOrderItemResult> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findFirst({
      where: { id: itemId, orderId, userId },
      select: { id: true },
    });

    if (!item) {
      return { ok: false, error: "ITEM_NOT_FOUND" };
    }

    const liveLink = await tx.deliveryOrderItem.findFirst({
      where: {
        orderItemId: itemId,
        delivery: { status: { not: DeliveryStatus.CANCELLED } },
      },
      select: { deliveryId: true },
    });

    if (liveLink) {
      return { ok: false, error: "ITEM_HAS_LIVE_DELIVERY", deliveryId: liveLink.deliveryId };
    }

    await tx.orderItem.delete({ where: { id: itemId } });

    return { ok: true };
  });
}

/**
 * Reorders items within an order atomically.
 * Accepts the full ordered list of item IDs; normalizes positions to consecutive integers starting at 1.
 * Verifies all items belong to the given order and user before updating.
 */
export async function reorderOrderItems(
  orderId: string,
  userId: string,
  orderedItemIds: string[],
): Promise<{ ok: true } | { ok: false; error: "ITEM_NOT_FOUND" }> {
  return prisma.$transaction(async (tx) => {
    const existingItems = await tx.orderItem.findMany({
      where: { orderId, userId },
      select: { id: true },
    });

    const existingIdSet = new Set(existingItems.map((i) => i.id));
    const allValid = orderedItemIds.every((id) => existingIdSet.has(id));

    if (!allValid) {
      return { ok: false, error: "ITEM_NOT_FOUND" };
    }

    // Phase 1: vacate the final 1..N range so the per-row writes below can't transiently violate
    // the unique constraint (e.g. two items swapping positions).
    await tx.orderItem.updateMany({
      where: { orderId, userId, id: { in: orderedItemIds } },
      data: { position: { increment: POSITION_SHIFT_OFFSET } },
    });

    // Phase 2: write the final consecutive positions into the now-empty range.
    await Promise.all(
      orderedItemIds.map((id, index) =>
        tx.orderItem.update({
          where: { id },
          data: { position: index + 1 },
        }),
      ),
    );

    return { ok: true };
  });
}

export { deriveItemizedTotal, shouldShowDiscrepancyModal } from "@/lib/orders/orderItemUtils";
