import { prisma } from "@/lib/prisma";
import { calculatePaymentSummary, type PaymentSummary } from "@/lib/orders/paymentSummary";
import { listOrderPaymentRecords, recalculateOrderAllocationCache } from "./orderPaymentAllocations";
import type { OrderPaymentRecord } from "./orderPaymentAllocations";
import { runSerializableTransaction } from "./serializableTransaction";
import {
  createStorePayment,
  type CreateStorePaymentError,
  type StorePaymentAllocationInput,
} from "./storePaymentMutations";

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

/** One product's share of the payment, as the order detail's breakdown declares it. */
export type OrderPaymentAllocationInput = {
  orderItemId: string;
  amountMinor: number;
};

type AddPaymentParams = {
  orderId: string;
  userId: string;
  amount: number;
  paymentDate: Date;
  /**
   * How much of this payment each product takes. Optional and normally absent: 85% of payments pay
   * a balance off in one go and name nothing. What is NOT here is the leftover: the part of the
   * payment that names no product is derived below, never accepted from the caller.
   */
  allocations?: OrderPaymentAllocationInput[];
};

type DeletePaymentParams = {
  /**
   * The payment to release from this order, which is the `id` an order's payment records carry.
   *
   * The unit is the pair (payment, order), not one allocation: a payment broken down across several
   * products of this order has N+1 of them, and removing one would leave the rest of the transfer
   * declared against an order the collector just said it does not belong to.
   */
  paymentId: string;
  orderId: string;
  userId: string;
};

/**
 * Why an order payment was refused.
 *
 * The three breakdown-specific codes are passed through rather than flattened, and that is what
 * lets the form point at the line the server actually objected to. Before the breakdown existed
 * they were unreachable from this door (the wrapper built exactly one whole-order allocation), so
 * collapsing `EXCEEDS_ITEM_BASE` into `EXCEEDS_BALANCE` cost nothing; now it would tell the
 * collector their payment exceeds the ORDER's balance when what it exceeds is one product's price.
 */
export type AddOrderPaymentError =
  | "ORDER_NOT_FOUND"
  | "EXCEEDS_BALANCE"
  | "DATE_BEFORE_ORDER"
  | "AMOUNT_FRACTIONAL_SUBUNITS"
  | "AMOUNT_INVALID"
  | "ORDER_CANCELLED"
  | "STORE_DEBT_EXCEEDED"
  | "ALLOCATION_SUM_EXCEEDS_PAYMENT"
  | "ALLOCATION_AMOUNT_INVALID"
  | "EXCEEDS_ITEM_BASE"
  | "ITEM_ORDER_MISMATCH";

type AddPaymentResult =
  | ({ ok: true; paymentId: string } & PaymentMutationSuccess)
  | {
      ok: false;
      error: AddOrderPaymentError;
      /**
       * The product the refusal is about, when it is about one. `createStorePayment` has always
       * returned it; this wrapper used to drop it on the floor, which left the form able to say
       * "some product got too much" and unable to say which. `orderId` is NOT propagated: on this
       * door it is always the order being paid, so it carries no information.
       */
      orderItemId?: string;
    };

type DeletePaymentResult =
  ({ ok: true; deletedPayment: boolean } & PaymentMutationSuccess) | { ok: false; error: "NOT_FOUND" };

/**
 * Maps a store-payment refusal onto the codes an order-scoped caller already handles.
 *
 * The wrapper builds its own input, so most of these are unreachable from it; they are mapped
 * exhaustively rather than defaulted so a new refusal code cannot slip through as a silent
 * success-shaped surprise.
 *
 * `STORE_DEBT_EXCEEDED` is passed through UNCHANGED. It used to collapse into `EXCEEDS_BALANCE`,
 * which made the collector read "the amount exceeds THIS ORDER's balance" when what actually
 * happened is that it exceeds what they still owe the STORE across every order of it. Two different
 * facts with two different next steps, and only one of them is about this order.
 *
 * The three breakdown codes are passed through for the same reason, now that a breakdown makes them
 * reachable: one says a product got more than its price allows, one says a line came out at zero,
 * one says a product is no longer part of this order. Three different next steps.
 */
function mapStorePaymentError(error: CreateStorePaymentError): AddOrderPaymentError {
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
      return "STORE_DEBT_EXCEEDED";
    case "ALLOCATION_SUM_EXCEEDS_PAYMENT":
      return "ALLOCATION_SUM_EXCEEDS_PAYMENT";
    // Unreachable from this door: `addOrderPayment` never sets `requireFullAllocation`, so
    // `createStorePayment` never has a reason to raise this against it (WO-09). Mapped rather than
    // left to fall through, so the switch stays exhaustive against `CreateStorePaymentError` and a
    // future caller of this wrapper that DID set the flag would still get a code the order-scoped
    // form already knows how to render, instead of a silent type error.
    case "ALLOCATION_SUM_BELOW_PAYMENT":
      return "ALLOCATION_SUM_EXCEEDS_PAYMENT";
    case "ALLOCATION_AMOUNT_INVALID":
      return "ALLOCATION_AMOUNT_INVALID";
    case "EXCEEDS_ITEM_BASE":
      return "EXCEEDS_ITEM_BASE";
    case "ITEM_ORDER_MISMATCH":
      return "ITEM_ORDER_MISMATCH";
    case "EXCEEDS_BALANCE":
      return "EXCEEDS_BALANCE";
    case "STORE_NOT_FOUND":
    case "CURRENCY_REQUIRED":
    case "CURRENCY_MISMATCH":
    case "STORE_MISMATCH":
    case "ORDER_NOT_FOUND":
    case "SETTLES_TARGET_UNSUPPORTED":
      return "ORDER_NOT_FOUND";
  }
}

