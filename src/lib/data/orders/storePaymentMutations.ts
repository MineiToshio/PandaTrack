import { OrderItemDeliveryState, OrderStatus, type Prisma } from "../../../../generated/prisma/client";
import { isWholeMajorAmount, isZeroDecimalCurrency } from "@/lib/currency";
import { MAX_PAYMENT_AMOUNT } from "@/lib/orders/orderValidation";
import { setOrderItemsPaidDeclaredWithin } from "./orderItemMutations";
import { openBalanceMinor, openBalanceMinorByOrderId } from "./orderOpenBalance";
import {
  listOrderPaymentRecords,
  recalculateOrderAllocationCache,
  type OrderPaymentRecord,
} from "./orderPaymentAllocations";
import { runSerializableTransaction } from "../serializableTransaction";
import {
  creditOrderPayment,
  settleProgression,
  type CreditOutcome,
  type ProgressionDelta,
} from "@/lib/data/progression/accrual";
import {
  isStoreCreditEligible,
  STORE_CREDIT_ELIGIBILITY_SELECT,
  type StoreEligibilityRow,
} from "@/lib/data/progression/storeCreditEligibility";
import {
  getStoreDebtMinor,
  getStorePaymentRemainders,
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
  /**
   * Set only by `createStorePaymentAction` (WO-09, ADR 0033 §5a). Hardens the payment-level rule
   * from `Σ allocations.amountMinor <= amount` to `Σ allocations.amountMinor + parkedAmountMinor
   * === amount`. `addOrderPayment` and `createOrder`'s initial payment never set it, so they keep
   * seeing the plain `<=` rule (`BR-05-31`).
   */
  requireFullAllocation?: boolean;
  /**
   * The deliberate "I don't know yet" amount (spec §3.4, ADR 0033 §5b), only meaningful together
   * with `requireFullAllocation: true`. Request-shape only: it is never persisted, and it exists
   * purely so the equality check above has something to add to `Σ allocations.amountMinor` when the
   * collector deliberately leaves money unassigned. Defaults to 0.
   */
  parkedAmountMinor?: number;
  /**
   * The delivery whose arrival settled this payment (`ADR 0032`, `WO-08`). Set only by the
   * order-close money transaction (`runOrderCloseMoneyTransaction`); every other caller leaves it
   * unset, which is what keeps every payment recorded outside the settlement flow carrying no
   * provenance, exactly as today.
   */
  settledByDeliveryId?: string;
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
  /**
   * `requireFullAllocation` only: allocations plus `parkedAmountMinor` fall short of the amount.
   * The undershoot half of the hardened equality rule (`Σ allocations + parked === amount`).
   */
  | "ALLOCATION_SUM_BELOW_PAYMENT"
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

type CreateStorePaymentSuccess = {
  ok: true;
  paymentId: string;
  currencyCode: string;
  affectedOrders: AffectedOrderSnapshot[];
  /** The written payment in the exact shape the "Pagos a esta tienda" card lists it in, so a
      caller can reconcile an optimistic row without a second query. */
  payment: StorePaymentListRow;
};

type CreateStorePaymentFailure = {
  ok: false;
  error: CreateStorePaymentError;
  orderId?: string;
  orderItemId?: string;
};

export type CreateStorePaymentResult =
  (CreateStorePaymentSuccess & { progression: ProgressionDelta | null }) | CreateStorePaymentFailure;

/**
 * What the in-transaction writer returns: the raw credit count rather than a settled delta.
 *
 * The two are deliberately different types. Turning a count into a delta means re-deriving the
 * progress cache, and that must happen only once the transaction has committed — a caller that runs
 * this inside a larger money transaction (the settlement path) has no business writing a per-user
 * cache row into it.
 */
export type CreateStorePaymentTxResult =
  (CreateStorePaymentSuccess & { credited: CreditOutcome }) | CreateStorePaymentFailure;

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

  // The canonical net open balance per order (BR-05-32, ADR 0034 §3.1): totalCost minus allocations
  // minus any StoreAccountAdjustmentLine written against it. One batched read for the whole set of
  // targeted orders, so migrating this ceiling never turns one query into N. Read here, before the
  // first write, so the refusal below can be decided ahead of it (ADR 0022).
  const openBalanceByOrderId = await openBalanceMinorByOrderId(tx, userId, orders);

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
    // Net, not gross (BR-05-32, ADR 0034 §3.1): the open balance already has any written-off
    // `StoreAccountAdjustmentLine` amount subtracted, so this is the same ceiling with the third
    // term restored. The map always has an entry for this order: it was populated from `orders`,
    // the exact set `orderById` (and therefore `order`) was built from. A miss is a programming
    // error, not a figure to degrade to gross: a silent gross fallback would reopen the
    // double-payment hole this ceiling exists to close.
    const openBalance = openBalanceByOrderId.get(order.id);
    if (openBalance === undefined) {
      throw new Error(`openBalanceMinorByOrderId missing entry for order ${order.id}`);
    }
    if (pendingForOrder > openBalance) {
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
    /** See `CreateStorePaymentInput.settledByDeliveryId`. Undefined for every non-settlement caller. */
    settledByDeliveryId?: string;
    /**
     * Whether this store may credit progression at all, resolved by the caller from the store row it
     * already loaded. Threaded in as a boolean rather than re-queried here: this function receives a
     * `storeId` and deliberately never touches the `Store` table, so a third round trip just to
     * answer a question both callers already had the row for would be pure waste. Required, not
     * defaulted, so a new caller cannot silently credit a store it never checked.
     */
    creditEligibleStore: boolean;
  },
): Promise<{ paymentId: string; affectedOrderIds: string[]; credited: CreditOutcome }> {
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
      settledByDeliveryId: params.settledByDeliveryId ?? null,
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

  // After the allocation cache, never before: `order-settled` asks the predicate adapter whether the
  // order is fully covered, and the adapter reads the very figures the line above just refreshed.
  //
  // The credit lives inside this shared writer rather than at its two call sites so both the order's
  // initial advance and a standalone store payment credit identically, and so the idempotency key
  // (the order) still holds if the same order were somehow reached through both.
  const credited = await creditOrderPayment(tx, {
    userId: params.userId,
    storeId: params.storeId,
    orderIds: affectedOrderIds,
    storeCreditEligible: params.creditEligibleStore,
  });

  return { paymentId: payment.id, affectedOrderIds, credited };
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
 * The full body of {@link createStorePayment}'s transaction, extracted so a caller that already
 * owns a `Prisma.TransactionClient` (the settlement money transaction, `runOrderCloseMoneyTransaction`)
 * can run the exact same validated write inside its OWN `runSerializableTransaction`, sharing one
 * transaction with `consumeUnassignedStoreMoneyOnOrderClose` instead of opening a second one
 * (`FR-08-46`, `ADR 0032`'s "the money transaction's internal order is load-bearing").
 *
 * Every refusal here is still decided before the first write (`ADR 0022`); this function throws
 * exactly one sentinel (`DeclaredItemsRollback`) for the one refusal that cannot be hoisted, and it
 * is the CALLER's responsibility to catch it around its own `$transaction` call, exactly as
 * {@link createStorePayment} does below. A caller that forgets to catch it lets a genuine rollback
 * surface as an unhandled rejection instead of the `ITEM_ORDER_MISMATCH` result, which is a bug in
 * the caller, not a silent miscount: nothing here is written past the sentinel's throw.
 */
export async function createStorePaymentInTx(
  tx: Prisma.TransactionClient,
  input: CreateStorePaymentInput,
): Promise<CreateStorePaymentTxResult> {
  const { userId, storeId, amount, paymentDate, note = null, allocations = [], declarePaidItemIds = [] } = input;

  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_PAYMENT_AMOUNT) {
    return { ok: false, error: "AMOUNT_INVALID" };
  }

  // Widened past `id` for the progression credit gate, read inside this same transaction so a store
  // that lost its approval between page load and submission cannot mature a single point.
  const store = await tx.store.findFirst({
    where: { id: storeId },
    select: { id: true, ...STORE_CREDIT_ELIGIBILITY_SELECT },
  });
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

  // Store-level equality hardening (WO-09, ADR 0033 §5a): only `createStorePaymentAction` sets
  // `requireFullAllocation`. `addOrderPayment` and `createOrder`'s initial payment never set it,
  // so they keep seeing the plain `<=` rule checked just above.
  if (input.requireFullAllocation) {
    const parkedAmountMinor = input.parkedAmountMinor ?? 0;
    if (!isValidMinorAmount(parkedAmountMinor)) {
      return { ok: false, error: "AMOUNT_INVALID" };
    }
    const declaredTotal = allocationTotal + parkedAmountMinor;
    // Overshoot deliberately reuses ALLOCATION_SUM_EXCEEDS_PAYMENT rather than a distinct code:
    // "allocations alone exceed the payment" (refused above) and "allocations plus the parked
    // slice exceed it" are the same claim-too-much shape from the collector's perspective.
    if (declaredTotal > amount) {
      return { ok: false, error: "ALLOCATION_SUM_EXCEEDS_PAYMENT" };
    }
    if (declaredTotal < amount) {
      return { ok: false, error: "ALLOCATION_SUM_BELOW_PAYMENT" };
    }
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

  // A payment in the collector's base currency never persists a rate — there is nothing to
  // convert — no matter what the caller passed (an FX pair inherited from a contaminated order,
  // or a stale client prefill). Foreign-currency payments keep the caller's pair verbatim: a
  // payment raised against one order inherits that order's FX shape as-is, including a base
  // code older than the current base, which correctly reads as still-unreconciled.
  const user = await tx.user.findUnique({ where: { id: userId }, select: { baseCurrencyCode: true } });
  const isBaseCurrencyPayment = user?.baseCurrencyCode != null && currencyCode === user.baseCurrencyCode;

  const written = await writeStorePaymentWithAllocations(tx, {
    userId,
    storeId,
    amount,
    paymentDate,
    currencyCode,
    note,
    exchangeRate: isBaseCurrencyPayment ? null : input.exchangeRate,
    exchangeRateBaseCode: isBaseCurrencyPayment ? null : input.exchangeRateBaseCode,
    allocations: validated.allocations,
    settledByDeliveryId: input.settledByDeliveryId,
    creditEligibleStore: isStoreCreditEligible(store),
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
    credited: written.credited,
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
}

/**
 * Records a payment to a store, with an optional declaration of what it covers.
 *
 * The payment is capped at the store's outstanding debt in that currency: paying more than is owed
 * is refused rather than absorbed as credit, because in practice it means the collector picked the
 * wrong store or the wrong amount, and a silent credit is far harder to notice than a refusal.
 *
 * Thin wrapper around {@link createStorePaymentInTx}: opens its own `runSerializableTransaction` and
 * maps the one sentinel that transaction can throw back to the same public result every caller
 * already handles. Every behaviour lives in the shared function above; this is purely the
 * standalone entry point for callers that do not already own a transaction.
 */
export async function createStorePayment(input: CreateStorePaymentInput): Promise<CreateStorePaymentResult> {
  const outcome = await runSerializableTransaction<CreateStorePaymentTxResult>((tx) =>
    createStorePaymentInTx(tx, input),
  ).catch((error: unknown) => {
    // Mapped back to a code the caller already handles, with no widened result type. Anything
    // else is a genuine failure and must keep propagating.
    if (error instanceof DeclaredItemsRollback) {
      return { ok: false, error: "ITEM_ORDER_MISMATCH" } satisfies CreateStorePaymentTxResult;
    }
    throw error;
  });

  if (!outcome.ok) {
    return outcome;
  }

  // The progress cache is re-derived only now, once the serializable money transaction has
  // committed. Folding a per-user row into that transaction would add a write-write conflict
  // surface the payment path does not have today, for a figure that is rebuildable by definition.
  const { credited, ...success } = outcome;
  return { ...success, progression: await settleProgression(input.userId, credited) };
}

/** The fields {@link consumeUnassignedStoreMoneyOnOrderClose} needs off the closing order. */
type OrderForConsumption = {
  id: string;
  storeId: string;
  currencyCode: string;
  totalCost: number;
  allocatedAmountMinor: number;
  store: StoreEligibilityRow | null;
};

/**
 * Applies `min(order's own remaining balance, unassigned store money)` to an order the moment it
 * closes (BR-05-28, ADR 0033 §4). Unconditional: it never waits on the confirmation courtesy dialog
 * owned by whichever surface triggers the close, and it has no skip parameter, because skipping
 * changes nothing about what gets written.
 *
 * Runs on the CALLER's transaction (never opens its own): the caller already resolved the order and
 * is expected to invoke this at the moment its derived status becomes `COMPLETED`, inside the same
 * `runSerializableTransaction` that write belongs to. Serializable isolation is what keeps two
 * concurrent closes of the same store/currency pool from double-spending it; this function performs
 * no isolation of its own.
 *
 * Has no refusal branch to decide late (Validation Contract): `min(remaining, pool)` cannot exceed
 * `remaining` by construction, so nothing here can violate `EXCEEDS_BALANCE`. It never writes or
 * touches a `StoreAccountAdjustmentLine`.
 *
 * `deliveryId` stamps every `PaymentAllocation` this call writes with `consumedByDeliveryId`
 * (provenance only, WO-08 UX Notes "known gap" closure): the delivery whose arrival closed the
 * order and triggered this consumption. Pass `null` for a caller with no delivery in scope (there
 * is none today, but the parameter stays required rather than defaulted so a future caller cannot
 * silently forget to thread it, the same Validation Contract this function already follows for its
 * other decisions). Reopening that delivery later must never delete or alter the stamped row (see
 * `reopenDelivery`); the stamp is provenance, not a claim, and outlives the delivery that produced
 * it (`onDelete: SetNull` on the schema relation) if the delivery itself is ever removed.
 *
 * Returns the minor amount actually consumed (0 when there is nothing to do).
 */
export async function consumeUnassignedStoreMoneyOnOrderClose(
  tx: Prisma.TransactionClient,
  userId: string,
  orderId: string,
  deliveryId: string | null,
): Promise<number> {
  // Defensive no-op: this runs at the moment the caller's own status derivation just resolved the
  // order, so an absent row can only mean a concurrent deletion of an order that no longer exists to
  // consume money into.
  const order: OrderForConsumption | null = await tx.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      storeId: true,
      currencyCode: true,
      totalCost: true,
      allocatedAmountMinor: true,
      store: { select: STORE_CREDIT_ELIGIBILITY_SELECT },
    },
  });
  if (!order) return 0;

  // Canonical net balance (BR-05-32, ADR 0034), never the gross `totalCost - allocatedAmountMinor`:
  // an order a store reconciliation already wrote off in whole or in part must not have unassigned
  // money land on top of a balance that no longer exists (WO-09's own written-off numeric example).
  const remaining = await openBalanceMinor(tx, userId, order);
  if (remaining <= 0) return 0;

  // The one shared derivation of a payment's own remainder (`MINOR-5/6`), oldest `paymentDate`
  // first (tiebreak `id ASC`, matching the settle-on-arrival batch order, FR-08-45). Two bounded
  // queries regardless of how many payments exist, never N+1.
  const remainders = await getStorePaymentRemainders(tx, userId, order.storeId, order.currencyCode);
  if (remainders.length === 0) return 0;

  // The pool's true total, unclamped: a payment with a NEGATIVE remainder means more was declared
  // against it than it is worth, which can only happen if a ceiling elsewhere was already bypassed.
  // Consumption abstains entirely rather than draining the payments that still read positive and
  // silently clamping the deficit away — that clamp would spend money the store/currency pair does
  // not actually have. Same principle as `openOrderDebtMinor` itself (BR-05-32): the query layer
  // reports the true figure; only a write decision gets to filter it, and here the filter is "do
  // nothing" rather than "pretend it's zero".
  const totalRemainderMinor = remainders.reduce((sum, remainder) => sum + remainder.remainderMinor, 0);
  if (totalRemainderMinor <= 0) return 0;

  let stillNeeded = Math.min(remaining, totalRemainderMinor);
  const contributions: Array<{ paymentId: string; amountMinor: number }> = [];
  for (const remainder of remainders) {
    if (stillNeeded <= 0) break;
    if (remainder.remainderMinor <= 0) continue;
    const contribution = Math.min(remainder.remainderMinor, stillNeeded);
    contributions.push({ paymentId: remainder.paymentId, amountMinor: contribution });
    stillNeeded -= contribution;
  }

  // No unassigned money anywhere in this (storeId, currencyCode): a true no-op, nothing written.
  if (contributions.length === 0) return 0;

  // One PaymentAllocation per contributing payment, `orderItemId: null`: the same shape "on
  // account" allocations already use today. No schema migration needed.
  await tx.paymentAllocation.createMany({
    data: contributions.map((contribution) => ({
      paymentId: contribution.paymentId,
      orderId: order.id,
      orderItemId: null,
      userId,
      amountMinor: contribution.amountMinor,
      settlesTarget: false,
      consumedByDeliveryId: deliveryId,
    })),
  });

  await recalculateOrderAllocationCache(tx, [order.id], userId);

  // The second producer of `PaymentAllocation` rows, and therefore the second place an order can
  // first acquire declared money. Crediting only in `writeStorePaymentWithAllocations` would leave
  // an order funded entirely by money already sitting at the store permanently uncredited, since
  // nothing would ever append the entry the recompute later re-derives eligibility for.
  //
  // The delta is deliberately not reported back: this runs inside the independent money transaction
  // that follows an arrival, whose result shape belongs to the settlement flow. The entries exist
  // from here on and the next recompute matures them.
  await creditOrderPayment(tx, {
    userId,
    storeId: order.storeId,
    orderIds: [order.id],
    storeCreditEligible: isStoreCreditEligible(order.store),
  });

  return contributions.reduce((sum, contribution) => sum + contribution.amountMinor, 0);
}

/**
 * Settlement on arrival (`WO-08`, `ADR 0032`, `ADR 0034`).
 *
 * `resolveSettlementPlan` decides HOW MUCH a delivery's settlement should write and in what shape,
 * without writing anything itself. `runOrderCloseMoneyTransaction` is the one call site that
 * actually writes it, scoped to orders a delivery just closed to `COMPLETED` (`FR-08-46`).
 */

/** One per-product line the resolver could attribute, before it is written as a `PaymentAllocation`. */
export type SettlementItemLine = { orderItemId: string; amountMinor: number };

/** Why the partial branch could not auto-compute an amount (`FR-08-40`). */
export type SettlementManualReasonCode =
  /** A delivered item carries no `unitPrice`. */
  | "missingPrice"
  /** The order already carries an `orderItemId IS NULL` allocation (undetailed money). */
  | "undetailedMoney";

/**
 * The settlement-plan resolver's verdict for one order. Every non-`nothingToSettle` variant carries
 * `coveredItemIds`: the products this settlement covers, fed straight to `declarePaidItemIds`
 * (`ADR 0026`, moves no money on its own) regardless of which branch produced the plan.
 */
export type SettlementPlan =
  /** `openBalanceMinor(order)` is already 0: no checkbox renders, nothing gets written. */
  | { kind: "nothingToSettle" }
  /** Every product of the order is DELIVERED. Amount is always the order's own open balance. */
  | { kind: "computedFull"; amountMinor: number; coveredItemIds: string[] }
  /**
   * Some products remain undelivered. Both auto-compute conditions held, and the per-item sum
   * did not need capping: `itemLines` is exactly what gets written, one allocation per product.
   */
  | {
      kind: "computedPartial";
      amountMinor: number;
      undetailed: false;
      itemLines: SettlementItemLine[];
      coveredItemIds: string[];
    }
  /**
   * Same as above, except `openBalanceMinor(order)` capped the naive per-item sum (a
   * `StoreAccountAdjustmentLine` the per-item formula cannot see). The cap forces one undetailed
   * allocation instead of the per-item lines (`BR-08-15`/`BR-08-16`: no proportional scaling).
   */
  | { kind: "computedPartial"; amountMinor: number; undetailed: true; itemLines: null; coveredItemIds: string[] }
  /**
   * Auto-compute could not run. `referenceAmountMinor` (`openBalanceMinor(order)`) is
   * reference-only, never the write value: the collector types the actual amount.
   */
  | { kind: "manual"; reasonCode: SettlementManualReasonCode; referenceAmountMinor: number; coveredItemIds: string[] };

export type ResolveSettlementPlanInput = {
  orderId: string;
  /**
   * The products THIS delivery event delivered (the copy's "productos que estás recibiendo").
   * Feeds the partial branch's per-item base computation and `coveredItemIds`. Ignored on the
   * full-order branch, whose `coveredItemIds` is every product of the order instead, since the
   * whole order is what closes there.
   */
  deliveredItemIds: string[];
};

/** The fields {@link resolveSettlementPlan} needs off the order it is resolving. */
type OrderForSettlementPlan = {
  id: string;
  totalCost: number;
  allocatedAmountMinor: number;
  items: Array<{ id: string; unitPrice: number | null; quantity: number; deliveryState: OrderItemDeliveryState }>;
};

/**
 * Resolves what a delivery's settlement should write for one order, per `FR-08-40`'s two branches,
 * without writing anything. Pure decision, read-only: safe to call from either a caller that is
 * about to write (`runOrderCloseMoneyTransaction`) or one that only wants to render a reference
 * figure (`QuickArrivalModal`'s preview), and safe to re-run on every `Retry` since it always reads
 * current state rather than trusting a client-held figure.
 *
 * Branch selection is NOT a caller flag: it is read directly off the order. Every product
 * `DELIVERED` (which is what an order closing to `COMPLETED` always means, `deriveOrderStatus`)
 * takes the full-order branch; anything else takes the partial branch, scored against
 * `deliveredItemIds` only.
 */
export async function resolveSettlementPlan(
  db: Prisma.TransactionClient,
  userId: string,
  input: ResolveSettlementPlanInput,
): Promise<SettlementPlan> {
  const { orderId, deliveredItemIds } = input;

  const order: OrderForSettlementPlan | null = await db.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      totalCost: true,
      allocatedAmountMinor: true,
      items: { select: { id: true, unitPrice: true, quantity: true, deliveryState: true } },
    },
  });
  // Defensive no-op, mirroring `consumeUnassignedStoreMoneyOnOrderClose`: reachable only if the
  // order was concurrently deleted between the caller's own read and this one.
  if (!order) return { kind: "nothingToSettle" };

  // Canonical net balance (BR-05-32, ADR 0034), never the gross `totalCost - allocatedAmountMinor`:
  // an order a store reconciliation already wrote off has nothing left to re-offer as a settlement.
  const openBalance = await openBalanceMinor(db, userId, order);
  if (openBalance <= 0) return { kind: "nothingToSettle" };

  const isFullyDelivered =
    order.items.length > 0 && order.items.every((item) => item.deliveryState === OrderItemDeliveryState.DELIVERED);

  if (isFullyDelivered) {
    return {
      kind: "computedFull",
      amountMinor: openBalance,
      coveredItemIds: order.items.map((item) => item.id),
    };
  }

  const deliveredItemIdSet = new Set(deliveredItemIds);
  const deliveredItems = order.items.filter((item) => deliveredItemIdSet.has(item.id));
  const coveredItemIds = deliveredItems.map((item) => item.id);

  // Condition (a): every delivered item must carry a non-null unitPrice.
  const hasMissingPrice = deliveredItems.some((item) => item.unitPrice === null);
  if (hasMissingPrice) {
    return { kind: "manual", reasonCode: "missingPrice", referenceAmountMinor: openBalance, coveredItemIds };
  }

  // Condition (b): the order must carry no undetailed (orderItemId IS NULL) allocation. `userId`
  // named in the where (consistency with `data-layer-user-id-duplication.mdc`), even though `orderId`
  // was already resolved against this same caller a few lines up: defense in depth, not a new refusal.
  const undetailedAllocation = await db.paymentAllocation.findFirst({
    where: { orderId, orderItemId: null, userId },
    select: { id: true },
  });
  if (undetailedAllocation) {
    return { kind: "manual", reasonCode: "undetailedMoney", referenceAmountMinor: openBalance, coveredItemIds };
  }

  // Money already declared against each delivered item, so the per-item sum subtracts what earlier
  // payments already put there rather than double-counting it.
  const allocatedByItemId = new Map<string, number>();
  if (coveredItemIds.length > 0) {
    const groups = await db.paymentAllocation.groupBy({
      by: ["orderItemId"],
      where: { orderItemId: { in: coveredItemIds }, userId },
      _sum: { amountMinor: true },
    });
    for (const group of groups) {
      if (group.orderItemId) allocatedByItemId.set(group.orderItemId, group._sum.amountMinor ?? 0);
    }
  }

  // Single-product order: totalCost IS that product's price, per `resolveItemAllocationBase`'s own
  // rule. Multi-product: unitPrice * quantity.
  const isSingleProductOrder = order.items.length === 1;
  const itemLines: SettlementItemLine[] = [];
  let computedSum = 0;
  for (const item of deliveredItems) {
    const base = isSingleProductOrder ? order.totalCost : (item.unitPrice as number) * item.quantity;
    const alreadyAllocated = allocatedByItemId.get(item.id) ?? 0;
    const lineAmount = Math.max(0, base - alreadyAllocated);
    itemLines.push({ orderItemId: item.id, amountMinor: lineAmount });
    computedSum += lineAmount;
  }

  // Round-4 arbitration cap: the per-item formula cannot see a StoreAccountAdjustmentLine, written
  // per ORDER, never per item. When the cap actually bites, dropping to one undetailed allocation is
  // the only honest write: scaling the per-item lines down to fit would be the proportional estimate
  // BR-08-16 forbids in every branch, and once an order-level line forced the cap, the app can no
  // longer honestly say which item's own line shrank and by how much.
  const cappedAmount = Math.min(computedSum, openBalance);
  if (cappedAmount < computedSum) {
    return { kind: "computedPartial", amountMinor: cappedAmount, undetailed: true, itemLines: null, coveredItemIds };
  }
  return { kind: "computedPartial", amountMinor: cappedAmount, undetailed: false, itemLines, coveredItemIds };
}

