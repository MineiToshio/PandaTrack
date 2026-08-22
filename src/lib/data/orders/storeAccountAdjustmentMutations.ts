import { OrderStatus } from "../../../../generated/prisma/client";
import { isAllowedCollectorBaseCurrency } from "@/lib/catalog/collectorCountries";
import { resolveTodayStart } from "@/lib/notifications/reminderWindows";
import { MAX_PAYMENT_AMOUNT } from "@/lib/orders/orderValidation";
import { openBalanceMinorByOrderId, type OrderOpenBalanceInput } from "./orderOpenBalance";
import { runSerializableTransaction } from "./serializableTransaction";
import { getUnassignedStoreMoneyMinor } from "./storePaymentQueries";

/**
 * The "cuadrar cuenta" (reconcile account) write path (WO-11, ADR 0034).
 *
 * A reconciliation adjustment is a store-level statement that some balance the app believes is
 * owed is not, in fact, owed: "I owe LESS than the app thinks" (ADR 0034 §5), never the reverse.
 * It is its own model, never a `StorePayment` wearing a costume (ADR 0034 §2): no allocation row is
 * ever written here, `Order.allocatedAmountMinor` is never touched, and the adjustment's own
 * magnitude is never stored, only derived from its lines at read time (`WO-10`).
 *
 * Every refusal is decided before the first write, inside `runSerializableTransaction`, per
 * ADR 0022: the whole declaration is accepted or rejected atomically, so a valid line can never be
 * written beside a rejected one.
 */

/** One line of the declaration: the balance written off on one order. */
export type CreateStoreAccountAdjustmentLineInput = {
  orderId: string;
  amountMinor: number;
};

export type CreateStoreAccountAdjustmentInput = {
  userId: string;
  storeId: string;
  currencyCode: string;
  reason: string;
  lines: CreateStoreAccountAdjustmentLineInput[];
  // Deliberately NO `adjustmentDate` field, and no total field. `adjustmentDate` is always the
  // write's own server time (BR-05-29, "never rewrites the past"); a client that sent one would
  // have nothing to bind it to, because the type itself carries no such property. The header's
  // magnitude is derived from its lines at read time and is never a field either (WO-10, ADR 0034
  // §5): there is no total for a caller to send and none for the server to reconcile against.
};

export type CreateStoreAccountAdjustmentError =
  | "NOT_FOUND"
  | "CURRENCY_INVALID"
  | "REASON_REQUIRED"
  | "NO_ADJUSTMENT_NEEDED"
  | "DUPLICATE_ORDER_LINE"
  | "AMOUNT_INVALID"
  | "STORE_HAS_UNASSIGNED_MONEY"
  | "ORDER_CANCELLED"
  | "ADJUSTMENT_EXCEEDS_ORDER_BALANCE";

export type CreateStoreAccountAdjustmentResult =
  { ok: true; adjustmentId: string } | { ok: false; error: CreateStoreAccountAdjustmentError; orderId?: string };

export type DeleteStoreAccountAdjustmentInput = {
  userId: string;
  adjustmentId: string;
};

export type DeleteStoreAccountAdjustmentResult = { ok: true } | { ok: false; error: "NOT_FOUND" };

/** The order fields a line's own ceiling needs, resolved by `{ id, userId, storeId, currencyCode }`. */
type OrderForAdjustmentLine = OrderOpenBalanceInput & { status: OrderStatus };

function isPositiveIntegerAmount(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= MAX_PAYMENT_AMOUNT;
}

