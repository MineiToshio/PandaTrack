import { OrderStatus, type Prisma } from "../../../../generated/prisma/client";
import { isWholeMajorAmount, isZeroDecimalCurrency } from "@/lib/currency";
import { MAX_PAYMENT_AMOUNT } from "@/lib/orders/orderValidation";
import { setOrderItemsPaidDeclaredWithin } from "./orderItemMutations";
import {
  listOrderPaymentRecords,
  recalculateOrderAllocationCache,
  type OrderPaymentRecord,
} from "./orderPaymentAllocations";
import { runSerializableTransaction } from "./serializableTransaction";
import {
  getStoreDebtMinor,
  isActiveOrderStatus,
  resolveInheritedStoreCurrency,
  type StorePaymentListRow,
} from "./storePaymentQueries";

/**
 * Store-level payments.
 *
 * A payment is money that left the collector's hands toward a store. What it was for is a separate,
 * optional declaration: zero or more `PaymentAllocation` rows, each naming an order and optionally
 * one item of it. One transfer can therefore cover several orders, and a payment can sit
 * unallocated (money the store owes back, or money not yet declared).
 *
 * Every refusal in this module is decided before the first write. Returning normally from a
 * `$transaction` callback COMMITS everything written so far, so a refusal placed after a write
 * would persist a payment while telling the caller it failed (ADR 0022).
 */

/** One declaration line: what this payment covers, and how much of it. */
export type StorePaymentAllocationInput = {
  orderId: string;
  orderItemId?: string | null;
  amountMinor: number;
  settlesTarget?: boolean;
};

export type CreateStorePaymentInput = {
  userId: string;
  storeId: string;
  amount: number;
  paymentDate: Date;
  /** Required when the store has standing orders in more than one currency. */
  currencyCode?: string;
  note?: string | null;
  /**
   * FX shape of the payment, mirroring `Order`. Passed by callers that know the rate applies (a
   * payment raised against exactly one order); left null for a payment spanning several orders,
   * which is reconciled on its own like any other unrated row.
   */
  exchangeRate?: number | null;
  exchangeRateBaseCode?: string | null;
  allocations?: StorePaymentAllocationInput[];
  /**
   * Products the collector declares covered by this payment, with no amount attached. Orthogonal to
   * `allocations`: these ids move no money and are not capped by anything. They must belong to the
   * caller and to an order of this same store, which is checked before the first write.
   */
  declarePaidItemIds?: string[];
};

export type CreateStorePaymentError =
  /** Not an integer, not positive, or beyond the amount ceiling. */
  | "AMOUNT_INVALID"
  /** A zero-decimal currency (CLP/JPY/KRW) received an amount carrying subunits. */
  | "AMOUNT_FRACTIONAL_SUBUNITS"
  | "STORE_NOT_FOUND"
  /** The store's standing orders span several currencies, so the caller must name one. */
  | "CURRENCY_REQUIRED"
  /** The payment is larger than what the collector still owes this store in that currency. */
  | "STORE_DEBT_EXCEEDED"
  | "ALLOCATION_SUM_EXCEEDS_PAYMENT"
  | "ORDER_NOT_FOUND"
  /** The allocated order belongs to a different store than the payment. */
  | "STORE_MISMATCH"
  | "ORDER_CANCELLED"
  | "CURRENCY_MISMATCH"
  /** Negative, fractional, zero, or over the ceiling. */
  | "ALLOCATION_AMOUNT_INVALID"
  /**
   * `settlesTarget` is deprecated and no longer accepted on write. An amount-less declaration is
   * `OrderItem.paidDeclaredAt`, reachable through `declarePaidItemIds`.
   */
  | "SETTLES_TARGET_UNSUPPORTED"
  /** The order would end up with more money declared against it than it costs. */
  | "EXCEEDS_BALANCE"
  | "ITEM_ORDER_MISMATCH"
  /** The item would end up with more declared against it than its own price base. */
  | "EXCEEDS_ITEM_BASE"
  | "DATE_BEFORE_ORDER";