/** Turns a resolved plan into the allocation lines `createStorePaymentInTx` should write. */
function settlementPlanToAllocations(
  plan: Exclude<SettlementPlan, { kind: "nothingToSettle" }>,
  orderId: string,
  manualAmountMinor: number | undefined,
): StorePaymentAllocationInput[] {
  if (plan.kind === "computedFull") {
    return [{ orderId, orderItemId: null, amountMinor: plan.amountMinor }];
  }
  if (plan.kind === "computedPartial") {
    if (plan.undetailed) return [{ orderId, orderItemId: null, amountMinor: plan.amountMinor }];
    return plan.itemLines.map((line) => ({ orderId, orderItemId: line.orderItemId, amountMinor: line.amountMinor }));
  }
  // manual: the collector's own typed figure, never the reference amount. Validated by
  // `createStorePaymentInTx`'s own EXCEEDS_BALANCE ceiling, not trusted here.
  return [{ orderId, orderItemId: null, amountMinor: manualAmountMinor ?? 0 }];
}

/** One order's settlement instruction for {@link runOrderCloseMoneyTransaction}. */
export type OrderCloseSettlementInput = {
  /** Whether the collector left "Ya pagué el resto" checked for this order. */
  enabled: boolean;
  /** Products THIS delivery delivered; see {@link ResolveSettlementPlanInput.deliveredItemIds}. */
  deliveredItemIds: string[];
  settlementDate: Date;
  /**
   * The collector's typed amount. Used ONLY when the freshly re-resolved plan is `manual`; ignored
   * otherwise, because the plan, not the client, decides the write's shape and figure
   * (Validation Contract: "the settlement amount is never accepted from the client").
   */
  manualAmountMinor?: number;
};

