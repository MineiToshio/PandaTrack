/**
 * Pure client-side validation for the store payment sheet's allocation panel. Mirrors the
 * server-side rules in `storePaymentMutations.ts` (`validateAllocations`) closely enough that a
 * submission built from a draft that passes here is only refused by the server in exceptional,
 * hard-to-predict cases (a concurrent write shrinking an order's balance mid-session).
 *
 * The draft stays NESTED (payment → order → product) because the ceilings are hierarchical: an
 * order's own balance caps the sum of every line under it, so a flat list could not express the
 * arithmetic even though the panel renders one.
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
  /**
   * Whether this payment declares the product covered, with no amount. It lives in the nested draft
   * rather than in a flat set at the root so the sheet's existing reconciliation covers it for
   * free: a mark whose line disappeared is dropped by the same `renderableKeys` filter an amount is.
   *
   * It enters NO ceiling. It does not move "Sin asignar", `sumAllOrders` or `canSubmit`, because it
   * is not money.
   */
  declared: boolean;
};

/** One order's declaration line ("Resto del pedido"), plus its own per-product breakdown. */
export type SheetOrderDraft = {
  orderId: string;
  /** This order's own date — a payment declared against it can never predate it. */
  orderDate: Date;
  /** This order's own remaining assignable balance (`totalCost - allocatedAmountMinor`), before this draft. */
  assignableMinor: number;
  /** What this order's products cannot absorb between them — the "Resto del pedido" line's own ceiling. */
  restCeilingMinor: number;
  /** Amount typed against the order with no product named ("Resto del pedido"). 0 when untouched. */
  amountMinor: number;
  items: SheetItemDraft[];
};

export type StorePaymentSheetDraft = {
  /** The payment's total amount. 0 when the amount field is empty or unparsed. */
  paymentAmountMinor: number;
  /** The store's outstanding debt in the payment's currency. */
  debtMinor: number;
  /** The payment's own date. `null` while the collector has not picked one yet. */
  paymentDate: Date | null;
  orders: SheetOrderDraft[];
};

/** Stable identity of the "Resto del pedido" line of an order. */
export function restLineKey(orderId: string): string {
  return orderId;
}

/** Stable identity of one product line. Namespaced by its order so two orders never collide. */
export function itemLineKey(orderId: string, itemId: string): string {
  return `${orderId}:${itemId}`;
}

/** Everything declared against one order: its rest line plus every product line under it. */
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

/** True once this order's own declarations (its rest line + its products' lines) outrun its balance. */
export function isOrderOverAssignable(order: SheetOrderDraft): boolean {
  return sumOrderDraft(order) > order.assignableMinor;
}

/**
 * True once a product's own declared amount outruns what's left of its price base. Unknown-base
 * products never fail this check: nothing was recorded to refuse against.
 *
 * Takes the two fields it actually reads rather than a whole {@link SheetItemDraft}, so the order
 * detail's own breakdown panel can share it. A full draft is still assignable, so the sheet is
 * unaffected, and the ceiling rule stays stated once for both surfaces.
 */
export function isItemOverRemainingBase(item: Pick<SheetItemDraft, "amountMinor" | "remainingBaseMinor">): boolean {
  if (item.remainingBaseMinor === null) return false;
  return item.amountMinor > item.remainingBaseMinor;
}

/** The payment itself may never exceed what the collector still owes the store. */
export function doesPaymentExceedDebt(paymentAmountMinor: number, debtMinor: number): boolean {
  return paymentAmountMinor > debtMinor;
}

/**
 * True once an order carries a declaration (its rest line or any of its products' lines) dated
 * before the order itself. An order with nothing declared against it never fails this check —
 * there is nothing to date-check yet, so it stays silent until the collector actually assigns it.
 */
export function isOrderDateBeforeOrder(order: SheetOrderDraft, paymentDate: Date | null): boolean {
  if (!paymentDate) return false;
  if (sumOrderDraft(order) <= 0) return false;
  return paymentDate < order.orderDate;
}

/** The declared total may never exceed the amount actually being paid. */
export function doesAllocationSumExceedPayment(draft: StorePaymentSheetDraft): boolean {
  return sumAllOrders(draft.orders) > draft.paymentAmountMinor;
}

/** Why one rendered line carries the destructive rail. */
export type BlockingLineReason = "overOrderBalance" | "overItemBase" | "dateBeforeOrder";