/**
 * The declaration lines one order payment writes.
 *
 * With no breakdown it is the single line this function has always written: the whole payment
 * against the order, naming the product only when the order has exactly one and "for this order"
 * and "for that product" are therefore the same statement.
 *
 * With a breakdown it is the collector's lines PLUS the leftover, `amount - sum`, as one line
 * naming no product. That leftover is computed here rather than sent, so it cannot disagree with
 * the amount actually paid, and it is omitted when it is zero because a zero-amount declaration
 * covers nothing and the store mutation refuses it. A breakdown that overruns the payment produces
 * no leftover line and is refused there, before anything is written.
 */
function buildOrderPaymentAllocations(params: {
  orderId: string;
  amount: number;
  allocations: OrderPaymentAllocationInput[];
  singleItemId: string | null;
}): StorePaymentAllocationInput[] {
  const { orderId, amount, allocations, singleItemId } = params;
  if (allocations.length === 0) {
    return [{ orderId, orderItemId: singleItemId, amountMinor: amount }];
  }

  const declared: StorePaymentAllocationInput[] = allocations.map((allocation) => ({
    orderId,
    orderItemId: allocation.orderItemId,
    amountMinor: allocation.amountMinor,
  }));
  const residual = amount - declared.reduce((sum, line) => sum + line.amountMinor, 0);
  if (residual > 0) {
    declared.push({ orderId, orderItemId: null, amountMinor: residual });
  }
  return declared;
}

export async function addOrderPayment({
  orderId,
  userId,
  amount,
  paymentDate,
  allocations = [],
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
    allocations: buildOrderPaymentAllocations({ orderId, amount, allocations, singleItemId }),
  });

  if (!result.ok) {
    return { ok: false, error: mapStorePaymentError(result.error), orderItemId: result.orderItemId };
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
 * Removes a whole transfer's declaration from an order.
 *
 * This is the collector's ONLY correction path: an allocation is immutable once written, so fixing
 * a payment means deleting it and recording it again. The unit removed is therefore the order's
 * entire claim on that payment (every allocation of the pair), never one line of it: a payment
 * broken down across products has N+1 lines, and dropping one would leave the transfer half
 * attached to an order the collector just detached it from.
 *
 * A payment no other order claims is deleted outright, even when this order's claim was partial
 * (less than the payment's own amount): the UI has no other screen that can reach an
 * allocation-less `StorePayment` (the store detail "Pagos a esta tienda" list is the only other
 * door onto it, and it has its own delete action), so leaving one behind would strand it as a
 * payment nobody can act on again, still counting against the store's debt. A payment still shared
 * with another order survives and only loses this order's lines, which leaves it partly undeclared
 * rather than destroying money that is still explaining other orders.
 */
export async function deleteOrderPayment({
  paymentId,
  orderId,
  userId,
}: DeletePaymentParams): Promise<DeletePaymentResult> {
  return runSerializableTransaction<DeletePaymentResult>(async (tx) => {
    // Every line of this order's claim, not the first one. An empty result is the NOT_FOUND case,
    // and it also proves ownership: allocations carry the payment owner's `userId`.
    const claim = await tx.paymentAllocation.findMany({
      where: { paymentId, orderId, userId },
      select: { id: true },
    });

    if (claim.length === 0) {
      return { ok: false, error: "NOT_FOUND" };
    }

    const order = await tx.order.findFirst({ where: { id: orderId, userId }, select: { totalCost: true } });
    if (!order) {
      return { ok: false, error: "NOT_FOUND" };
    }

    const otherOrdersClaiming = await tx.paymentAllocation.count({
      where: { paymentId, userId, orderId: { not: orderId } },
    });

    // Deliberately NOT gated on the claim covering the payment's full amount: a partial claim that
    // is the payment's only one still leaves the rest of the payment (the unclaimed remainder) with
    // nothing pointing at it from this UI once the claim is gone — see the function doc above.
    const isSoleClaimOnPayment = otherOrdersClaiming === 0;

    if (isSoleClaimOnPayment) {
      // The cascade on `PaymentAllocation.paymentId` takes the claim with it.
      await tx.storePayment.delete({ where: { id: paymentId } });
    } else {
      await tx.paymentAllocation.deleteMany({ where: { paymentId, orderId, userId } });
    }

    await recalculateOrderAllocationCache(tx, [orderId], userId);

    const payments = await listOrderPaymentRecords(tx, orderId, userId);
    const summary = calculatePaymentSummary(order.totalCost, payments);

    return { ok: true, deletedPayment: isSoleClaimOnPayment, ...summary, payments };
  });
}