export type ClosedOrderInput = {
  orderId: string;
  /**
   * Whether THIS delivery event actually closed the order to `COMPLETED` (`FR-08-46`'s own
   * consumption gate). `true` for the ordinary full-arrival case: consumption runs. `false` for the
   * partial-arrival case (`FR-08-40`'s partial branch) — the order stayed open because this event only
   * delivered some of its products, so consumption below is SKIPPED entirely; settlement, if
   * `settlement.enabled`, still runs off the fresh, adjustment-aware plan (`resolveSettlementPlan`
   * itself is what tells full from partial, by reading the order's current delivery state). No
   * default: an omitted value is a compile error, not a silent "always closed" (Validation Contract).
   */
  closed: boolean;
  /** Omitted (or `enabled: false`) when the collector unchecked the settlement box for this order:
   *  when `closed` is true, consumption below still runs regardless, only the settlement write is
   *  skipped. */
  settlement?: OrderCloseSettlementInput;
};

/**
 * One closed order's outcome from the money transaction.
 *
 * `status: "pending"` means this order was never attempted because an earlier order in the same
 * batch was refused: the caller's `Retry` re-invokes with the same (or a narrowed) `closedOrders`
 * list, and every order here is safe to reattempt because consumption is idempotent and settlement
 * always re-resolves from current state.
 */