/** An order this payment touched, as it stands once the payment is written. */
export type AffectedOrderSnapshot = {
  orderId: string;
  totalCost: number;
  allocatedAmountMinor: number;
  payments: OrderPaymentRecord[];
};

export type CreateStorePaymentResult =
  | {
      ok: true;
      paymentId: string;
      currencyCode: string;
      affectedOrders: AffectedOrderSnapshot[];
      /** The written payment in the exact shape the "Pagos a esta tienda" card lists it in, so a
          caller can reconcile an optimistic row without a second query. */
      payment: StorePaymentListRow;
    }
  | { ok: false; error: CreateStorePaymentError; orderId?: string; orderItemId?: string };

export type DeleteStorePaymentResult = { ok: true; affectedOrderIds: string[] } | { ok: false; error: "NOT_FOUND" };

/** An allocation with every optional field resolved, ready to be written. */
export type NormalizedAllocation = {
  orderId: string;
  orderItemId: string | null;
  amountMinor: number;
  settlesTarget: boolean;
};

/**
 * A validated allocation plus the two labels the store detail's payments card renders it with.
 *
 * They are resolved by `validateAllocations`, which already reads every targeted order and product,
 * and therefore BEFORE the first write. That ordering is the point (ADR 0022): the canonical
 * `StorePaymentListRow` this mutation returns is then assembled purely from memory after the write,
 * so there is no post-write read that could fail and tempt a `return` that would commit a refusal.
 */
export type NormalizedAllocationWithLabels = NormalizedAllocation & {
  orderHumanReadableId: string;
  orderItemName: string | null;
  /**
   * Whether the targeted order is still active. Carried out of validation for the same reason as
   * the labels: the row this mutation returns has to tell the store detail whether this line moves
   * the active-orders progress bar, and validation is the only place that has already read the
   * order's status.
   */
  orderActive: boolean;
};

type AllocationValidationResult =
  | { ok: true; allocations: NormalizedAllocationWithLabels[]; affectedOrderIds: string[] }
  | { ok: false; error: CreateStorePaymentError; orderId?: string; orderItemId?: string };

type OrderForAllocation = {
  id: string;
  humanReadableId: string;
  storeId: string;
  currencyCode: string;
  status: OrderStatus;
  orderDate: Date;
  totalCost: number;
  allocatedAmountMinor: number;
  items: Array<{ id: string; name: string; unitPrice: number | null; quantity: number }>;
};

/**
 * The ceiling an item-level allocation is checked against.
 *
 * An item priced per unit bounds itself. An item with no unit price has no base of its own, except
 * in the one case where the order's own total is unambiguously that item's price: when it is the
 * order's only item. Anything else returns `null`, meaning "no known base": the allocation is
 * accepted and only the order-level ceiling applies, because refusing on a price nobody recorded
 * would block a legitimate declaration.
 */
function resolveItemAllocationBase(
  item: { unitPrice: number | null; quantity: number },
  order: { totalCost: number; items: unknown[] },
): number | null {
  if (item.unitPrice !== null) return item.unitPrice * item.quantity;
  return order.items.length === 1 ? order.totalCost : null;
}

function isValidMinorAmount(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_PAYMENT_AMOUNT;
}

/**
 * Sentinel for the one refusal `createStorePayment` cannot hoist: the declared products were proven
 * to belong to this store before the first write, so a later mismatch can only be a concurrent
 * delete, and by then the payment row exists. Returning would commit it (ADR 0022).
 */
class DeclaredItemsRollback extends Error {
  constructor() {
    super("DECLARED_ITEMS_GONE");
    this.name = "DeclaredItemsRollback";
  }
}

/**
 * The first declared product id that is not this collector's, or whose order belongs to another
 * store. `null` when every id checks out (and when there are none). Read-only, so it can run as the
 * last refusal before the first write.
 */
