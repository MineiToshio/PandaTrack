import { z } from "zod";
import { isAllowedCollectorBaseCurrency } from "@/lib/catalog/collectorCountries";
import { exchangeRateSchema, MAX_PAYMENT_AMOUNT } from "@/lib/orders/orderValidation";
import { isWholeMajorAmount, isZeroDecimalCurrency } from "@/lib/currency";
import { domainDateSchema } from "@/lib/domainDateSchema";

const MAX_DELIVERY_COST = 999_999_999;
const MAX_NOTE_LENGTH = 2000;
// Upper bound on products grouped into a single delivery; keeps the payload from being used to flood the mutation.
const MAX_DELIVERY_PRODUCTS = 200;
// Upper bound on orders a single arrival can settle in one batch (WO-08); bounded by the same
// order count a store-scoped selection can realistically reach.
const MAX_SETTLEMENT_ORDERS = 200;

/**
 * The client-observed settlement branch for one order (`WO-08`), carried purely as an ANALYTICS
 * label. Read from the same preview `getSettlementContextAction` already resolved when the modal
 * opened; it never decides what gets written; the money transaction always re-resolves the plan
 * from scratch (`FR-08-40`, "the settlement amount is never accepted from the client").
 */
const settlementBranchHintSchema = z.enum(["full", "partial_computed", "manual", "not_settled"]);

/**
 * One order's settlement intent inside a batch (`WO-08`, `BR-08-15`/`BR-08-16`): the collector's own
 * typed amount, only meaningful when the fresh server-side resolution actually lands on the
 * "manual" branch for that order, plus the branch label the preview showed for it (analytics only).
 * A batch arrival can close several orders at once, and each one that lands on "manual" needs its
 * own figure — never a single shared number split across orders, which would be the proportional
 * estimate `ADR 0025`/`ADR 0028` forbid.
 */
const settlementOrderIntentSchema = z.object({
  orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
  manualAmountMinor: z
    .number()
    .int({ message: "AMOUNT_MUST_BE_INTEGER" })
    .min(0, { message: "AMOUNT_TOO_LOW" })
    .max(MAX_PAYMENT_AMOUNT, { message: "AMOUNT_TOO_HIGH" })
    .optional(),
  branchHint: settlementBranchHintSchema.optional(),
});

/**
 * Settlement-on-arrival fields (`WO-08`, `ADR 0032`), shared by every "ya me llegó" payload:
 * `settleRemainder` is the "Ya pagué el resto" checkbox state, `settlementDate` is proposed as the
 * arrival date and is editable (defaults server-side to `receivedDate` when omitted), and
 * `settlementIntents` carries, per closed order, the collector's own typed figure (when the
 * resolver could not auto-compute) and the branch the preview showed. Nothing here is trusted as
 * the write value: the server always re-resolves the plan and only reads a manual figure when the
 * fresh resolution actually asks for one.
 */
const settlementFields = {
  settleRemainder: z.boolean(),
  settlementDate: domainDateSchema.refine((d) => d <= new Date(), { message: "SETTLEMENT_DATE_IN_FUTURE" }).optional(),
  settlementIntents: z.array(settlementOrderIntentSchema).max(MAX_SETTLEMENT_ORDERS).optional(),
};

const currencyCodeSchema = z
  .string()
  .length(3)
  .refine((code) => isAllowedCollectorBaseCurrency(code), { message: "INVALID_CURRENCY" });

const deliveryCostSchema = z
  .number()
  .int({ message: "COST_MUST_BE_INTEGER" })
  .min(0, { message: "COST_TOO_LOW" })
  .max(MAX_DELIVERY_COST, { message: "COST_TOO_HIGH" });

const expectedArrivalRefinement = (
  data: { expectedArrivalFrom?: Date | null; expectedArrivalTo?: Date | null },
  ctx: z.RefinementCtx,
) => {
  if (data.expectedArrivalFrom && data.expectedArrivalTo) {
    if (data.expectedArrivalTo < data.expectedArrivalFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expectedArrivalTo"],
        message: "ARRIVAL_TO_BEFORE_FROM",
      });
    }
  }
};

/**
 * A delivery cannot reach the collector before the store dispatched it. Only enforced when both
 * dates are present; the quick-arrival path is what makes the pair user-editable side by side,
 * so this is where the rule is cheapest to state.
 */
const receivedAfterShippedRefinement = (
  data: { deliveryDate?: Date; receivedDate?: Date | null },
  ctx: z.RefinementCtx,
) => {
  if (data.deliveryDate && data.receivedDate && data.receivedDate < data.deliveryDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["receivedDate"],
      message: "RECEIVED_BEFORE_SHIPPED",
    });
  }
};