export type OrderCloseMoneyOutcome =
  | { orderId: string; status: "settled"; consumedMinor: number; settledAmountMinor: number | null }
  | {
      orderId: string;
      status: "refused";
      consumedMinor: number;
      settledAmountMinor: null;
      error: CreateStorePaymentError;
    }
  | { orderId: string; status: "pending"; consumedMinor: null; settledAmountMinor: null };

/**
 * The order-close money transaction (`FR-08-46`, `ADR 0032`, `ADR 0033`): the call site for
 * `consumeUnassignedStoreMoneyOnOrderClose` and this slice's own settlement write.
 *
 * The two halves answer different questions and run on different gates. Consumption is the
 * order-CLOSE invariant (`FR-08-46`): it runs whenever `closedOrder.closed` is `true`, unconditionally
 * of whether the collector asked for a settlement, and never runs when `closed` is `false` (a partial
 * arrival that left the order open has nothing to close). Settlement follows `FR-08-40`'s two
 * branches instead, and runs for ANY entry with `settlement.enabled`, closed or not: the freshly
 * re-resolved plan (`resolveSettlementPlan`) is itself what tells a full-order close from a partial,
 * still-open one apart, by reading the order's current per-item delivery state rather than trusting
 * `closed` for that distinction.
 *
 * Attempted only once the delivery transaction (`createDelivery` / `markDeliveryDelivered`) has
 * already committed, and independent from it (`ADR 0032` §4): this function never touches
 * `Delivery` or `OrderItem.deliveryState`, only `StorePayment` / `PaymentAllocation` / the order's
 * own allocation cache.
 *
 * One `runSerializableTransaction` PER ORDER, not one for the whole batch: each order's consumption
 * and settlement commit (or refuse) together, but one order's outcome never rolls back another's
 * already-committed write. Orders are processed in the sequence the caller passes (`orderDate ASC,
 * humanReadableId ASC` for a store-scoped batch, `FR-08-45`); a store-scoped batch therefore drains
 * one shared unassigned pool deterministically, one order at a time.
 *
 * On the first refused order, processing STOPS: every following order in `closedOrders` is
 * reported `"pending"` rather than attempted. Consumption is idempotent and settlement always
 * re-resolves from fresh state, so a `Retry` that re-invokes this function (with the same or a
 * narrowed list) is always safe; nothing here is lost by stopping rather than skipping ahead. A
 * refusal here is a genuine data problem (e.g. a manual amount that no longer fits the balance) that
 * the collector should see and resolve before the rest of the batch is attempted.
 *
 * Never called from inside the delivery transaction, and never opens more than one transaction at a
 * time: safe to call from a Server Action that awaits each order's outcome before moving on.
 */
