import { prisma } from "@/lib/prisma";
import { DeliveryStatus, OrderItemDeliveryState, OrderStatus } from "../../../../generated/prisma/client";
import { resolveExchangeRateBaseCode } from "@/lib/fx/reconciliation";
import { isWholeMajorAmount, isZeroDecimalCurrency } from "@/lib/currency";
import { generateOrderHumanReadableId } from "@/lib/orders/orderIdentifier";
import { appendOrderHistoryEntry, OrderHistoryEventType } from "./orderHistoryMutations";
import { createOrderItems, findInvalidProductTypeKey, replaceOrderItems } from "./orderItemMutations";
import { recalculateOrderAllocationCache } from "./orderPaymentAllocations";
import { writeStorePaymentWithAllocations } from "./storePaymentMutations";
import type { CancelPaymentsChoice, OrderCreateInput, OrderEditInput } from "@/lib/orders/orderValidation";

type CreateOrderResult =
  | { ok: true; orderId: string; humanReadableId: string }
  | { ok: false; error: "STORE_NOT_FOUND" | "INVALID_PRODUCT_TYPE" | "INITIAL_PAYMENT_INVALID" };

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
        // Money is declared against a store, so moving an order to another store (or restating it
        // in another currency) would strand every declaration pointing at it.
        | "CURRENCY_CHANGE_BLOCKED"
        // An item that money has been declared against cannot be removed, and its price cannot
        // drop below what is already declared against it.
        | "ITEM_HAS_ALLOCATION"
        | "ITEM_PRICE_BELOW_ALLOCATED"
        // An item the collector marked as paid cannot be removed either: the mark writes no
        // history entry, so deleting the row would erase the claim without a trace.
        | "ITEM_HAS_PAID_MARK"
        // Total can't be lowered below what is already declared as paid — collectors must delete
        // payments first if they want to bring the total down past that.
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

/**
 * An advance recorded at creation time is bounded by the order it belongs to: positive, whole in
 * its own currency, and never more than the order costs. The store-level debt ceiling that governs
 * every other payment is not applied here, because the order being created is itself the debt.
 */
function isValidInitialPayment(amount: number, order: { totalCost: number; currencyCode: string }): boolean {
  if (!Number.isInteger(amount) || amount <= 0 || amount > order.totalCost) return false;
  return !isZeroDecimalCurrency(order.currencyCode) || isWholeMajorAmount(amount);
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

      // The advance is validated here, with the order still unwritten, for the same reason the
      // category check above is: a refusal raised once the order exists would commit it.
      if (input.initialPayment && !isValidInitialPayment(input.initialPayment.amount, input)) {
        return { ok: false, error: "INITIAL_PAYMENT_INVALID" };
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

      if (input.initialPayment) {
        // Same transaction as the order itself: an advance the collector reported while creating
        // the order must never end up recorded without it, or recorded against nothing.
        const createdItems = await tx.orderItem.findMany({ where: { orderId: order.id }, select: { id: true } });
        const singleItemId = createdItems.length === 1 ? createdItems[0].id : null;
        await writeStorePaymentWithAllocations(tx, {
          userId,
          storeId: input.storeId,
          amount: input.initialPayment.amount,
          paymentDate: input.initialPayment.paymentDate,
          currencyCode: input.currencyCode,
          exchangeRate,
          exchangeRateBaseCode: resolveExchangeRateBaseCode(exchangeRate, user?.baseCurrencyCode ?? null),
          allocations: [
            {
              orderId: order.id,
              orderItemId: singleItemId,
              amountMinor: input.initialPayment.amount,
              settlesTarget: false,
            },
          ],
        });
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
      select: { status: true, storeId: true, currencyCode: true, allocatedAmountMinor: true },
    });

    if (!order) {
      return { ok: false, error: "ORDER_NOT_FOUND" };
    }

    if (order.status === OrderStatus.CANCELLED) {
      return { ok: false, error: "ORDER_NOT_EDITABLE" };
    }

    // Declared money pins two fields in place. A payment belongs to a store and is denominated in
    // one currency, so an order carrying declarations cannot move to another store or be restated
    // in another currency without the declarations becoming lies. Read once, used by both guards.
    const hasAllocations =
      (await tx.paymentAllocation.findFirst({ where: { orderId, userId }, select: { id: true } })) !== null;

    if (input.storeId !== undefined && input.storeId !== order.storeId) {
      const hasDeliveries = await tx.deliveryOrderItem.findFirst({
        where: { orderItem: { orderId } },
        select: { deliveryId: true },
      });
      if (hasDeliveries || hasAllocations || order.status !== OrderStatus.OPEN) {
        return { ok: false, error: "STORE_CHANGE_BLOCKED" };
      }
      const store = await tx.store.findFirst({ where: { id: input.storeId }, select: { id: true } });
      if (!store) {
        return { ok: false, error: "STORE_NOT_FOUND" };
      }
    }

    if (input.currencyCode !== undefined && input.currencyCode !== order.currencyCode && hasAllocations) {
      return { ok: false, error: "CURRENCY_CHANGE_BLOCKED" };
    }

    // Total guard — server-side safety net for the client check in `OrderEditForm`. We refuse to
    // update the total to a value below what is already declared as paid against this order; doing
    // so would produce a negative `remainingAmount` everywhere downstream (hero, sticky bar, list
    // cards), and would leave the order over-allocated.
    if (input.totalCost !== undefined && input.totalCost < order.allocatedAmountMinor) {
      return { ok: false, error: "TOTAL_BELOW_PAID" };
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
        return { ok: false, error: replaceResult.error };
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
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });

    return { ok: true };
  });
}