/**
 * Records a "cuadrar cuenta" declaration: one `StoreAccountAdjustment` header plus one
 * `StoreAccountAdjustmentLine` per entry of `lines`, written atomically.
 *
 * Refusal order matches the Validation Contract (WO-11) exactly, and every one of them is decided
 * before `storeAccountAdjustment.create`, the first write in this function:
 *
 *  1. the store exists                                              → `NOT_FOUND`
 *  2. `currencyCode` is in the allowed set                          → `CURRENCY_INVALID`
 *  3. `reason` is non-empty after trim                               → `REASON_REQUIRED`
 *  4. at least one line is declared                                 → `NO_ADJUSTMENT_NEEDED`
 *  5. no order is named twice in this declaration                   → `DUPLICATE_ORDER_LINE`
 *  6. every line's `amountMinor` is a positive integer               → `AMOUNT_INVALID`
 *  7. the store holds no parked money in this currency (`FR-05-69`) → `STORE_HAS_UNASSIGNED_MONEY`
 *  8. every line's order resolves to this caller/store/currency     → `NOT_FOUND`
 *  9. every resolved order is not `CANCELLED`                       → `ORDER_CANCELLED`
 * 10. every line is within its own order's `openBalanceMinor`       → `ADJUSTMENT_EXCEEDS_ORDER_BALANCE`
 */