export async function runOrderCloseMoneyTransaction(input: {
  userId: string;
  deliveryId: string;
  closedOrders: ClosedOrderInput[];
}): Promise<OrderCloseMoneyOutcome[]> {
  const { userId, deliveryId, closedOrders } = input;
  const outcomes: OrderCloseMoneyOutcome[] = [];
  let stopped = false;

  for (const closedOrder of closedOrders) {
    if (stopped) {
      outcomes.push({ orderId: closedOrder.orderId, status: "pending", consumedMinor: null, settledAmountMinor: null });
      continue;
    }

    const outcome = await runSerializableTransaction<OrderCloseMoneyOutcome>(async (tx) => {
      // Gated on `closed` (FR-08-46's own consumption invariant), never unconditional: a partial
      // arrival that left the order OPEN (`closed: false`) has nothing to close, so consumption must
      // not run for it. When it does run, it runs BEFORE the settlement amount below is computed, so
      // the settlement never overstates what the order still owes (FR-08-46's own ordering
      // requirement).
      const consumedMinor = closedOrder.closed
        ? await consumeUnassignedStoreMoneyOnOrderClose(tx, userId, closedOrder.orderId, deliveryId)
        : 0;

      if (!closedOrder.settlement?.enabled) {
        return { orderId: closedOrder.orderId, status: "settled", consumedMinor, settledAmountMinor: null };
      }

      // Read fresh, never trusted from the delivery transaction's own snapshot (Technical Notes):
      // time can pass between the two, especially on Retry. Carries the order's own FX pair (F6,
      // 2026-08-20 review): a settlement StorePayment must inherit it exactly like `addOrderPayment`
      // does for a single-order payment (`orderPaymentMutations.ts`'s own inheritance comment).
      const orderRow = await tx.order.findFirst({
        where: { id: closedOrder.orderId, userId },
        select: { storeId: true, currencyCode: true, exchangeRate: true, exchangeRateBaseCode: true },
      });
      if (!orderRow) {
        return { orderId: closedOrder.orderId, status: "settled", consumedMinor, settledAmountMinor: null };
      }

      const plan = await resolveSettlementPlan(tx, userId, {
        orderId: closedOrder.orderId,
        deliveredItemIds: closedOrder.settlement.deliveredItemIds,
      });

      if (plan.kind === "nothingToSettle") {
        return { orderId: closedOrder.orderId, status: "settled", consumedMinor, settledAmountMinor: null };
      }

      const amountMinor = plan.kind === "manual" ? closedOrder.settlement.manualAmountMinor : plan.amountMinor;
      if (amountMinor === undefined) {
        // The plan asked the collector for a figure and the caller supplied none. Refused the same
        // way a malformed amount always is, rather than guessing or writing a zero payment.
        return {
          orderId: closedOrder.orderId,
          status: "refused",
          consumedMinor,
          settledAmountMinor: null,
          error: "AMOUNT_INVALID",
        };
      }

      const written = await createStorePaymentInTx(tx, {
        userId,
        storeId: orderRow.storeId,
        currencyCode: orderRow.currencyCode,
        amount: amountMinor,
        paymentDate: closedOrder.settlement.settlementDate,
        allocations: settlementPlanToAllocations(plan, closedOrder.orderId, closedOrder.settlement.manualAmountMinor),
        declarePaidItemIds: plan.coveredItemIds,
        settledByDeliveryId: deliveryId,
        // Inherited verbatim from the order (F6): `createStorePaymentInTx`'s own base-currency guard
        // still nulls this out when the settlement lands in the collector's base currency, exactly as
        // it does for every other caller.
        exchangeRate: orderRow.exchangeRate ? Number(orderRow.exchangeRate) : null,
        exchangeRateBaseCode: orderRow.exchangeRateBaseCode,
      });

      if (!written.ok) {
        return {
          orderId: closedOrder.orderId,
          status: "refused",
          consumedMinor,
          settledAmountMinor: null,
          error: written.error,
        };
      }

      return { orderId: closedOrder.orderId, status: "settled", consumedMinor, settledAmountMinor: amountMinor };
    }).catch((error: unknown) => {
      // `createStorePaymentInTx`'s one sentinel, mapped the same way `createStorePayment` maps it.
      // The whole transaction (including this order's own consumption) rolled back: an exceedingly
      // rare concurrent-delete race, safe to report as refused and safe to retry.
      if (error instanceof DeclaredItemsRollback) {
        return {
          orderId: closedOrder.orderId,
          status: "refused",
          consumedMinor: 0,
          settledAmountMinor: null,
          error: "ITEM_ORDER_MISMATCH",
        } satisfies OrderCloseMoneyOutcome;
      }
      throw error;
    });

    outcomes.push(outcome);
    if (outcome.status === "refused") stopped = true;
  }

  return outcomes;
}