/**
 * Cancels an order and decides what happens to the money declared against it.
 *
 * A cancellation never destroys a payment: the money left the collector's hands whatever happened
 * to the order. What it decides is whether the declaration survives. `lost` keeps the allocations
 * pinned to the cancelled order, which is what makes the money readable as sunk. `credit` drops
 * them, returning the money to the store's undeclared pool so it can cover something else.
 */
export async function cancelOrder(
  orderId: string,
  userId: string,
  cancellationReason: string | null = null,
  paymentsChoice: CancelPaymentsChoice = "lost",
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

    // The order is archived, not destroyed, and the reactivate flow relies on the payment trail
    // still being readable so the collector can see what they paid before they paused it.
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED, cancellationReason },
    });

    // Credit branch: the collector was refunded, or the money stays with the store to cover
    // something else. Only the declarations go; the payments themselves survive, unallocated,
    // which is precisely what a store credit is.
    if (paymentsChoice === "credit") {
      await tx.paymentAllocation.deleteMany({ where: { orderId, userId } });
      await tx.order.update({
        where: { id: orderId },
        data: { allocatedAmountMinor: 0 },
      });
      // The collector just unlinked every peso that was covering this order, so a product still
      // reading "Saldado · marcado" would be claiming a coverage nothing funds — and `reactivateOrder`
      // would bring the order back full of those claims with zero money behind them. The `lost`
      // branch keeps its allocations, so by the same logic it keeps its marks.
      await tx.orderItem.updateMany({ where: { orderId, userId }, data: { paidDeclaredAt: null } });
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
  // Last entry wins for a repeated id, which is what a statement-per-update already did implicitly.
  // Resolving it here keeps that outcome deterministic once the statements are merged below.
  const rateByOrderId = new Map<string, number>();
  for (const update of updates) {
    rateByOrderId.set(update.orderId, update.exchangeRate);
  }
  if (rateByOrderId.size === 0) return 0;

  // Orders that share a rate share the whole update, since the base code is derived from that same
  // rate and one base currency, so they belong in one statement. One statement per order is what
  // this did before, and it does not survive contact with a real collection: the reconciliation
  // screen assigns one rate per currency pair, so a few hundred pending orders became a few hundred
  // round trips inside a single transaction and the bulk apply timed out. Grouped, the same work is
  // a handful of statements.
  const orderIdsByRate = new Map<number, string[]>();
  for (const [orderId, exchangeRate] of rateByOrderId) {
    const grouped = orderIdsByRate.get(exchangeRate);
    if (grouped) grouped.push(orderId);
    else orderIdsByRate.set(exchangeRate, [orderId]);
  }

  const results = await prisma.$transaction(
    [...orderIdsByRate].map(([exchangeRate, orderIds]) =>
      prisma.order.updateMany({
        where: { id: { in: orderIds }, userId },
        data: {
          exchangeRate,
          exchangeRateBaseCode: resolveExchangeRateBaseCode(exchangeRate, baseCurrencyCode),
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

    // Money declared against a disappearing order. A payment raised for this order alone, whose
    // declarations cover its whole amount, goes with it: keeping it would leave an unexplained
    // payment nobody can attribute, still counting against the store's debt in
    // `getStoreDebtByCurrency` (which sums `StorePayment.amount`, not allocations). A payment shared
    // with other orders survives and loses only its slice here, because it is still explaining those.
    //
    // Counted PER PAYMENT rather than per allocation: a payment broken down across this order's
    // products has N+1 declarations, so the old "exactly one declaration, and its amount equals the
    // payment's" test matched nothing and every such payment survived as an orphan. This is the same
    // rule generalized, with the single-line case as its N=1.
    const allocations = await tx.paymentAllocation.findMany({
      where: { orderId, userId },
      select: { amountMinor: true, paymentId: true, payment: { select: { amount: true } } },
    });

    const touchedPaymentIds = [...new Set(allocations.map((allocation) => allocation.paymentId))];
    const claimedByThisOrder = new Map<string, number>();
    const paymentTotalById = new Map<string, number>();
    for (const allocation of allocations) {
      claimedByThisOrder.set(
        allocation.paymentId,
        (claimedByThisOrder.get(allocation.paymentId) ?? 0) + allocation.amountMinor,
      );
      paymentTotalById.set(allocation.paymentId, allocation.payment.amount);
    }

    const otherOrdersClaims =
      touchedPaymentIds.length > 0
        ? await tx.paymentAllocation.findMany({
            where: { paymentId: { in: touchedPaymentIds }, userId, orderId: { not: orderId } },
            select: { paymentId: true, orderId: true },
          })
        : [];
    const paymentIdsWithOtherClaims = new Set(otherOrdersClaims.map((allocation) => allocation.paymentId));

    // A payment with a partial claim and no other order deliberately SURVIVES, unassigned, unlike in
    // `deleteOrderPayment`. There the collector says "this money never existed"; here they say "this
    // order never existed", and the transfer did happen. It stays reachable and deletable from the
    // store detail.
    const paymentIdsToDelete = touchedPaymentIds.filter(
      (paymentId) =>
        !paymentIdsWithOtherClaims.has(paymentId) &&
        claimedByThisOrder.get(paymentId) === paymentTotalById.get(paymentId),
    );

    if (paymentIdsToDelete.length > 0) {
      // Defensive and provably empty: a payment reaching here has no declaration outside this order,
      // so no other order's cache can move. Derived from the read above rather than re-queried, and
      // kept so a future shape change cannot silently strand it.
      const deletedIds = new Set(paymentIdsToDelete);
      const collateralOrderIds = otherOrdersClaims
        .filter((allocation) => deletedIds.has(allocation.paymentId))
        .map((allocation) => allocation.orderId);

      await tx.storePayment.deleteMany({ where: { id: { in: paymentIdsToDelete }, userId } });
      await recalculateOrderAllocationCache(tx, collateralOrderIds, userId);
    }

    await tx.paymentAllocation.deleteMany({ where: { orderId, userId } });
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
