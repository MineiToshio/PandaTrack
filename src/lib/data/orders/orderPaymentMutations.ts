import { prisma } from "@/lib/prisma";
import { calculatePaymentSummary, type PaymentSummary } from "@/lib/orders/paymentSummary";
import { listOrderPaymentRecords, recalculateOrderAllocationCache } from "./orderPaymentAllocations";
import type { OrderPaymentRecord } from "./orderPaymentAllocations";
import { runSerializableTransaction } from "./serializableTransaction";
import { createStorePayment, type CreateStorePaymentError } from "./storePaymentMutations";

/**
 * Order-scoped view of the payment ledger.
 *
 * Money is recorded at the store level (`storePaymentMutations`); these two functions are the
 * order's door into it, kept at their original names and signatures because every existing caller
 * (the detail screen, the image intake save action, the Notion importer) speaks in "a payment on
 * this order". Adding one here raises a store payment declared entirely against that order;
 * deleting one removes the declaration, and the payment itself only when nothing else claimed it.
 */

type PaymentMutationSuccess = PaymentSummary & {
  payments: OrderPaymentRecord[];
};

type AddPaymentParams = {
  orderId: string;
  userId: string;
  amount: number;
  paymentDate: Date;
};

type DeletePaymentParams = {
  /** The allocation to remove, which is the `id` an order's payment records carry. */
  allocationId: string;
  orderId: string;
  userId: string;
};

type AddPaymentResult =
  | ({ ok: true; paymentId: string } & PaymentMutationSuccess)
  | {
      ok: false;
      error:
        | "ORDER_NOT_FOUND"
        | "EXCEEDS_BALANCE"
        | "DATE_BEFORE_ORDER"
        | "AMOUNT_FRACTIONAL_SUBUNITS"
        | "AMOUNT_INVALID"
        | "ORDER_CANCELLED";
    };

type DeletePaymentResult =
  ({ ok: true; deletedPayment: boolean } & PaymentMutationSuccess) | { ok: false; error: "NOT_FOUND" };

/**
 * Maps a store-payment refusal onto the codes an order-scoped caller already handles.
 *
 * The wrapper builds its own input, so most of these are unreachable from it; they are mapped
 * exhaustively rather than defaulted so a new refusal code cannot slip through as a silent
 * success-shaped surprise. `STORE_DEBT_EXCEEDED` becomes `EXCEEDS_BALANCE`: from the order's point
 * of view the money did not fit, which is the same sentence the UI already knows how to say.
 */
function mapStorePaymentError(error: CreateStorePaymentError): Exclude<AddPaymentResult, { ok: true }>["error"] {
  switch (error) {
    case "AMOUNT_INVALID":
      return "AMOUNT_INVALID";
    case "AMOUNT_FRACTIONAL_SUBUNITS":
      return "AMOUNT_FRACTIONAL_SUBUNITS";
    case "DATE_BEFORE_ORDER":
      return "DATE_BEFORE_ORDER";
    case "ORDER_CANCELLED":
      return "ORDER_CANCELLED";
    case "STORE_DEBT_EXCEEDED":
    case "ALLOCATION_SUM_EXCEEDS_PAYMENT":
    case "EXCEEDS_BALANCE":
    case "EXCEEDS_ITEM_BASE":
      return "EXCEEDS_BALANCE";
    case "STORE_NOT_FOUND":
    case "CURRENCY_REQUIRED":
    case "CURRENCY_MISMATCH":
    case "STORE_MISMATCH":
    case "ORDER_NOT_FOUND":
    case "ITEM_ORDER_MISMATCH":
    case "ALLOCATION_AMOUNT_INVALID":
      return "ORDER_NOT_FOUND";
  }
}

