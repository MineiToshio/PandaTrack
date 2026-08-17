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
  { ok: true } | { ok: false; error: "INVALID_PRODUCT_TYPE"; productTypeKey: string };

export type DeleteOrderItemResult =
  | { ok: true }
  | {
      ok: false;
      error: "ITEM_NOT_FOUND" | "ITEM_HAS_LIVE_DELIVERY" | "ITEM_HAS_ALLOCATION" | "ITEM_HAS_PAID_MARK";
      deliveryId?: string;
    };

export type ReplaceOrderItemsResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "ITEM_HAS_LIVE_DELIVERY"
        | "INVALID_PRODUCT_TYPE"
        | "ITEM_HAS_ALLOCATION"
        | "ITEM_PRICE_BELOW_ALLOCATED"
        | "ITEM_HAS_PAID_MARK";
      detail?: string;
    };

export type SetOrderItemsPaidDeclaredResult = { ok: true; count: number } | { ok: false; error: "ITEM_NOT_FOUND" };

/**
 * Normalizes a list of item inputs to consecutive positions starting at 1,
 * sorted by the client-provided position value.
 *
 * Exported so the invariant that carries money can be tested as the composition it is: the review
 * screen declares a breakdown against a product's position in the flattened draft, and that only
 * reaches the right product if the position it emitted is the position this function persists.
 */
export function normalizePositions<T extends { position: number }>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  return sorted.map((item, index) => ({ ...item, position: index + 1 }));
}

/**
 * Validates that all referenced productTypeKeys exist and are active.
 * Returns the first invalid key found, or null if all are valid.
 *
 * Exported so a caller that writes before it would reach `createOrderItems` (see `createOrder`) can
 * run this check itself, up front, while the transaction still has nothing to lose.
 */
export async function findInvalidProductTypeKey(tx: Prisma.TransactionClient, keys: string[]): Promise<string | null> {
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
 * Money already declared against each of the given items, keyed by item id. Items with nothing
 * declared against them are absent from the map rather than present with a zero.
 */
async function sumAllocationsByItemId(
  tx: Prisma.TransactionClient,
  userId: string,
  itemIds: string[],
): Promise<Map<string, number>> {
  if (itemIds.length === 0) return new Map();

  const groups = await tx.paymentAllocation.groupBy({
    by: ["orderItemId"],
    where: { orderItemId: { in: itemIds }, userId },
    _sum: { amountMinor: true },
  });

  const allocatedByItemId = new Map<string, number>();
  for (const group of groups) {
    if (group.orderItemId) allocatedByItemId.set(group.orderItemId, group._sum.amountMinor ?? 0);
  }
  return allocatedByItemId;
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
  // Both refusals below must be decided before the first write. Returning normally from a
  // `$transaction` callback COMMITS it — only a thrown error rolls it back — so an `{ ok: false }`
  // return placed after a write persists that write while the caller is told the edit failed. This
  // validation used to sit after the delete, which silently dropped the removed items on refusal.
  const productTypeKeys = items.map((i) => i.productTypeKey).filter((k): k is string => k != null);

  const invalidKey = await findInvalidProductTypeKey(tx, productTypeKeys);
  if (invalidKey !== null) {
    return { ok: false, error: "INVALID_PRODUCT_TYPE", detail: invalidKey };
  }

  const existingItems = await tx.orderItem.findMany({
    where: { orderId, userId },
    select: { id: true, paidDeclaredAt: true },
  });

  const submittedIds = new Set(items.map((i) => i.id).filter((id): id is string => id != null));
  const toDeleteIds = existingItems.filter((e) => !submittedIds.has(e.id)).map((e) => e.id);

  // A paid mark is an assertion only the collector could make, it writes no history entry, and the
  // row's disappearance would take it with it. So removing a marked item is refused the same way
  // removing a funded one is, and for the same reason: the declaration has to be dropped
  // deliberately, not as a side effect of editing the list.
  const blockedMarkedDeletion = existingItems.find(
    (item) => !submittedIds.has(item.id) && item.paidDeclaredAt !== null,
  );
  if (blockedMarkedDeletion) {
    return { ok: false, error: "ITEM_HAS_PAID_MARK", detail: blockedMarkedDeletion.id };
  }

  // Money declared against a specific item pins that item down: it cannot be removed, and its own
  // price cannot drop below what has already been declared against it, or the declaration would
  // claim more than the item is worth. Both checks run here, before the first write, so a refusal
  // never leaves a half-applied replacement behind.
  const allocatedByItemId = await sumAllocationsByItemId(
    tx,
    userId,
    existingItems.map((item) => item.id),
  );

  const blockedDeletion = toDeleteIds.find((itemId) => (allocatedByItemId.get(itemId) ?? 0) > 0);
  if (blockedDeletion) {
    return { ok: false, error: "ITEM_HAS_ALLOCATION", detail: blockedDeletion };
  }

  const underfundedItem = items.find((item) => {
    if (!item.id || !submittedIds.has(item.id)) return false;
    const allocated = allocatedByItemId.get(item.id) ?? 0;
    if (allocated === 0) return false;
    // A submitted item with no unit price has no base to compare against, so nothing to violate.
    if (item.unitPrice == null) return false;
    return item.unitPrice * item.quantity < allocated;
  });
  if (underfundedItem?.id) {
    return { ok: false, error: "ITEM_PRICE_BELOW_ALLOCATED", detail: underfundedItem.id };
  }

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
      select: { id: true, paidDeclaredAt: true },
    });

    if (!item) {
      return { ok: false, error: "ITEM_NOT_FOUND" };
    }

    // Same contract as `replaceOrderItems`: a paid mark is dropped deliberately, never as a side
    // effect of deleting the row that carries it.
    if (item.paidDeclaredAt !== null) {
      return { ok: false, error: "ITEM_HAS_PAID_MARK" };
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

    // Deleting the item would cascade away a payment declaration that names it, silently reducing
    // what the collector recorded as paid. The declaration has to be dropped first, deliberately.
    const allocation = await tx.paymentAllocation.findFirst({
      where: { orderItemId: itemId, userId },
      select: { id: true },
    });

    if (allocation) {
      return { ok: false, error: "ITEM_HAS_ALLOCATION" };
    }

    await tx.orderItem.delete({ where: { id: itemId } });

    return { ok: true };
  });
}