/**
 * Restores settlement `StorePayment` rows a reopen deleted, verbatim (`FR-08-43`): same amount,
 * date, currency, allocations, and `settledByDeliveryId`. Never recomputes anything and never calls
 * {@link resolveSettlementPlan}, because the order's balance may have moved since the reopen (another
 * payment could have landed in the meantime); recomputing at that point could invent or lose money
 * relative to what was actually reverted.
 *
 * Restored rows get FRESH ids: nothing downstream keys off a `StorePayment` id surviving a
 * delete-then-restore round trip, and forcing the original id back would require carrying it as
 * writable input on a normally server-generated column for a one-off caller. Every other field is
 * exact.
 *
 * `snapshot` has no default: an omitted argument is a compile error, not a silent no-op restore
 * (Validation Contract: "missing argument is a compile error, not a runtime default").
 */
export type RestoreSettlementAllocationSnapshot = {
  orderId: string;
  orderItemId: string | null;
  amountMinor: number;
};

export type RestoreSettlementPaymentSnapshot = {
  storeId: string;
  amount: number;
  paymentDate: Date;
  currencyCode: string;
  note: string | null;
  /**
   * Serialized at the data-layer edge, never a raw `Prisma.Decimal`: the snapshot this comes from
   * (`RevertedStorePaymentSnapshot`, `deliveryMutations.ts`) carries a `Decimal` straight off the
   * reverted row, and a `Decimal` instance must not cross a Server Action boundary unserialized
   * (BLOCKER F6, 2026-08-20 review). The caller stringifies it once when it snapshots the reverted
   * row; `restoreSettlementPayments` parses it back to a plain number immediately before the write,
   * exactly like `addOrderPayment`'s own `Number(order.exchangeRate)` inheritance.
   */
  exchangeRate: string | null;
  exchangeRateBaseCode: string | null;
  settledByDeliveryId: string | null;
  allocations: RestoreSettlementAllocationSnapshot[];
};