/**
 * Zero-decimal currencies have no subunit, so the ×100 minor-units cost must land on a whole
 * major amount. Skips when currency or cost is absent (partial edit payloads).
 */
const zeroDecimalCostRefinement = (data: { currencyCode?: string; cost?: number }, ctx: z.RefinementCtx) => {
  if (!data.currencyCode || !isZeroDecimalCurrency(data.currencyCode)) {
    return;
  }
  if (typeof data.cost === "number" && !isWholeMajorAmount(data.cost)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cost"],
      message: "COST_FRACTIONAL_SUBUNITS",
    });
  }
};

export const deliveryCreateSchema = z
  .object({
    storeId: z.string().cuid({ message: "INVALID_STORE_ID" }),
    deliveryDate: domainDateSchema.refine((d) => d <= new Date(), { message: "DELIVERY_DATE_IN_FUTURE" }),
    expectedArrivalFrom: domainDateSchema.nullable().optional(),
    expectedArrivalTo: domainDateSchema.nullable().optional(),
    /**
     * Present only on the quick-arrival path: the delivery is born DELIVERED instead of
     * IN_TRANSIT and skips the separate mark-delivered step. Absent on the wizard path.
     */
    receivedDate: domainDateSchema
      .refine((d) => d <= new Date(), { message: "RECEIVED_DATE_IN_FUTURE" })
      .nullable()
      .optional(),
    cost: deliveryCostSchema,
    currencyCode: currencyCodeSchema,
    exchangeRate: exchangeRateSchema.nullable().optional(),
    productIds: z
      .array(z.string().cuid({ message: "INVALID_PRODUCT_ID" }))
      .min(1, { message: "NO_PRODUCTS_SELECTED" })
      .max(MAX_DELIVERY_PRODUCTS, { message: "TOO_MANY_PRODUCTS" }),
  })
  .superRefine(expectedArrivalRefinement)
  .superRefine(receivedAfterShippedRefinement)
  .superRefine(zeroDecimalCostRefinement);

/**
 * Quick-arrival payload ("ya me llegó"): the collector logs a delivery that already reached
 * them, from a single order, in one step. The store is never sent by the client, it is resolved
 * from the owned order server-side. `shippedDate` is optional because it is genuinely unknowable
 * after the fact; when omitted the arrival date stands in for it (see FR-08-36).
 */
export const deliveryQuickArrivalSchema = z
  .object({
    orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
    productIds: z
      .array(z.string().cuid({ message: "INVALID_PRODUCT_ID" }))
      .min(1, { message: "NO_PRODUCTS_SELECTED" })
      .max(MAX_DELIVERY_PRODUCTS, { message: "TOO_MANY_PRODUCTS" }),
    receivedDate: domainDateSchema.refine((d) => d <= new Date(), { message: "RECEIVED_DATE_IN_FUTURE" }),
    shippedDate: domainDateSchema
      .refine((d) => d <= new Date(), { message: "DELIVERY_DATE_IN_FUTURE" })
      .nullable()
      .optional(),
    cost: deliveryCostSchema,
    currencyCode: currencyCodeSchema,
    exchangeRate: exchangeRateSchema.nullable().optional(),
    ...settlementFields,
  })
  .superRefine((data, ctx) =>
    receivedAfterShippedRefinement(
      { deliveryDate: data.shippedDate ?? undefined, receivedDate: data.receivedDate },
      ctx,
    ),
  )
  .superRefine(zeroDecimalCostRefinement);

/**
 * Store-scoped arrival payload: the same one-step "ya me llegó" act as
 * `deliveryQuickArrivalSchema`, but the selection is scoped to a store instead of a single order,
 * so the products may come from several orders of that store (`FR-08-02`). Only the scope key
 * changes; every other field, bound and refinement is deliberately identical, because the two
 * payloads land on the same `createDelivery` transaction and must never drift apart.
 *
 * The client never gets to say which order each product belongs to: `createDelivery` re-reads
 * every item and refuses anything that is not owned by the caller and not from `storeId`.
 */