async function findDeclaredItemOutsideStore(
  tx: Prisma.TransactionClient,
  itemIds: string[],
  userId: string,
  storeId: string,
): Promise<string | null> {
  const uniqueIds = [...new Set(itemIds)];
  if (uniqueIds.length === 0) return null;

  const reachable = await tx.orderItem.findMany({
    where: { id: { in: uniqueIds }, userId, order: { storeId } },
    select: { id: true },
  });
  const reachableIds = new Set(reachable.map((item) => item.id));
  return uniqueIds.find((id) => !reachableIds.has(id)) ?? null;
}

async function validateAllocations(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    storeId: string;
    currencyCode: string;
    paymentDate: Date;
    allocations: StorePaymentAllocationInput[];
  },
): Promise<AllocationValidationResult> {
  const { userId, storeId, currencyCode, paymentDate, allocations } = params;
  if (allocations.length === 0) {
    return { ok: true, allocations: [], affectedOrderIds: [] };
  }

  const orderIds = [...new Set(allocations.map((allocation) => allocation.orderId))];
  const orders: OrderForAllocation[] = await tx.order.findMany({
    where: { id: { in: orderIds }, userId },
    select: {
      id: true,
      humanReadableId: true,
      storeId: true,
      currencyCode: true,
      status: true,
      orderDate: true,
      totalCost: true,
      allocatedAmountMinor: true,
      items: { select: { id: true, name: true, unitPrice: true, quantity: true } },
    },
  });
  const orderById = new Map(orders.map((order) => [order.id, order]));

  // Money already declared against the targeted items, so the per-item ceiling accounts for what
  // earlier payments put there. Read once for the whole batch rather than per allocation.
  const targetedItemIds = allocations
    .map((allocation) => allocation.orderItemId)
    .filter((itemId): itemId is string => typeof itemId === "string" && itemId.length > 0);
  const allocatedByItemId = new Map<string, number>();
  if (targetedItemIds.length > 0) {
    const itemGroups = await tx.paymentAllocation.groupBy({
      by: ["orderItemId"],
      where: { orderItemId: { in: targetedItemIds }, userId },
      _sum: { amountMinor: true },
    });
    for (const group of itemGroups) {
      if (group.orderItemId) allocatedByItemId.set(group.orderItemId, group._sum.amountMinor ?? 0);
    }
  }

  // Running totals across this batch: two lines against the same order (or the same item) must be
  // checked against their combined effect, not each on its own.
  const pendingByOrderId = new Map<string, number>();
  const pendingByItemId = new Map<string, number>();
  const normalized: NormalizedAllocationWithLabels[] = [];

  for (const allocation of allocations) {
    const order = orderById.get(allocation.orderId);
    if (!order) return { ok: false, error: "ORDER_NOT_FOUND", orderId: allocation.orderId };
    if (order.storeId !== storeId) return { ok: false, error: "STORE_MISMATCH", orderId: order.id };
    if (order.status === OrderStatus.CANCELLED) return { ok: false, error: "ORDER_CANCELLED", orderId: order.id };
    if (order.currencyCode !== currencyCode) return { ok: false, error: "CURRENCY_MISMATCH", orderId: order.id };
    if (paymentDate < order.orderDate) return { ok: false, error: "DATE_BEFORE_ORDER", orderId: order.id };

    // Deliberately BEFORE the amount checks: a `{ amountMinor: 0, settlesTarget: true }` payload
    // would otherwise slip past a guard placed after them and write the very row this refusal
    // exists to stop.
    if (allocation.settlesTarget) {
      return { ok: false, error: "SETTLES_TARGET_UNSUPPORTED", orderId: order.id };
    }
    if (!isValidMinorAmount(allocation.amountMinor)) {
      return { ok: false, error: "ALLOCATION_AMOUNT_INVALID", orderId: order.id };
    }
    // A zero line says nothing at all now that `settlesTarget` is refused on write: it is money
    // declared as covering something, and zero money covers nothing.
    if (allocation.amountMinor === 0) {
      return { ok: false, error: "ALLOCATION_AMOUNT_INVALID", orderId: order.id };
    }
    // Per LINE, not only per payment. The payment-level guard in `createStorePayment` cannot see
    // this: a whole JPY 10000 splits perfectly well into 4950 + 5050, two amounts that have no
    // representation in a currency with no subunit and would render back as something else. Refused
    // here, with every other allocation check, so it lands before the first write (ADR 0022).
    if (isZeroDecimalCurrency(currencyCode) && !isWholeMajorAmount(allocation.amountMinor)) {
      return {
        ok: false,
        error: "AMOUNT_FRACTIONAL_SUBUNITS",
        orderId: order.id,
        orderItemId: allocation.orderItemId ?? undefined,
      };
    }

    const pendingForOrder = (pendingByOrderId.get(order.id) ?? 0) + allocation.amountMinor;
    if (order.allocatedAmountMinor + pendingForOrder > order.totalCost) {
      return { ok: false, error: "EXCEEDS_BALANCE", orderId: order.id };
    }
    pendingByOrderId.set(order.id, pendingForOrder);

    const orderItemId = allocation.orderItemId ?? null;
    let orderItemName: string | null = null;
    if (orderItemId !== null) {
      const item = order.items.find((candidate) => candidate.id === orderItemId);
      if (!item) return { ok: false, error: "ITEM_ORDER_MISMATCH", orderId: order.id, orderItemId };
      orderItemName = item.name;

      const base = resolveItemAllocationBase(item, order);
      if (base !== null) {
        const pendingForItem = (pendingByItemId.get(orderItemId) ?? 0) + allocation.amountMinor;
        const alreadyAllocated = allocatedByItemId.get(orderItemId) ?? 0;
        if (alreadyAllocated + pendingForItem > base) {
          return { ok: false, error: "EXCEEDS_ITEM_BASE", orderId: order.id, orderItemId };
        }
        pendingByItemId.set(orderItemId, pendingForItem);
      }
    }

    normalized.push({
      orderId: order.id,
      orderItemId,
      amountMinor: allocation.amountMinor,
      // Flatly false: the only payload that could have made it true is refused above.
      settlesTarget: false,
      orderHumanReadableId: order.humanReadableId,
      orderItemName,
      orderActive: isActiveOrderStatus(order.status),
    });
  }

  return { ok: true, allocations: normalized, affectedOrderIds: [...pendingByOrderId.keys()] };
}