/**
 * Which rendered lines are implicated by a blocking rule, keyed by {@link restLineKey} /
 * {@link itemLineKey}.
 *
 * An over-base product implicates only itself. An over-balance order and a payment dated before its
 * order are constraints of the ORDER, so every line of that order carries the rail: the collector
 * has to look at the block as a whole to decide which number to lower. The most specific reason
 * wins when several apply to the same line.
 */
export function buildBlockingLines(draft: StorePaymentSheetDraft): ReadonlyMap<string, BlockingLineReason> {
  const lines = new Map<string, BlockingLineReason>();

  for (const order of draft.orders) {
    const orderLineKeys = [
      restLineKey(order.orderId),
      ...order.items.map((item) => itemLineKey(order.orderId, item.itemId)),
    ];

    if (isOrderDateBeforeOrder(order, draft.paymentDate)) {
      for (const key of orderLineKeys) lines.set(key, "dateBeforeOrder");
    }
    if (isOrderOverAssignable(order)) {
      for (const key of orderLineKeys) lines.set(key, "overOrderBalance");
    }
    for (const item of order.items) {
      if (isItemOverRemainingBase(item)) lines.set(itemLineKey(order.orderId, item.itemId), "overItemBase");
    }
  }

  return lines;
}

/**
 * Which line to point at when the declared total outruns the payment. That rule has no single
 * culprit by construction, so the answer is the line the collector just touched — the one that
 * broke the balance, and the one they expect to be told about. Falls back to the largest declared
 * line when there is no last-edited line to name (after a currency switch, say).
 */
export function findOverAllocationCulprit(
  draft: StorePaymentSheetDraft,
  lastEditedLineKey: string | null,
): string | null {
  let largestKey: string | null = null;
  let largestAmount = 0;
  let lastEditedIsLive = false;

  for (const order of draft.orders) {
    const candidates: { key: string; amountMinor: number }[] = [
      { key: restLineKey(order.orderId), amountMinor: order.amountMinor },
      ...order.items.map((item) => ({ key: itemLineKey(order.orderId, item.itemId), amountMinor: item.amountMinor })),
    ];
    for (const candidate of candidates) {
      if (candidate.amountMinor <= 0) continue;
      if (candidate.key === lastEditedLineKey) lastEditedIsLive = true;
      if (candidate.amountMinor > largestAmount) {
        largestAmount = candidate.amountMinor;
        largestKey = candidate.key;
      }
    }
  }

  return lastEditedIsLive ? lastEditedLineKey : largestKey;
}

/** What a rendered line's "Falta" cell says, and whether it is a control at all. */
export type AllocationLineState =
  /** Nothing left to pay on this line: no control, just a "Saldado" chip. */
  | "settled"
  /** The collector marked this product as covered. Says nothing about what the line may receive. */
  | "declared"
  /** No price on record, so no ceiling of its own: a typed amount is still legal. */
  | "unpriced"
  /** Has a known amount still outstanding: the "Falta" cell is the fill button. */
  | "assignable";

/**
 * Whether a product line is settled, declared, unpriced or assignable.
 *
 * Three of the four are pure arithmetic. `declared` is the exception and it is deliberately its own
 * state rather than a second door into `settled`: `settled` is what makes the row's amount field
 * read-only, and a marked product that could no longer receive money would push that money into
 * "Resto del pedido", which writes an allocation naming no product. The mark would then MANUFACTURE
 * the undetailed money this feature exists to reduce. So the rule is: editability follows the
 * arithmetic and nothing else.
 *
 * `settledByDeclaration` honors legacy `settlesTarget` rows only. Nothing writes them any more
 * (`createStorePayment` refuses the field outright), but a row arriving out of band still renders as
 * "Saldado" rather than as a phantom 0.00.
 */
export function resolveLineState(line: {
  remainingBaseMinor: number | null;
  settledByDeclaration?: boolean;
  paidDeclared?: boolean;
}): AllocationLineState {
  if (line.settledByDeclaration) return "settled";
  if (line.remainingBaseMinor !== null && line.remainingBaseMinor <= 0) return "settled";
  if (line.paidDeclared) return "declared";
  if (line.remainingBaseMinor === null) return "unpriced";
  return "assignable";
}

export type ComputeFillableInput = {
  /** This line's own ceiling, or `null` when it has none (an unpriced product). */
  lineCeilingMinor: number | null;
  /** The order's remaining assignable balance. */
  orderAssignableMinor: number;
  /** What the order's OTHER lines already claim in the current draft. */
  sumOtherLinesOfOrderMinor: number;
  paymentAmountMinor: number;
  /** What every OTHER line of the whole draft already claims. */
  sumOtherLinesOfPaymentMinor: number;
};

