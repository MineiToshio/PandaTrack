/**
 * Pure client-side validation for the store payment sheet's "¿A qué va este pago?" declaration
 * list. Mirrors the server-side rules in `storePaymentMutations.ts` (`validateAllocations`) closely
 * enough that a submission built from a draft that passes here is only refused by the server in
 * exceptional, hard-to-predict cases (a concurrent write shrinking an order's balance mid-session).
 *
 * Money throughout is minor units (cents) of the payment's currency.
 */

/** One product's declaration line inside an order. */
export type SheetItemDraft = {
  itemId: string;
  /** `basePagableMinor - allocatedMinor` before this draft, or `null` when no base is known. */
  remainingBaseMinor: number | null;
  /** Amount typed against this item specifically. 0 when the collector has not touched it. */
  amountMinor: number;
  /** "Saldado" chip: declares the item covered without naming an amount. Valid at `amountMinor: 0`. */
  settled: boolean;
};

/** One order's declaration line, plus its own per-product breakdown. */
export type SheetOrderDraft = {
  orderId: string;
  /** This order's own remaining assignable balance (`totalCost - allocatedAmountMinor`), before this draft. */
  assignableMinor: number;
  /** Amount typed directly against the order, with no product named. 0 when untouched. */
  amountMinor: number;
  items: SheetItemDraft[];
};

export type StorePaymentSheetDraft = {
  /** The payment's total amount. 0 when the amount field is empty or unparsed. */
  paymentAmountMinor: number;
  /** The store's outstanding debt in the payment's currency. */
  debtMinor: number;
  orders: SheetOrderDraft[];
};

/** Everything declared against one order: its own line plus every product line under it. */
export function sumOrderDraft(order: SheetOrderDraft): number {
  return order.amountMinor + order.items.reduce((sum, item) => sum + item.amountMinor, 0);
}

/** Everything declared across every order in the draft — the number the payment amount caps. */
export function sumAllOrders(orders: SheetOrderDraft[]): number {
  return orders.reduce((sum, order) => sum + sumOrderDraft(order), 0);
}

/** "Sin asignar": what's left of the payment once every declaration line is accounted for. Never negative — an over-allocation is surfaced as an error, not a negative counter. */
export function computeUnallocatedMinor(draft: StorePaymentSheetDraft): number {
  return Math.max(0, draft.paymentAmountMinor - sumAllOrders(draft.orders));
}

/** True once this order's own declarations (its line + its products' lines) outrun its balance. */
export function isOrderOverAssignable(order: SheetOrderDraft): boolean {
  return sumOrderDraft(order) > order.assignableMinor;
}

/** True once a product's own declared amount outruns what's left of its price base. Unknown-base products never fail this check: nothing was recorded to refuse against. */
export function isItemOverRemainingBase(item: SheetItemDraft): boolean {
  if (item.remainingBaseMinor === null) return false;
  return item.amountMinor > item.remainingBaseMinor;
}

/** The payment itself may never exceed what the collector still owes the store. */
export function doesPaymentExceedDebt(paymentAmountMinor: number, debtMinor: number): boolean {
  return paymentAmountMinor > debtMinor;
}

/** The declared total may never exceed the amount actually being paid. */
export function doesAllocationSumExceedPayment(draft: StorePaymentSheetDraft): boolean {
  return sumAllOrders(draft.orders) > draft.paymentAmountMinor;
}

export type StorePaymentSheetValidation = {
  sumAllocatedMinor: number;
  unallocatedMinor: number;
  exceedsDebt: boolean;
  allocationExceedsAmount: boolean;
  /** ids of orders whose own declared total outran their assignable balance. */
  orderErrors: ReadonlySet<string>;
  /** ids of products whose own declared amount outran their remaining base. */
  itemErrors: ReadonlySet<string>;
  canSubmit: boolean;
};

/**
 * Runs every client-side rule against a draft and rolls the result into one object the sheet can
 * read directly: which fields to mark invalid, what banner to show, and whether the primary CTA
 * may be enabled. `canSubmit` requires a positive amount, a debt that covers it, an allocation sum
 * that fits inside it, and every order/item line inside its own ceiling.
 */
export function validateStorePaymentSheetDraft(draft: StorePaymentSheetDraft): StorePaymentSheetValidation {
  const sumAllocatedMinor = sumAllOrders(draft.orders);
  const orderErrors = new Set(draft.orders.filter(isOrderOverAssignable).map((order) => order.orderId));
  const itemErrors = new Set(
    draft.orders.flatMap((order) => order.items.filter(isItemOverRemainingBase).map((item) => item.itemId)),
  );
  const exceedsDebt = doesPaymentExceedDebt(draft.paymentAmountMinor, draft.debtMinor);
  const allocationExceedsAmount = doesAllocationSumExceedPayment(draft);
  const hasPositiveAmount = draft.paymentAmountMinor > 0;

  const canSubmit =
    hasPositiveAmount && !exceedsDebt && !allocationExceedsAmount && orderErrors.size === 0 && itemErrors.size === 0;

  return {
    sumAllocatedMinor,
    unallocatedMinor: Math.max(0, draft.paymentAmountMinor - sumAllocatedMinor),
    exceedsDebt,
    allocationExceedsAmount,
    orderErrors,
    itemErrors,
    canSubmit,
  };
}

/** One line of the mutation's `allocations` input, built from a draft's non-empty entries. */
export type BuiltAllocationInput = {
  orderId: string;
  orderItemId?: string;
  amountMinor: number;
  settlesTarget?: boolean;
};

/**
 * Turns a draft into the `allocations` array `createStorePayment` expects: one line per order with
 * a non-zero direct amount, plus one line per product that either has a non-zero amount or is
 * marked "Saldado" (a zero-amount `settlesTarget` line is meaningful on its own).
 */
export function buildAllocationInputs(orders: SheetOrderDraft[]): BuiltAllocationInput[] {
  const inputs: BuiltAllocationInput[] = [];
  for (const order of orders) {
    if (order.amountMinor > 0) {
      inputs.push({ orderId: order.orderId, amountMinor: order.amountMinor });
    }
    for (const item of order.items) {
      if (item.amountMinor > 0 || item.settled) {
        inputs.push({
          orderId: order.orderId,
          orderItemId: item.itemId,
          amountMinor: item.amountMinor,
          settlesTarget: item.settled,
        });
      }
    }
  }
  return inputs;
}