/**
 * Writes a payment and its declarations. Pure persistence: the caller has already decided that
 * every value here is legal, which is what lets this run after another mutation's own writes
 * without introducing a refusal past the point of no return.
 *
 * DECLARED GAP, not an oversight: this is exported and `orderMutations.ts` calls it directly for an
 * order's initial payment, skipping `validateAllocations` entirely — including its per-line
 * `AMOUNT_FRACTIONAL_SUBUNITS` check. Harmless today because that path hand-builds exactly one
 * allocation whose `amountMinor` equals the payment's own amount, which `createStorePayment`'s
 * payment-level guard already validated. The day that path emits several lines, the per-line check
 * has to move up here.
 */
export async function writeStorePaymentWithAllocations(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    storeId: string;
    amount: number;
    paymentDate: Date;
    currencyCode: string;
    note?: string | null;
    exchangeRate?: number | null;
    exchangeRateBaseCode?: string | null;
    allocations: NormalizedAllocation[];
  },
): Promise<{ paymentId: string; affectedOrderIds: string[] }> {
  const payment = await tx.storePayment.create({
    data: {
      storeId: params.storeId,
      userId: params.userId,
      amount: params.amount,
      paymentDate: params.paymentDate,
      currencyCode: params.currencyCode,
      exchangeRate: params.exchangeRate ?? null,
      exchangeRateBaseCode: params.exchangeRateBaseCode ?? null,
      note: params.note ?? null,
    },
    select: { id: true },
  });

  if (params.allocations.length > 0) {
    await tx.paymentAllocation.createMany({
      data: params.allocations.map((allocation) => ({
        paymentId: payment.id,
        orderId: allocation.orderId,
        orderItemId: allocation.orderItemId,
        // Copied from the payment's own owner rather than accepted per row, so a child can never
        // be attributed to an account other than the one the parent belongs to.
        userId: params.userId,
        amountMinor: allocation.amountMinor,
        settlesTarget: allocation.settlesTarget,
      })),
    });
  }

  const affectedOrderIds = [...new Set(params.allocations.map((allocation) => allocation.orderId))];
  await recalculateOrderAllocationCache(tx, affectedOrderIds, params.userId);

  return { paymentId: payment.id, affectedOrderIds };
}

