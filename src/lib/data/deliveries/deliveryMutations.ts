import type { Prisma } from "../../../../generated/prisma/client";
import { DeliveryStatus, OrderItemDeliveryState, OrderStatus } from "../../../../generated/prisma/client";
import { deriveOrderStatus } from "@/lib/orders/orderState";
import { getNextItemDeliveryState, mapToItemDeliveryState } from "@/lib/deliveries/deliveryState";
import { generateDeliveryHumanReadableId } from "@/lib/deliveries/deliveryIdentifier";
import { resolveFxPair } from "@/lib/fx/reconciliation";
import { prisma } from "@/lib/prisma";
import type { DeliveryCreateInput, DeliveryEditInput } from "@/lib/deliveries/deliveryValidation";
import { recalculateOrderAllocationCache } from "@/lib/data/orders/orderPaymentAllocations";
import {
  combineCredits,
  creditDeliveryReceived,
  creditOrdersCompleted,
  settleProgression,
  type CreditOutcome,
  type ProgressionDelta,
} from "@/lib/data/progression/accrual";
import {
  STORE_CREDIT_ELIGIBILITY_SELECT,
  type StoreEligibilityRow,
} from "@/lib/data/progression/storeCreditEligibility";

/**
 * One order this delivery transaction just closed to COMPLETED, snapshotted for the money
 * transaction that follows it (`FR-08-46`, `ADR 0032`). No money is read or written to produce
 * this: `totalCost`, `allocatedAmountMinor`, and the adjustment-line total are read as they stand
 * at this same transaction's commit, purely so the caller can sequence its own, separate money
 * transaction without a second round trip to find out what just closed. The money transaction
 * re-reads all of this fresh before writing anything (WO-08 Technical Notes): this snapshot never
 * gates a write on its own.
 */
export type ClosedOrderSnapshot = {
  orderId: string;
  storeId: string;
  currencyCode: string;
  totalCost: number;
  allocatedAmountMinor: number;
  adjustmentLineTotalMinor: number;
  orderDate: Date;
  humanReadableId: string;
};

export type CreateDeliveryResult =
  | {
      ok: true;
      deliveryId: string;
      productCount: number;
      orderCount: number;
      closedOrders: ClosedOrderSnapshot[];
      progression: ProgressionDelta | null;
    }
  | {
      ok: false;
      error:
        | "STORE_NOT_FOUND"
        | "NO_PRODUCTS_SELECTED"
        | "PRODUCTS_FROM_DIFFERENT_STORE"
        | "PRODUCT_NOT_ELIGIBLE"
        | "ORDER_CANCELLED";
      /** OrderItem ids that were no longer eligible — drives the client retry copy. */
      ineligibleProductIds?: string[];
    };

/**
 * The delivery transaction's own shape. It carries the raw credit count, never a settled delta: the
 * progress cache is re-derived after the transaction commits, so an arrival is never held up by a
 * secondary write and the money transaction that follows never shares a per-user row with it.
 */
type CreateDeliveryTxOutcome =
  | (Omit<Extract<CreateDeliveryResult, { ok: true }>, "progression"> & { credited: CreditOutcome })
  | Extract<CreateDeliveryResult, { ok: false }>;

/**
 * Re-derives and persists the OrderStatus for every affected order within the
 * caller's transaction. Must be called after any delivery mutation that changes
 * product-to-delivery associations (create, edit, mark delivered, reopen,
 * cancel, delete).
 *
 * Orders with status CANCELLED are never updated by delivery mutations — their
 * status is exclusively managed by the order lifecycle.
 *
 * Returns the ids this call itself just derived INTO `COMPLETED` (`FR-08-46`, `WO-08`): an order
 * that was already `COMPLETED` before this call does not count, since nothing closed just now.
 * `createDelivery` and `markDeliveryDelivered` are this trigger set's only two producers; every
 * other caller here (`reopenDelivery`, `cancelDelivery`, `deleteDelivery`, `editDelivery`) discards
 * it, since none of them can ever close an order (see `deliveryMutations.ts`'s own module notes).
 */