export async function createStoreAccountAdjustment(
  input: CreateStoreAccountAdjustmentInput,
): Promise<CreateStoreAccountAdjustmentResult> {
  const { userId, storeId, currencyCode, reason: rawReason, lines } = input;

  return runSerializableTransaction<CreateStoreAccountAdjustmentResult>(async (tx) => {
    // 1. The store belongs to the caller. `Store` carries no per-collector ownership field (it is a
    // shared catalog entity, `createdByUserId` is whoever first listed it, not "my store"), so this
    // mirrors the existence-only check every other write in this domain uses
    // (`createStorePayment`, `createOrder`/`editOrder`).
    const store = await tx.store.findFirst({ where: { id: storeId }, select: { id: true } });
    if (!store) {
      return { ok: false, error: "NOT_FOUND" };
    }

    // 2. currencyCode must be one of the allowed collector currencies.
    if (!isAllowedCollectorBaseCurrency(currencyCode)) {
      return { ok: false, error: "CURRENCY_INVALID" };
    }

    // 3. reason is a non-empty declared string ("no identificado" is a legitimate answer, an empty
    // string is not).
    const reason = rawReason.trim();
    if (reason.length === 0) {
      return { ok: false, error: "REASON_REQUIRED" };
    }

    // 4. The app never derives the lines itself (ADR 0025, ADR 0028): a declaration with no line is
    // refused rather than spread across the store's orders.
    if (lines.length === 0) {
      return { ok: false, error: "NO_ADJUSTMENT_NEEDED" };
    }

    // 5. No order named twice in one declaration. The `@@unique([adjustmentId, orderId])`
    // constraint is the backstop; this is the pre-write refusal for the common case.
    const orderIds = lines.map((line) => line.orderId);
    if (new Set(orderIds).size !== orderIds.length) {
      return { ok: false, error: "DUPLICATE_ORDER_LINE" };
    }

    // 6. Every line's amountMinor is a positive integer, declared by this model rather than
    // inherited from `StorePayment` (ADR 0034 §5): the one-way direction ("I owe LESS") has no
    // field able to express the opposite one.
    if (lines.some((line) => !isPositiveIntegerAmount(line.amountMinor))) {
      return { ok: false, error: "AMOUNT_INVALID" };
    }

    // 7. The store must hold NO parked money in this currency (FR-05-69, ADR 0034 §6). Refusing
    // (rather than netting the pool out of each line's ceiling) is the chosen form: netting would
    // require guessing which order the pool belongs to, the exact attribution ADR 0025/ADR 0028
    // forbid. A NEGATIVE pool is a corruption signal elsewhere (a ceiling bypassed upstream), not
    // something this write can double-subtract by proceeding, so only a strictly positive pool
    // refuses here.
    const unassignedMinor = await getUnassignedStoreMoneyMinor(tx, userId, storeId, currencyCode);
    if (unassignedMinor > 0) {
      return { ok: false, error: "STORE_HAS_UNASSIGNED_MONEY" };
    }

    // 8. Every line's order must resolve to this caller, this store and this currency, in ONE
    // `findMany`. An order that does not resolve is `NOT_FOUND`, indistinguishable from one that
    // does not exist (Security Notes): no `orderId` is echoed back for this branch.
    const resolvedOrders = await tx.order.findMany({
      where: { id: { in: orderIds }, userId, storeId, currencyCode },
      select: { id: true, status: true, totalCost: true, allocatedAmountMinor: true },
    });
    const orderById = new Map<string, OrderForAdjustmentLine>(resolvedOrders.map((order) => [order.id, order]));
    if (orderById.size !== new Set(orderIds).size) {
      return { ok: false, error: "NOT_FOUND" };
    }

    // 9. The one status still refused is CANCELLED (reused, not a new code): a cancelled order's
    // committed total is already outside both debt figures, so a line against it would write off a
    // balance nothing was counting. COMPLETED orders are accepted, deliberately: they are the whole
    // back-catalogue this feature exists to seal.
    for (const orderId of orderIds) {
      const order = orderById.get(orderId);
      if (order?.status === OrderStatus.CANCELLED) {
        return { ok: false, error: "ORDER_CANCELLED", orderId };
      }
    }

    // 10. Every line within its own order's canonical `openBalanceMinor` (BR-05-32), recomputed
    // server-side and already net of every earlier declaration's lines. Batched: one query for the
    // whole set of targeted orders, not one per line.
    const openBalanceByOrderId = await openBalanceMinorByOrderId(tx, userId, resolvedOrders);
    for (const line of lines) {
      const openBalance = openBalanceByOrderId.get(line.orderId);
      if (openBalance === undefined) {
        throw new Error(`openBalanceMinorByOrderId missing entry for order ${line.orderId}`);
      }
      if (line.amountMinor > openBalance) {
        return { ok: false, error: "ADJUSTMENT_EXCEEDS_ORDER_BALANCE", orderId: line.orderId };
      }
    }

    // Every refusal has been decided. The write: one header, forced to today server-side regardless
    // of any client input (BR-05-29), plus one line per entry of `lines`, each duplicating `userId`
    // off the header it belongs to (data-layer-user-id-duplication.mdc).
    //
    // "Today" is the collector's own civil day, not the wall-clock instant `new Date()` reads
    // (`resolveTodayStart`, mirroring `orderQueries.ts`'s own `getTodayStart` call site): at 21:00 in
    // Lima a raw `new Date()` already reads tomorrow's UTC date, which would backdate every adjustment
    // made after dinner by a full day relative to the collector's own calendar.
    const user = await tx.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const adjustmentDate = resolveTodayStart(new Date(), user?.timezone);

    const adjustment = await tx.storeAccountAdjustment.create({
      data: { storeId, userId, currencyCode, adjustmentDate, reason },
      select: { id: true },
    });

    await tx.storeAccountAdjustmentLine.createMany({
      data: lines.map((line) => ({
        adjustmentId: adjustment.id,
        orderId: line.orderId,
        userId,
        amountMinor: line.amountMinor,
      })),
    });

    return { ok: true, adjustmentId: adjustment.id };
  });
}

/**
 * Deletes a whole reconciliation adjustment: its header and every line it carries (cascading via
 * `onDelete: Cascade` on `StoreAccountAdjustmentLine.adjustmentId`).
 *
 * Nothing is reused from `deleteStorePayment` (WO-11's Assumptions): there is no allocation to
 * reverse and no `Order.allocatedAmountMinor` cache to rewrite, because a line was never one. This
 * touches no `StorePayment` and no `PaymentAllocation` row, and it recomputes nothing: both debt
 * figures are derived at read time, so deleting the rows that fed them is the whole recomputation.
 */
export async function deleteStoreAccountAdjustment(
  input: DeleteStoreAccountAdjustmentInput,
): Promise<DeleteStoreAccountAdjustmentResult> {
  const { userId, adjustmentId } = input;

  return runSerializableTransaction<DeleteStoreAccountAdjustmentResult>(async (tx) => {
    const adjustment = await tx.storeAccountAdjustment.findFirst({
      where: { id: adjustmentId, userId },
      select: { id: true },
    });
    if (!adjustment) {
      return { ok: false, error: "NOT_FOUND" };
    }

    await tx.storeAccountAdjustment.delete({ where: { id: adjustment.id } });

    return { ok: true };
  });
}