export const deliveryStoreArrivalSchema = z
  .object({
    storeId: z.string().cuid({ message: "INVALID_STORE_ID" }),
    productIds: z
      .array(z.string().cuid({ message: "INVALID_PRODUCT_ID" }))
      .min(1, { message: "NO_PRODUCTS_SELECTED" })
      .max(MAX_DELIVERY_PRODUCTS, { message: "TOO_MANY_PRODUCTS" }),
    receivedDate: domainDateSchema.refine((d) => d <= new Date(), { message: "RECEIVED_DATE_IN_FUTURE" }),
    shippedDate: domainDateSchema
      .refine((d) => d <= new Date(), { message: "DELIVERY_DATE_IN_FUTURE" })
      .nullable()
      .optional(),
    cost: deliveryCostSchema,
    currencyCode: currencyCodeSchema,
    exchangeRate: exchangeRateSchema.nullable().optional(),
    ...settlementFields,
  })
  .superRefine((data, ctx) =>
    receivedAfterShippedRefinement(
      { deliveryDate: data.shippedDate ?? undefined, receivedDate: data.receivedDate },
      ctx,
    ),
  )
  .superRefine(zeroDecimalCostRefinement);

export const deliveryEditSchema = z
  .object({
    deliveryId: z.string().cuid({ message: "INVALID_DELIVERY_ID" }),
    deliveryDate: domainDateSchema.refine((d) => d <= new Date(), { message: "DELIVERY_DATE_IN_FUTURE" }).optional(),
    expectedArrivalFrom: domainDateSchema.nullable().optional(),
    expectedArrivalTo: domainDateSchema.nullable().optional(),
    cost: deliveryCostSchema.optional(),
    currencyCode: currencyCodeSchema.optional(),
    exchangeRate: exchangeRateSchema.nullable().optional(),
    productIds: z
      .array(z.string().cuid({ message: "INVALID_PRODUCT_ID" }))
      .min(1, { message: "NO_PRODUCTS_SELECTED" })
      .max(MAX_DELIVERY_PRODUCTS, { message: "TOO_MANY_PRODUCTS" })
      .optional(),
  })
  .superRefine(expectedArrivalRefinement)
  .superRefine(zeroDecimalCostRefinement);

export const deliveryMarkDeliveredSchema = z.object({
  deliveryId: z.string().cuid({ message: "INVALID_DELIVERY_ID" }),
  receivedDate: domainDateSchema.refine((d) => d <= new Date(), { message: "RECEIVED_DATE_IN_FUTURE" }),
});

export const deliveryReopenSchema = z.object({
  deliveryId: z.string().cuid({ message: "INVALID_DELIVERY_ID" }),
});

export const deliveryCancelSchema = z.object({
  deliveryId: z.string().cuid({ message: "INVALID_DELIVERY_ID" }),
});

export const deliveryDeleteSchema = z.object({
  deliveryId: z.string().cuid({ message: "INVALID_DELIVERY_ID" }),
});

export const deliveryNoteUpdateSchema = z.object({
  deliveryId: z.string().cuid({ message: "INVALID_DELIVERY_ID" }),
  note: z.string().max(MAX_NOTE_LENGTH).nullable(),
});

/**
 * `getSettlementContextAction`'s input (`WO-08`): one entry per order the modal wants a settlement
 * preview for. `deliveredItemIds` is the products THIS prospective arrival would deliver for that
 * order — the same set the resolver's partial branch scores, and what lets the preview tell
 * whether the arrival would close the order.
 */
export const settlementContextRequestSchema = z.object({
  orders: z
    .array(
      z.object({
        orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
        deliveredItemIds: z.array(z.string().cuid({ message: "INVALID_PRODUCT_ID" })).max(MAX_DELIVERY_PRODUCTS),
      }),
    )
    .min(1)
    .max(MAX_SETTLEMENT_ORDERS),
});

/**
 * `retrySettlementAction`'s input (`WO-08`, `FR-08-42`): only the delivery id and the collector's
 * original settlement INTENT (checkbox state, date, any manual figures). Never the closed-order
 * set or the deliveredItemIds themselves — `Retry` re-derives both fresh from the delivery's own
 * current items, precisely so a stale client payload can never substitute for the server's own
 * read of what is closed today.
 */
export const retrySettlementSchema = z.object({
  deliveryId: z.string().cuid({ message: "INVALID_DELIVERY_ID" }),
  settleRemainder: z.boolean(),
  // Mirrors `settlementFields.settlementDate` (MAJOR D-adjacent fix, 2026-08-20 review): Retry
  // carries this date straight through to the same `createStorePaymentInTx` write the first attempt
  // would have made, so it must refuse a future date exactly like every other settlement entry point,
  // not only the one the collector types into fresh.
  settlementDate: domainDateSchema.refine((d) => d <= new Date(), { message: "SETTLEMENT_DATE_IN_FUTURE" }),
  settlementIntents: z.array(settlementOrderIntentSchema).max(MAX_SETTLEMENT_ORDERS).optional(),
});