/**
 * Reorders items within an order atomically.
 * Accepts the full ordered list of item IDs; normalizes positions to consecutive integers starting at 1.
 * Verifies all items belong to the given order and user, and that the list covers every item in the
 * order exactly once, before updating.
 */
export async function reorderOrderItems(
  orderId: string,
  userId: string,
  orderedItemIds: string[],
): Promise<{ ok: true } | { ok: false; error: "ITEM_NOT_FOUND" | "INVALID_ITEM_SET" }> {
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

    // Guard against a partial (or duplicated) id list: every existing item for the order must appear
    // exactly once in `orderedItemIds`. Without this check, a shorter list would leave the omitted
    // items at their stale positions, and Phase 2 below would then collide with them when writing the
    // final 1..N range — surfacing as an unmapped @@unique([orderId, position]) violation (P2002)
    // instead of a clear, typed error.
    const orderedIdSet = new Set(orderedItemIds);
    const coversAllItems = orderedIdSet.size === existingIdSet.size && orderedItemIds.length === orderedIdSet.size;

    if (!coversAllItems) {
      return { ok: false, error: "INVALID_ITEM_SET" };
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

/**
 * Sets or clears the collector's "this product is paid" mark on a batch of items.
 *
 * Takes the caller's transaction client rather than opening its own, because both callers need it
 * to commit with something else: the public wrapper below, and `createStorePayment`, which writes
 * the marks a payment declares inside the payment's own transaction (Prisma does not nest).
 *
 * The ownership check runs BEFORE the write, and that ordering is the contract, not a style choice
 * (ADR 0022). A bare `updateMany({ where: { id: { in: ids }, userId } })` carrying one foreign id
 * writes the other rows and reports `count` short: a silently applied subset, which is exactly what
 * a batch declaration must never be. Refusing here costs one `count`, and since the refusal is
 * decided before this function writes anything, a plain `return` is safe.
 *
 * It moves no money. `Order.allocatedAmountMinor`, store debt, dashboard figures and payment
 * reminders are all derived from allocations and never read this column.
 */
export async function setOrderItemsPaidDeclaredWithin(
  tx: Prisma.TransactionClient,
  itemIds: string[],
  userId: string,
  declared: boolean,
): Promise<SetOrderItemsPaidDeclaredResult> {
  const uniqueIds = [...new Set(itemIds)];
  if (uniqueIds.length === 0) return { ok: true, count: 0 };

  const owned = await tx.orderItem.count({ where: { id: { in: uniqueIds }, userId } });
  if (owned !== uniqueIds.length) {
    return { ok: false, error: "ITEM_NOT_FOUND" };
  }

  const updated = await tx.orderItem.updateMany({
    where: { id: { in: uniqueIds }, userId },
    data: { paidDeclaredAt: declared ? new Date() : null },
  });

  return { ok: true, count: updated.count };
}

/**
 * The single-product entry point behind the "Marcar pagado" control, in its own transaction so the
 * ownership check and the write cannot be split by a concurrent delete.
 */
export async function setOrderItemPaidDeclared(
  itemId: string,
  userId: string,
  declared: boolean,
): Promise<SetOrderItemsPaidDeclaredResult> {
  return prisma.$transaction((tx) => setOrderItemsPaidDeclaredWithin(tx, [itemId], userId, declared));
}

export { deriveItemizedTotal, shouldShowDiscrepancyModal } from "@/lib/orders/orderItemUtils";