export async function persistDerivedOrderStatuses(
  tx: Prisma.TransactionClient,
  userId: string,
  orderIds: string[],
): Promise<{ closedOrderIds: string[]; credited: CreditOutcome }> {
  if (orderIds.length === 0) return { closedOrderIds: [], credited: 0 };

  const unique = [...new Set(orderIds)];

  // Single batched read instead of one findFirst per order — avoids an N+1 inside the transaction.
  // Scoped by `userId`: every caller reaches this through products it already proved belong to the
  // collector, so the scope changes no behaviour, and it removes the one place in the delivery
  // lifecycle where an order was re-derived by id alone.
  const orders = await tx.order.findMany({
    where: { id: { in: unique }, userId },
    select: {
      id: true,
      status: true,
      items: { select: { id: true, deliveryState: true } },
      store: { select: STORE_CREDIT_ELIGIBILITY_SELECT },
    },
  });

  // Group the orders whose derived status actually changed by their target status, then write each
  // distinct status with a single updateMany. This keeps the write count bounded by the number of
  // OrderStatus values rather than the number of affected orders.
  const idsByTargetStatus = new Map<OrderStatus, string[]>();
  const storeByOrderId = new Map<string, StoreEligibilityRow | null>();
  for (const order of orders) {
    storeByOrderId.set(order.id, order.store);
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

  const closedOrderIds = idsByTargetStatus.get(OrderStatus.COMPLETED) ?? [];

  // `order-completed` is credited exactly where the status it depends on is written, rather than in
  // each of the delivery mutations that can trigger it. `COMPLETED` is never typed by anybody: it
  // falls out of every product having arrived, and the two would drift apart the first time a new
  // caller re-derived a status without knowing it also had to credit.
  const credited = await creditOrdersCompleted(tx, {
    userId,
    orders: closedOrderIds.map((orderId) => ({ orderId, store: storeByOrderId.get(orderId) ?? null })),
  });

  return { closedOrderIds, credited };
}

/**
 * Snapshots the orders a delivery transaction just closed to `COMPLETED`, for the money
 * transaction that runs after it (`FR-08-46`, `ADR 0032`). One `findMany` plus one
 * `storeAccountAdjustmentLine` groupBy, both inside the caller's own transaction: no money
 * (`StorePayment`, `PaymentAllocation`) is read or written here, only the order-level totals
 * `openBalanceMinor` is built from (`ADR 0034`). Sorted `orderDate ASC, humanReadableId ASC`,
 * the deterministic batch order the money transaction must settle in (spec §1.7, `WO-08`).
 */
async function buildClosedOrderSnapshots(
  tx: Prisma.TransactionClient,
  closedOrderIds: string[],
): Promise<ClosedOrderSnapshot[]> {
  if (closedOrderIds.length === 0) return [];

  const [orders, adjustmentTotals] = await Promise.all([
    tx.order.findMany({
      where: { id: { in: closedOrderIds } },
      select: {
        id: true,
        storeId: true,
        currencyCode: true,
        totalCost: true,
        allocatedAmountMinor: true,
        orderDate: true,
        humanReadableId: true,
      },
    }),
    tx.storeAccountAdjustmentLine.groupBy({
      by: ["orderId"],
      where: { orderId: { in: closedOrderIds } },
      _sum: { amountMinor: true },
    }),
  ]);

  const adjustmentTotalByOrderId = new Map(adjustmentTotals.map((row) => [row.orderId, row._sum.amountMinor ?? 0]));
  const closedIdSet = new Set(closedOrderIds);

  return orders
    .filter((order) => closedIdSet.has(order.id))
    .map((order) => ({
      orderId: order.id,
      storeId: order.storeId,
      currencyCode: order.currencyCode,
      totalCost: order.totalCost,
      allocatedAmountMinor: order.allocatedAmountMinor,
      adjustmentLineTotalMinor: adjustmentTotalByOrderId.get(order.id) ?? 0,
      orderDate: order.orderDate,
      humanReadableId: order.humanReadableId,
    }))
    .sort(
      (a, b) => a.orderDate.getTime() - b.orderDate.getTime() || a.humanReadableId.localeCompare(b.humanReadableId),
    );
}

/**
 * Creates a delivery. Two entry points share this one transaction body:
 *
 * - the create wizard omits `receivedDate`, so the delivery is born IN_TRANSIT and its products
 *   move to IN_TRANSIT, waiting for a later `markDeliveryDelivered`;
 * - the quick-arrival flow passes `receivedDate`, so the delivery is born DELIVERED and its
 *   products jump straight to DELIVERED, collapsing both steps into one write.
 *
 * They are deliberately not two functions: the store check, the cancelled-order refusal, the
 * eligibility compare-and-swap, the identifier, the FX base stamp and the order-status
 * re-derivation must never drift apart.
 */
export async function createDelivery(userId: string, input: DeliveryCreateInput): Promise<CreateDeliveryResult> {
  const uniqueProductIds = [...new Set(input.productIds)];
  if (uniqueProductIds.length === 0) {
    return { ok: false, error: "NO_PRODUCTS_SELECTED" };
  }

  const outcome = await prisma
    .$transaction<CreateDeliveryTxOutcome>(async (tx) => {
      // Widened past `id` for the progression credit gate, read inside the delivery transaction so
      // the answer is the store's state at the moment of the arrival, not at page load.
      const store = await tx.store.findFirst({
        where: { id: input.storeId },
        select: { id: true, ...STORE_CREDIT_ELIGIBILITY_SELECT },
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
              status: true,
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

      // A cancelled order is outside the delivery lifecycle: `persistDerivedOrderStatuses` refuses
      // to re-derive it, so a delivery built from its products would move the item states and then
      // leave the order frozen at CANCELLED, with no surface able to explain the mismatch. The
      // check lives here rather than in one caller because a store-scoped selection spans N orders
      // and because the create wizard's product picker does not filter cancelled orders either.
      // Decided before the first write on purpose: a `return` from a `$transaction` callback
      // commits (ADR 0022), so every refusal has to be reachable while nothing has been written.
      if (selectedItems.some((item) => item.order.status === OrderStatus.CANCELLED)) {
        return { ok: false, error: "ORDER_CANCELLED" };
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
      const fxPair = resolveFxPair(input.currencyCode, input.exchangeRate ?? null, user?.baseCurrencyCode ?? null);
      const receivedDate = input.receivedDate ?? null;
      const isBornDelivered = receivedDate !== null;
      const delivery = await tx.delivery.create({
        data: {
          humanReadableId,
          storeId: input.storeId,
          userId,
          status: isBornDelivered ? DeliveryStatus.DELIVERED : DeliveryStatus.IN_TRANSIT,
          receivedDate,
          deliveryDate: input.deliveryDate,
          expectedArrivalFrom: input.expectedArrivalFrom ?? null,
          expectedArrivalTo: input.expectedArrivalTo ?? null,
          cost: input.cost,
          currencyCode: input.currencyCode,
          exchangeRate: fxPair.exchangeRate,
          exchangeRateBaseCode: fxPair.exchangeRateBaseCode,
        },
        select: { id: true },
      });

      const stateUpdate = await tx.orderItem.updateMany({
        where: {
          id: { in: uniqueProductIds },
          userId,
          deliveryState: { in: eligibleStates },
        },
        data: { deliveryState: getNextItemDeliveryState(isBornDelivered ? "create-received" : "create") },
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
      const { closedOrderIds, credited: completedCredited } = await persistDerivedOrderStatuses(tx, userId, orderIds);
      const closedOrders = await buildClosedOrderSnapshots(tx, closedOrderIds);

      // Only the quick-arrival shape credits the arrival: a delivery born IN_TRANSIT has not
      // arrived, and its 25 points are `markDeliveryDelivered`'s to award later. Inside this
      // transaction, never the independent money transaction that settles what the arrival closed.
      const receivedCredited = isBornDelivered
        ? await creditDeliveryReceived(tx, {
            userId,
            deliveryId: delivery.id,
            store,
            deliveredItemIds: uniqueProductIds,
          })
        : 0;

      return {
        ok: true,
        deliveryId: delivery.id,
        productCount: uniqueProductIds.length,
        orderCount: new Set(orderIds).size,
        closedOrders,
        credited: combineCredits(receivedCredited, completedCredited),
      };
    })
    .catch((error: unknown): CreateDeliveryTxOutcome => {
      if (error instanceof Error && error.message === "DELIVERY_PRODUCT_CONCURRENT_STATE_CHANGE") {
        return { ok: false, error: "PRODUCT_NOT_ELIGIBLE" };
      }
      throw error;
    });

  if (!outcome.ok) {
    return outcome;
  }

  const { credited, ...success } = outcome;
  return { ...success, progression: await settleProgression(userId, credited) };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export type DeliveryLifecycleError =
  "DELIVERY_NOT_FOUND" | "INVALID_STATUS" | "PRODUCTS_IN_OTHER_DELIVERY" | "RECEIVED_DATE_REQUIRED";

export type DeliveryLifecycleResult = { ok: true; productCount: number } | { ok: false; error: DeliveryLifecycleError };

/**
 * Result of `markDeliveryDelivered`: same shape as {@link DeliveryLifecycleResult}, plus the
 * closed-order snapshot the money transaction needs next (`FR-08-46`, `WO-08`). A superset, not a
 * replacement, so every existing caller that only reads `ok`/`error`/`productCount` keeps compiling.
 */
export type MarkDeliveryDeliveredResult =
  | { ok: true; productCount: number; closedOrders: ClosedOrderSnapshot[]; progression: ProgressionDelta | null }
  | { ok: false; error: DeliveryLifecycleError };

type MarkDeliveryDeliveredTxOutcome =
  | { ok: true; productCount: number; closedOrders: ClosedOrderSnapshot[]; credited: CreditOutcome }
  | { ok: false; error: DeliveryLifecycleError };

/**
 * One `StorePayment` reverted by `reopenDelivery`, captured verbatim (every scalar field plus its
 * `PaymentAllocation` rows) so the "Deshacer" action can restore it row-for-row without recomputing
 * anything (`FR-08-43`, `ADR 0032` §9). Recomputing at restore time could invent or lose money
 * relative to what was actually reverted, since the order's balance may have moved since the reopen.
 */
export type RevertedStorePaymentSnapshot = {
  id: string;
  storeId: string;
  userId: string;
  amount: number;
  paymentDate: Date;
  currencyCode: string;
  exchangeRate: Prisma.Decimal | null;
  exchangeRateBaseCode: string | null;
  note: string | null;
  migratedFromOrderId: string | null;
  settledByDeliveryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  allocations: Array<{
    id: string;
    paymentId: string;
    orderId: string;
    orderItemId: string | null;
    userId: string;
    amountMinor: number;
    settlesTarget: boolean;
    createdAt: Date;
  }>;
};

/**
 * One `PaymentAllocation` this delivery's own close-time consumption (`FR-08-46`) stamped with
 * `consumedByDeliveryId`, read (never deleted or modified) by `reopenDelivery` so the reopen toast
 * can name the surviving figure honestly (`WO-08` UX Notes, "known gap" closure). The row lives on
 * an EARLIER, unrelated `StorePayment` that carries no `settledByDeliveryId` at all: money paid to
 * the store before this delivery ever existed, which stays applied to the order regardless of the
 * order's reopened lifecycle state.
 */
export type SurvivingConsumedAllocationSnapshot = {
  amountMinor: number;
  currencyCode: string;
};

/**
 * Result of `reopenDelivery`: same shape as {@link DeliveryLifecycleResult}, plus what the
 * settlement reversal deleted (`FR-08-43`) and what this delivery's own close-time consumption
 * still has applied to the order (`FR-08-46`). `revertedSettlements.payments` is empty, and
 * `totalAmountMinor` is `0`, whenever this delivery never produced a settlement (checkbox left
 * unchecked, or the arrival did not close the order) — the reopen behaves exactly as it did before
 * this slice in that case. `survivingConsumedMinor` / `survivingConsumedAllocations` are
 * independently `0` / `[]` whenever this delivery's close never consumed any pre-existing
 * unassigned money; the two figures are unrelated and can each be zero, positive, or both positive
 * at once (see the "both" row in `WO-08`'s own reopen truth table).
 */
export type ReopenDeliveryResult =
  | {
      ok: true;
      productCount: number;
      revertedSettlements: {
        totalAmountMinor: number;
        payments: RevertedStorePaymentSnapshot[];
        survivingConsumedMinor: number;
        survivingConsumedAllocations: SurvivingConsumedAllocationSnapshot[];
      };
    }
  | { ok: false; error: DeliveryLifecycleError };

type DeliveryWithItems = {
  id: string;
  status: DeliveryStatus;
  store: StoreEligibilityRow | null;
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
      // Carried for the progression credit gate; every other reader of this shape ignores it.
      store: { select: STORE_CREDIT_ELIGIBILITY_SELECT },
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
): Promise<MarkDeliveryDeliveredResult> {
  const outcome = await prisma.$transaction<MarkDeliveryDeliveredTxOutcome>(async (tx) => {
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

    const { closedOrderIds, credited: completedCredited } = await persistDerivedOrderStatuses(tx, userId, orderIds);
    const closedOrders = await buildClosedOrderSnapshots(tx, closedOrderIds);

    const receivedCredited = await creditDeliveryReceived(tx, {
      userId,
      deliveryId,
      store: delivery.store,
      deliveredItemIds: itemIds,
    });

    return {
      ok: true,
      productCount: itemIds.length,
      closedOrders,
      credited: combineCredits(receivedCredited, completedCredited),
    };
  });

  if (!outcome.ok) {
    return outcome;
  }

  const { credited, ...success } = outcome;
  return { ...success, progression: await settleProgression(userId, credited) };
}

/**
 * Reopens a DELIVERED or CANCELLED delivery back to IN_TRANSIT.
 * Clears the received date and moves linked products back to IN_TRANSIT.
 * Reopening a cancelled delivery is rejected when any of its products joined
 * another live delivery in the meantime (one delivery per product).
 */
export async function reopenDelivery(deliveryId: string, userId: string): Promise<ReopenDeliveryResult> {
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

    // Settlement reversal (`FR-08-43`, `ADR 0032` §9), scoped strictly to `StorePayment` rows THIS
    // delivery produced (`settledByDeliveryId`). This must never widen to every payment of the
    // store: the order-close consumption's own allocation (`FR-08-46`) lives on a DIFFERENT, earlier
    // `StorePayment` that carries no `settledByDeliveryId` at all, because that money was already
    // paid to the store before this delivery ever existed and stays applied to the order regardless
    // of the order's reopened lifecycle state. This query structurally cannot reach that allocation,
    // and reopen must never be widened to try (`WO-08` Technical Notes, `ADR 0033` §4).
    const settledPayments = await tx.storePayment.findMany({
      where: { settledByDeliveryId: deliveryId, userId },
      select: {
        id: true,
        storeId: true,
        userId: true,
        amount: true,
        paymentDate: true,
        currencyCode: true,
        exchangeRate: true,
        exchangeRateBaseCode: true,
        note: true,
        migratedFromOrderId: true,
        settledByDeliveryId: true,
        createdAt: true,
        updatedAt: true,
        allocations: {
          select: {
            id: true,
            paymentId: true,
            orderId: true,
            orderItemId: true,
            userId: true,
            amountMinor: true,
            settlesTarget: true,
            createdAt: true,
          },
        },
      },
    });

    let revertedTotalAmountMinor = 0;
    const revertedOrderIds = new Set<string>();
    for (const payment of settledPayments) {
      revertedTotalAmountMinor += payment.amount;
      for (const allocation of payment.allocations) revertedOrderIds.add(allocation.orderId);
    }

    if (settledPayments.length > 0) {
      // `PaymentAllocation.payment` carries `onDelete: Cascade` (prisma/schema.prisma, migration
      // 20260808215744): deleting these StorePayment rows removes their PaymentAllocation rows with
      // them at the database level, so no separate allocation delete is needed here.
      await tx.storePayment.deleteMany({ where: { id: { in: settledPayments.map((payment) => payment.id) } } });
      await recalculateOrderAllocationCache(tx, [...revertedOrderIds], userId);
    }

    // Surviving-consumption read (`FR-08-46`, `WO-08` UX Notes "known gap" closure): rows this
    // delivery's own close-time consumption stamped via `consumeUnassignedStoreMoneyOnOrderClose`'s
    // `consumedByDeliveryId`, on some EARLIER, unrelated `StorePayment` this reopen never touches
    // (it is not in the `settledPayments` list above, and never can be — that query is scoped to
    // `settledByDeliveryId`, a different column entirely). This read is READ-ONLY: reopen must
    // never delete or modify these rows, because that money was paid to the store before this
    // delivery ever existed and stays correctly applied to the order regardless of the order's
    // reopened lifecycle state (deleting it would manufacture debt on an order that never lost that
    // payment, `ADR 0033 §4`'s own silent-understatement failure from the other direction).
    //
    // The stamp itself (`consumedByDeliveryId`) is also deliberately left in place, not cleared: it
    // is provenance of a fact that already happened ("this delivery's close consumed this money"),
    // independent of the delivery's current lifecycle state, not a claim tied to it. Clearing it on
    // reopen would lose that fact for a later re-close of the same delivery, with no upside: nothing
    // reads the stamp to decide whether THIS reopen is allowed, only to report what already
    // happened.
    const survivingConsumedRows = await tx.paymentAllocation.findMany({
      where: { consumedByDeliveryId: deliveryId, userId },
      select: { amountMinor: true, payment: { select: { currencyCode: true } } },
    });
    const survivingConsumedMinor = survivingConsumedRows.reduce((sum, row) => sum + row.amountMinor, 0);
    const survivingConsumedAllocations: SurvivingConsumedAllocationSnapshot[] = survivingConsumedRows.map((row) => ({
      amountMinor: row.amountMinor,
      currencyCode: row.payment.currencyCode,
    }));

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

    await persistDerivedOrderStatuses(tx, userId, orderIds);

    return {
      ok: true,
      productCount: itemIds.length,
      revertedSettlements: {
        totalAmountMinor: revertedTotalAmountMinor,
        payments: settledPayments,
        survivingConsumedMinor,
        survivingConsumedAllocations,
      },
    };
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

    await persistDerivedOrderStatuses(tx, userId, orderIds);

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

    await persistDerivedOrderStatuses(tx, userId, orderIds);

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
      const user = await tx.user.findUnique({ where: { id: userId }, select: { baseCurrencyCode: true } });
      // The currency this edit leaves the delivery in decides whether the pair is meaningful.
      const fxPair = resolveFxPair(
        input.currencyCode ?? delivery.currencyCode,
        input.exchangeRate ?? null,
        user?.baseCurrencyCode ?? null,
      );

      await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          ...(input.deliveryDate !== undefined ? { deliveryDate: input.deliveryDate } : {}),
          expectedArrivalFrom: input.expectedArrivalFrom ?? null,
          expectedArrivalTo: input.expectedArrivalTo ?? null,
          ...(input.cost !== undefined ? { cost: input.cost } : {}),
          ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
          exchangeRate: fxPair.exchangeRate,
          exchangeRateBaseCode: fxPair.exchangeRateBaseCode,
        },
      });

      const affectedOrderIds = [
        ...delivery.orderItems.map((link) => link.orderItem.orderId),
        ...selectedItems.map((item) => item.orderId),
      ];
      await persistDerivedOrderStatuses(tx, userId, affectedOrderIds);

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