async function loadAffectedOrderSnapshots(
  tx: Prisma.TransactionClient,
  orderIds: string[],
  userId: string,
): Promise<AffectedOrderSnapshot[]> {
  const snapshots: AffectedOrderSnapshot[] = [];
  for (const orderId of orderIds) {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      select: { totalCost: true, allocatedAmountMinor: true },
    });
    if (!order) continue;
    const payments = await listOrderPaymentRecords(tx, orderId, userId);
    snapshots.push({
      orderId,
      totalCost: order.totalCost,
      allocatedAmountMinor: order.allocatedAmountMinor,
      payments,
    });
  }
  return snapshots;
}

/**
 * Records a payment to a store, with an optional declaration of what it covers.
 *
 * The payment is capped at the store's outstanding debt in that currency: paying more than is owed
 * is refused rather than absorbed as credit, because in practice it means the collector picked the
 * wrong store or the wrong amount, and a silent credit is far harder to notice than a refusal.
 */
export async function createStorePayment(input: CreateStorePaymentInput): Promise<CreateStorePaymentResult> {
  const { userId, storeId, amount, paymentDate, note = null, allocations = [], declarePaidItemIds = [] } = input;

  return runSerializableTransaction<CreateStorePaymentResult>(async (tx) => {
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_PAYMENT_AMOUNT) {
      return { ok: false, error: "AMOUNT_INVALID" };
    }

    const store = await tx.store.findFirst({ where: { id: storeId }, select: { id: true } });
    if (!store) {
      return { ok: false, error: "STORE_NOT_FOUND" };
    }

    const currencyCode = input.currencyCode ?? (await resolveInheritedStoreCurrency(tx, userId, storeId));
    if (!currencyCode) {
      return { ok: false, error: "CURRENCY_REQUIRED" };
    }

    // Server-side defense: a zero-decimal currency has no subunit, so a payment must resolve to a
    // whole major amount. The client parser already rejects fractional input; a crafted request
    // must not be able to persist a fractional amount that never renders back correctly.
    if (isZeroDecimalCurrency(currencyCode) && !isWholeMajorAmount(amount)) {
      return { ok: false, error: "AMOUNT_FRACTIONAL_SUBUNITS" };
    }

    const debtMinor = await getStoreDebtMinor(tx, userId, storeId, currencyCode);
    if (amount > debtMinor) {
      return { ok: false, error: "STORE_DEBT_EXCEEDED" };
    }

    const allocationTotal = allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0);
    if (allocationTotal > amount) {
      return { ok: false, error: "ALLOCATION_SUM_EXCEEDS_PAYMENT" };
    }

    const validated = await validateAllocations(tx, { userId, storeId, currencyCode, paymentDate, allocations });
    if (!validated.ok) {
      return validated;
    }

    // Last refusal before the first write (ADR 0022): every declared product must belong to this
    // collector AND to an order of this same store. Checking it here, rather than trusting
    // `setOrderItemsPaidDeclaredWithin` to refuse later, is what keeps the write below unconditional.
    const foreignDeclaredItemId = await findDeclaredItemOutsideStore(tx, declarePaidItemIds, userId, storeId);
    if (foreignDeclaredItemId) {
      return { ok: false, error: "ITEM_ORDER_MISMATCH", orderItemId: foreignDeclaredItemId };
    }

    const written = await writeStorePaymentWithAllocations(tx, {
      userId,
      storeId,
      amount,
      paymentDate,
      currencyCode,
      note,
      exchangeRate: input.exchangeRate,
      exchangeRateBaseCode: input.exchangeRateBaseCode,
      allocations: validated.allocations,
    });

    // Ownership was proven above, so this cannot refuse for any reason but a concurrent delete. If
    // it somehow does, the sentinel rolls the payment back rather than committing it beside a
    // declaration that never landed: a plain `return` here would commit the payment (ADR 0022).
    const declared = await setOrderItemsPaidDeclaredWithin(tx, declarePaidItemIds, userId, true);
    if (!declared.ok) {
      throw new DeclaredItemsRollback();
    }

    const affectedOrders = await loadAffectedOrderSnapshots(tx, written.affectedOrderIds, userId);
    const allocatedTotal = validated.allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0);

    return {
      ok: true,
      paymentId: written.paymentId,
      currencyCode,
      affectedOrders,
      payment: {
        id: written.paymentId,
        amount,
        currencyCode,
        paymentDate,
        note,
        allocatedTotal,
        // Distinct ORDERS, exactly as `getStorePaymentsForStore` counts them: one order can carry
        // several lines of the same payment, and the figure feeds a modal that names pedidos.
        claimingOrdersCount: new Set(validated.allocations.map((allocation) => allocation.orderId)).size,
        // Assembled from what validation already read, not from a fresh query: see the note on
        // `NormalizedAllocation`'s display fields. `orderCancelled` is flatly false because
        // validation refuses `ORDER_CANCELLED` before anything is written.
        allocations: validated.allocations.map((allocation) => ({
          orderId: allocation.orderId,
          orderHumanReadableId: allocation.orderHumanReadableId,
          orderCancelled: false,
          orderActive: allocation.orderActive,
          orderItemId: allocation.orderItemId,
          orderItemName: allocation.orderItemName,
          amountMinor: allocation.amountMinor,
          settlesTarget: allocation.settlesTarget,
        })),
      },
    };
  }).catch((error: unknown) => {
    // Mapped back to a code the caller already handles, with no widened result type. Anything else
    // is a genuine failure and must keep propagating.
    if (error instanceof DeclaredItemsRollback) {
      return { ok: false, error: "ITEM_ORDER_MISMATCH" } satisfies CreateStorePaymentResult;
    }
    throw error;
  });
}

/**
 * Deletes a whole payment and every declaration hanging off it, then rewrites the allocation cache
 * of every order it was declared against. Used when the money itself is being taken back, as
 * opposed to a single order stepping out of a payment it shared.
 */
export async function deleteStorePayment(paymentId: string, userId: string): Promise<DeleteStorePaymentResult> {
  return runSerializableTransaction<DeleteStorePaymentResult>(async (tx) => {
    const payment = await tx.storePayment.findFirst({
      where: { id: paymentId, userId },
      select: { id: true, allocations: { select: { orderId: true } } },
    });

    if (!payment) {
      return { ok: false, error: "NOT_FOUND" };
    }

    const affectedOrderIds = [...new Set(payment.allocations.map((allocation) => allocation.orderId))];

    // The allocations go with it through the cascade; the cache they fed has to be rewritten here.
    await tx.storePayment.delete({ where: { id: payment.id } });
    await recalculateOrderAllocationCache(tx, affectedOrderIds, userId);

    return { ok: true, affectedOrderIds };
  });
}