export async function addOrderPayment({
  orderId,
  userId,
  amount,
  paymentDate,
}: AddPaymentParams): Promise<AddPaymentResult> {
  // Read outside the transaction only to shape the input: which store the money goes to, which
  // currency it is in, and whether the order is a single item (in which case "for this order" and
  // "for that item" are the same declaration, so the allocation can be that specific). Every one of
  // these values is re-read and re-validated inside `createStorePayment`.
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      storeId: true,
      currencyCode: true,
      exchangeRate: true,
      exchangeRateBaseCode: true,
      items: { select: { id: true } },
    },
  });

  if (!order) {
    return { ok: false, error: "ORDER_NOT_FOUND" };
  }

  const singleItemId = order.items.length === 1 ? order.items[0].id : null;

  const result = await createStorePayment({
    userId,
    storeId: order.storeId,
    amount,
    paymentDate,
    currencyCode: order.currencyCode,
    // A payment raised against exactly one order inherits that order's FX shape, so it can be
    // converted to the collector's base currency without a reconciliation pass of its own.
    exchangeRate: order.exchangeRate ? Number(order.exchangeRate) : null,
    exchangeRateBaseCode: order.exchangeRateBaseCode,
    allocations: [{ orderId, orderItemId: singleItemId, amountMinor: amount }],
  });

  if (!result.ok) {
    return { ok: false, error: mapStorePaymentError(result.error) };
  }

  const snapshot = result.affectedOrders.find((candidate) => candidate.orderId === orderId);
  if (!snapshot) {
    // The allocation named this order, so its snapshot is always present; treated as "gone" rather
    // than asserted, because a missing one can only mean the order disappeared under the write.
    return { ok: false, error: "ORDER_NOT_FOUND" };
  }

  const summary = calculatePaymentSummary(snapshot.totalCost, snapshot.payments);
  return { ok: true, paymentId: result.paymentId, ...summary, payments: snapshot.payments };
}

/**
 * Removes one payment declaration from an order.
 *
 * A payment whose only remaining allocation is the one being removed is deleted outright, even when
 * that allocation was a partial claim (less than the payment's own amount): the UI has no other
 * screen that can reach an allocation-less `StorePayment` (the store detail "Pagos a esta tienda"
 * list is the only other door onto it, and it has its own delete action), so leaving one behind here
 * would strand it as a payment nobody can act on again. A payment still shared with another order
 * survives and only loses this order's slice, which leaves it partly undeclared rather than
 * destroying money that is still explaining other orders.
 */
export async function deleteOrderPayment({
  allocationId,
  orderId,
  userId,
}: DeletePaymentParams): Promise<DeletePaymentResult> {
  return runSerializableTransaction<DeletePaymentResult>(async (tx) => {
    const allocation = await tx.paymentAllocation.findFirst({
      where: { id: allocationId, orderId, userId },
      select: {
        id: true,
        amountMinor: true,
        payment: { select: { id: true, amount: true, _count: { select: { allocations: true } } } },
      },
    });

    if (!allocation) {
      return { ok: false, error: "NOT_FOUND" };
    }

    const order = await tx.order.findFirst({ where: { id: orderId, userId }, select: { totalCost: true } });
    if (!order) {
      return { ok: false, error: "NOT_FOUND" };
    }

    // Deliberately NOT gated on `allocation.amountMinor === allocation.payment.amount`: a partial
    // allocation that happens to be the payment's only one still leaves the rest of the payment
    // (the unclaimed remainder) with nothing pointing at it from this UI once this allocation is
    // gone — see the function doc above.
    const isSoleClaimOnPayment = allocation.payment._count.allocations === 1;

    if (isSoleClaimOnPayment) {
      await tx.storePayment.delete({ where: { id: allocation.payment.id } });
    } else {
      await tx.paymentAllocation.delete({ where: { id: allocation.id } });
    }

    await recalculateOrderAllocationCache(tx, [orderId], userId);

    const payments = await listOrderPaymentRecords(tx, orderId, userId);
    const summary = calculatePaymentSummary(order.totalCost, payments);

    return { ok: true, deletedPayment: isSoleClaimOnPayment, ...summary, payments };
  });
}