export type RestoreSettlementPaymentsResult =
  { ok: true; paymentIds: string[]; affectedOrderIds: string[] } | { ok: false; error: "NOT_FOUND" };

/**
 * Restores settlement `StorePayment` rows a reopen deleted (see the module doc above). Every id the
 * snapshot names is resolved against the caller BEFORE the first write (ADR 0022): the delivery
 * (`settledByDeliveryId`), every allocated order, every allocated order ITEM (which must belong to
 * the same order its own allocation names), and every store (which must be the store every one of
 * its allocated orders actually belongs to). A miss anywhere refuses the whole batch `NOT_FOUND`
 * rather than restoring a partial, inconsistent set of rows.
 *
 * This is the one write path in this module that trusted a client-supplied snapshot with NO ownership
 * verification at all (BLOCKER F2, 2026-08-20 adversarial review): a crafted snapshot naming another
 * collector's order, item, delivery, or store used to be written verbatim.
 */
export async function restoreSettlementPayments(input: {
  userId: string;
  snapshot: RestoreSettlementPaymentSnapshot[];
}): Promise<RestoreSettlementPaymentsResult> {
  const { userId, snapshot } = input;

  return runSerializableTransaction<RestoreSettlementPaymentsResult>(async (tx) => {
    if (snapshot.length === 0) {
      return { ok: true, paymentIds: [], affectedOrderIds: [] };
    }

    // Every id the snapshot names, resolved against the caller before the first write (ADR 0022).
    const deliveryIds = [
      ...new Set(
        snapshot
          .map((paymentSnapshot) => paymentSnapshot.settledByDeliveryId)
          .filter((id): id is string => id !== null),
      ),
    ];
    if (deliveryIds.length > 0) {
      const deliveries = await tx.delivery.findMany({
        where: { id: { in: deliveryIds }, userId },
        select: { id: true },
      });
      if (deliveries.length !== deliveryIds.length) return { ok: false, error: "NOT_FOUND" };
    }

    const storeIds = [...new Set(snapshot.map((paymentSnapshot) => paymentSnapshot.storeId))];
    const stores = await tx.store.findMany({ where: { id: { in: storeIds } }, select: { id: true } });
    if (stores.length !== storeIds.length) return { ok: false, error: "NOT_FOUND" };

    const orderIds = [
      ...new Set(snapshot.flatMap((paymentSnapshot) => paymentSnapshot.allocations.map((a) => a.orderId))),
    ];
    const orders =
      orderIds.length > 0
        ? await tx.order.findMany({ where: { id: { in: orderIds }, userId }, select: { id: true, storeId: true } })
        : [];
    const orderById = new Map(orders.map((order) => [order.id, order]));
    if (orderById.size !== orderIds.length) return { ok: false, error: "NOT_FOUND" };

    // Consistency: every allocated order must belong to the same store its own parent payment does.
    for (const paymentSnapshot of snapshot) {
      for (const allocation of paymentSnapshot.allocations) {
        const order = orderById.get(allocation.orderId);
        if (!order || order.storeId !== paymentSnapshot.storeId) return { ok: false, error: "NOT_FOUND" };
      }
    }

    const orderItemIds = [
      ...new Set(
        snapshot
          .flatMap((paymentSnapshot) => paymentSnapshot.allocations.map((a) => a.orderItemId))
          .filter((id): id is string => id !== null),
      ),
    ];
    if (orderItemIds.length > 0) {
      const items = await tx.orderItem.findMany({
        where: { id: { in: orderItemIds }, userId },
        select: { id: true, orderId: true },
      });
      const itemById = new Map(items.map((item) => [item.id, item]));
      if (itemById.size !== orderItemIds.length) return { ok: false, error: "NOT_FOUND" };

      for (const paymentSnapshot of snapshot) {
        for (const allocation of paymentSnapshot.allocations) {
          if (allocation.orderItemId === null) continue;
          const item = itemById.get(allocation.orderItemId);
          if (!item || item.orderId !== allocation.orderId) return { ok: false, error: "NOT_FOUND" };
        }
      }
    }

    // Every id checked out: proceed with the verbatim restore.
    const paymentIds: string[] = [];
    const affectedOrderIds = new Set<string>();

    for (const paymentSnapshot of snapshot) {
      const payment = await tx.storePayment.create({
        data: {
          storeId: paymentSnapshot.storeId,
          userId,
          amount: paymentSnapshot.amount,
          paymentDate: paymentSnapshot.paymentDate,
          currencyCode: paymentSnapshot.currencyCode,
          note: paymentSnapshot.note,
          exchangeRate: paymentSnapshot.exchangeRate === null ? null : Number(paymentSnapshot.exchangeRate),
          exchangeRateBaseCode: paymentSnapshot.exchangeRateBaseCode,
          settledByDeliveryId: paymentSnapshot.settledByDeliveryId,
        },
        select: { id: true },
      });
      paymentIds.push(payment.id);

      if (paymentSnapshot.allocations.length > 0) {
        await tx.paymentAllocation.createMany({
          data: paymentSnapshot.allocations.map((allocation) => ({
            paymentId: payment.id,
            orderId: allocation.orderId,
            orderItemId: allocation.orderItemId,
            userId,
            amountMinor: allocation.amountMinor,
            settlesTarget: false,
          })),
        });
        for (const allocation of paymentSnapshot.allocations) affectedOrderIds.add(allocation.orderId);
      }
    }

    await recalculateOrderAllocationCache(tx, [...affectedOrderIds], userId);

    return { ok: true, paymentIds, affectedOrderIds: [...affectedOrderIds] };
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