/**
 * `undoReopenSettlementAction`'s input (`FR-08-43`, `ADR 0032` §9): the exact snapshot
 * `reopenDeliveryAction` returned, replayed back verbatim. Every field is required (no default),
 * matching `restoreSettlementPayments`'s own contract, so an omission is a compile error rather than
 * a silent no-op restore.
 */
export const restoreSettlementAllocationSchema = z.object({
  orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
  orderItemId: z.string().cuid({ message: "INVALID_PRODUCT_ID" }).nullable(),
  amountMinor: z.number().int().min(0).max(MAX_PAYMENT_AMOUNT),
});

/**
 * A stringified `Prisma.Decimal` exchange rate, exactly as `RestoreSettlementPaymentSnapshot`
 * carries it (BLOCKER F6, 2026-08-20 review): a `Decimal` must not cross a Server Action boundary
 * unserialized, so the caller stringifies it once at the client edge and this restore path never
 * re-derives or re-validates the figure itself — it was already a valid rate when the reverted
 * payment was first written. Only the shape is checked here (a finite decimal string), not the
 * numeric bounds `exchangeRateSchema` enforces for a collector's freshly typed input.
 */
const decimalStringSchema = z
  .string()
  .refine((value) => value.trim() !== "" && Number.isFinite(Number(value)), { message: "EXCHANGE_RATE_INVALID" });

export const restoreSettlementPaymentSchema = z.object({
  storeId: z.string().cuid({ message: "INVALID_STORE_ID" }),
  amount: z.number().int().min(0).max(MAX_PAYMENT_AMOUNT),
  paymentDate: domainDateSchema,
  currencyCode: currencyCodeSchema,
  note: z.string().max(MAX_NOTE_LENGTH).nullable(),
  exchangeRate: decimalStringSchema.nullable(),
  exchangeRateBaseCode: z.string().length(3).nullable(),
  settledByDeliveryId: z.string().cuid().nullable(),
  allocations: z.array(restoreSettlementAllocationSchema),
});

/**
 * `undoReopenAction`'s input (BLOCKER F1, 2026-08-20 review): the ONE Server Action that undoes a
 * reopen, sequential — restore the settlement snapshot first, only then re-apply the delivery's
 * previous lifecycle state. `previousStatus` tells which lifecycle write runs second: `DELIVERED`
 * re-marks it delivered (`receivedDate` required for that branch); `CANCELLED` re-cancels it and
 * carries no `receivedDate` at all. `snapshot` may be empty (a reopen that reverted no settlement),
 * in which case the restore step is a no-op and only the lifecycle re-write happens.
 */
export const undoReopenSchema = z
  .object({
    deliveryId: z.string().cuid({ message: "INVALID_DELIVERY_ID" }),
    previousStatus: z.enum(["DELIVERED", "CANCELLED"]),
    receivedDate: domainDateSchema.refine((d) => d <= new Date(), { message: "RECEIVED_DATE_IN_FUTURE" }).nullable(),
    snapshot: z.array(restoreSettlementPaymentSchema),
  })
  .superRefine((data, ctx) => {
    if (data.previousStatus === "DELIVERED" && data.receivedDate === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["receivedDate"], message: "RECEIVED_DATE_REQUIRED" });
    }
  });

export type DeliveryCreateInput = z.infer<typeof deliveryCreateSchema>;
export type DeliveryQuickArrivalInput = z.infer<typeof deliveryQuickArrivalSchema>;
export type DeliveryStoreArrivalInput = z.infer<typeof deliveryStoreArrivalSchema>;
export type DeliveryEditInput = z.infer<typeof deliveryEditSchema>;
export type DeliveryMarkDeliveredInput = z.infer<typeof deliveryMarkDeliveredSchema>;
export type DeliveryReopenInput = z.infer<typeof deliveryReopenSchema>;
export type DeliveryCancelInput = z.infer<typeof deliveryCancelSchema>;
export type DeliveryDeleteInput = z.infer<typeof deliveryDeleteSchema>;
export type DeliveryNoteUpdateInput = z.infer<typeof deliveryNoteUpdateSchema>;
export type SettlementContextRequestInput = z.infer<typeof settlementContextRequestSchema>;
export type RetrySettlementInput = z.infer<typeof retrySettlementSchema>;
export type UndoReopenInput = z.infer<typeof undoReopenSchema>;
export type SettlementOrderIntent = z.infer<typeof settlementOrderIntentSchema>;
export type SettlementBranchHint = z.infer<typeof settlementBranchHintSchema>;