/**
 * The largest amount the "Falta" button may write into one line without producing a draft that
 * validation would then refuse: the smallest of the line's own ceiling, what the order still has
 * room for, and what is left of the payment. 0 means the button is dead and must say why.
 */
export function computeFillableMinor(input: ComputeFillableInput): number {
  const ceilings = [
    input.orderAssignableMinor - input.sumOtherLinesOfOrderMinor,
    input.paymentAmountMinor - input.sumOtherLinesOfPaymentMinor,
  ];
  if (input.lineCeilingMinor !== null) ceilings.push(input.lineCeilingMinor);
  return Math.max(0, Math.min(...ceilings));
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
  /** ids of orders that carry a declaration dated before the order's own date. */
  dateErrors: ReadonlySet<string>;
  /** Rendered lines implicated by a blocking rule, for the row-level destructive rail. */
  blockingLines: ReadonlyMap<string, BlockingLineReason>;
  canSubmit: boolean;
};

/**
 * Runs every client-side rule against a draft and rolls the result into one object the sheet can
 * read directly: which fields to mark invalid, what banner to show, and whether the primary CTA
 * may be enabled. `canSubmit` requires a positive amount, a debt that covers it, an allocation sum
 * that fits inside it, every order/item line inside its own ceiling, and no declared order dated
 * before it was placed.
 */
export function validateStorePaymentSheetDraft(draft: StorePaymentSheetDraft): StorePaymentSheetValidation {
  const sumAllocatedMinor = sumAllOrders(draft.orders);
  const orderErrors = new Set(draft.orders.filter(isOrderOverAssignable).map((order) => order.orderId));
  const itemErrors = new Set(
    draft.orders.flatMap((order) => order.items.filter(isItemOverRemainingBase).map((item) => item.itemId)),
  );
  const dateErrors = new Set(
    draft.orders.filter((order) => isOrderDateBeforeOrder(order, draft.paymentDate)).map((order) => order.orderId),
  );
  const exceedsDebt = doesPaymentExceedDebt(draft.paymentAmountMinor, draft.debtMinor);
  const allocationExceedsAmount = doesAllocationSumExceedPayment(draft);
  const hasPositiveAmount = draft.paymentAmountMinor > 0;

  const canSubmit =
    hasPositiveAmount &&
    !exceedsDebt &&
    !allocationExceedsAmount &&
    orderErrors.size === 0 &&
    itemErrors.size === 0 &&
    dateErrors.size === 0;

  return {
    sumAllocatedMinor,
    unallocatedMinor: Math.max(0, draft.paymentAmountMinor - sumAllocatedMinor),
    exceedsDebt,
    allocationExceedsAmount,
    orderErrors,
    itemErrors,
    dateErrors,
    blockingLines: buildBlockingLines(draft),
    canSubmit,
  };
}

/** One line of the mutation's `allocations` input, built from a draft's non-empty entries. */
export type BuiltAllocationInput = {
  orderId: string;
  orderItemId?: string;
  amountMinor: number;
};

/**
 * Turns a draft into the `allocations` array `createStorePayment` expects: one line per order with
 * a non-zero rest amount, plus one line per product with a non-zero amount.
 *
 * Never emits `settlesTarget` and never emits a zero-amount line. "Settled" is derived from a
 * line's own arithmetic in the panel, so there is nothing left for a zero-amount declaration to
 * say, and writing one only ever produced a phantom S/ 0.00 row in the order's payment history
 * that the collector could not undo without leaving the sheet.
 */
/**
 * The `declarePaidItemIds` half of the submission: every product this payment declares covered.
 *
 * Kept separate from {@link buildAllocationInputs} because it is a different axis, not a different
 * shape of the same one. A payment that carries only marks and no amounts is still a perfectly
 * valid payment on account.
 */
export function buildDeclaredPaidItemIds(orders: SheetOrderDraft[]): string[] {
  return orders.flatMap((order) => order.items.filter((item) => item.declared).map((item) => item.itemId));
}

export function buildAllocationInputs(orders: SheetOrderDraft[]): BuiltAllocationInput[] {
  const inputs: BuiltAllocationInput[] = [];
  for (const order of orders) {
    if (order.amountMinor > 0) {
      inputs.push({ orderId: order.orderId, amountMinor: order.amountMinor });
    }
    for (const item of order.items) {
      if (item.amountMinor > 0) {
        inputs.push({ orderId: order.orderId, orderItemId: item.itemId, amountMinor: item.amountMinor });
      }
    }
  }
  return inputs;
}
