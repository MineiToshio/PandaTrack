import { z } from "zod";
import { isAllowedCollectorBaseCurrency } from "@/lib/catalog/collectorCountries";
import { isWholeMajorAmount, isZeroDecimalCurrency } from "@/lib/currency";

/**
 * Zero-decimal currencies have no subunit, so a ×100 minor-units amount must land on a whole
 * major amount. Flags `totalCost` and any item `unitPrice` that carry fractional subunits when
 * the order currency is exponent-0 (CLP, JPY, KRW). Skips when currency or amount is absent
 * (partial edit payloads), leaving the field-level rules to handle those.
 */
function zeroDecimalAmountRefinement(
  data: {
    currencyCode?: string;
    totalCost?: number;
    items?: { unitPrice?: number | null }[];
    initialPayment?: { amount: number } | null;
  },
  ctx: z.RefinementCtx,
) {
  if (!data.currencyCode || !isZeroDecimalCurrency(data.currencyCode)) {
    return;
  }
  if (typeof data.totalCost === "number" && !isWholeMajorAmount(data.totalCost)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["totalCost"],
      message: "TOTAL_COST_FRACTIONAL_SUBUNITS",
    });
  }
  if (data.initialPayment && !isWholeMajorAmount(data.initialPayment.amount)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["initialPayment", "amount"],
      message: "AMOUNT_FRACTIONAL_SUBUNITS",
    });
  }
  data.items?.forEach((item, index) => {
    if (typeof item.unitPrice === "number" && !isWholeMajorAmount(item.unitPrice)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "unitPrice"],
        message: "UNIT_PRICE_FRACTIONAL_SUBUNITS",
      });
    }
  });
}

const MIN_TOTAL_COST = 1;
const MAX_TOTAL_COST = 999_999_999;
const MIN_PAYMENT_AMOUNT = 1;
/** Shared ceiling for any money amount recorded as paid, in minor units. */
export const MAX_PAYMENT_AMOUNT = 999_999_999;
// Weak-currency pairs in the supported catalog produce sub-cent rates (e.g. CLP→USD ≈ 0.001,
// KRW→USD ≈ 0.0007), and the FX providers quote 6 decimals — a 2-decimal floor would make
// those orders impossible to reconcile.
const MIN_EXCHANGE_RATE = 0.000001;
const MAX_EXCHANGE_RATE = 99_999.99;
const EXCHANGE_RATE_MAX_DECIMALS = 6;
export const MAX_CANCELLATION_REASON_LENGTH = 500;
// Upper bound on line items per order write. Guards the DB and downstream loops against an
// unbounded array from a tampered client payload; far above any realistic single-order size.
const MAX_ORDER_ITEMS = 200;

const currencyCodeSchema = z
  .string()
  .length(3)
  .refine((code) => isAllowedCollectorBaseCurrency(code), { message: "INVALID_CURRENCY" });

const totalCostSchema = z
  .number()
  .int({ message: "TOTAL_COST_MUST_BE_INTEGER" })
  .min(MIN_TOTAL_COST, { message: "TOTAL_COST_TOO_LOW" })
  .max(MAX_TOTAL_COST, { message: "TOTAL_COST_TOO_HIGH" });

const paymentAmountSchema = z
  .number()
  .int({ message: "AMOUNT_MUST_BE_INTEGER" })
  .min(MIN_PAYMENT_AMOUNT, { message: "AMOUNT_TOO_LOW" })
  .max(MAX_PAYMENT_AMOUNT, { message: "AMOUNT_TOO_HIGH" });

export const exchangeRateSchema = z
  .number()
  .min(MIN_EXCHANGE_RATE, { message: "EXCHANGE_RATE_TOO_LOW" })
  .max(MAX_EXCHANGE_RATE, { message: "EXCHANGE_RATE_TOO_HIGH" })
  // String round-trip instead of multipleOf: float modulo on 1e-6 steps produces
  // false negatives for values that are exactly representable at 6 decimals.
  .refine((value) => Number(value.toFixed(EXCHANGE_RATE_MAX_DECIMALS)) === value, {
    message: "EXCHANGE_RATE_INVALID_PRECISION",
  });

export const orderItemRowSchema = z.object({
  name: z.string().min(1, { message: "ITEM_NAME_REQUIRED" }).max(500, { message: "ITEM_NAME_TOO_LONG" }),
  quantity: z.number().int({ message: "QUANTITY_MUST_BE_INTEGER" }).min(1, { message: "QUANTITY_TOO_LOW" }),
  unitPrice: z
    .number()
    .int({ message: "UNIT_PRICE_MUST_BE_INTEGER" })
    .min(0, { message: "UNIT_PRICE_TOO_LOW" })
    .nullable()
    .optional(),
  // Catalog membership is enforced at write time against the DB
  // (findInvalidProductTypeKey); this bound only rejects oversized payloads early.
  productTypeKey: z.string().max(64, { message: "PRODUCT_TYPE_KEY_TOO_LONG" }).nullable().optional(),
  position: z.number().int().min(1, { message: "POSITION_TOO_LOW" }),
});

/**
 * Money handed over at the moment the order is created (a deposit, a first instalment). Optional:
 * an order with nothing paid yet is the common case. It becomes a store payment declared entirely
 * against the new order, inside the same transaction that creates it.
 */
const initialPaymentSchema = z.object({
  amount: paymentAmountSchema,
  paymentDate: z.coerce.date().refine((date) => date <= new Date(), { message: "PAYMENT_DATE_IN_FUTURE" }),
});

export const orderCreateSchema = z
  .object({
    storeId: z.string().cuid({ message: "INVALID_STORE_ID" }),
    orderDate: z.coerce.date(),
    expectedDeliveryFrom: z.coerce.date().nullable().optional(),
    expectedDeliveryTo: z.coerce.date().nullable().optional(),
    currencyCode: currencyCodeSchema,
    exchangeRate: exchangeRateSchema.nullable().optional(),
    totalCost: totalCostSchema,
    note: z.string().max(2000).nullable().optional(),
    items: z.array(orderItemRowSchema).max(MAX_ORDER_ITEMS, { message: "TOO_MANY_ITEMS" }).optional(),
    initialPayment: initialPaymentSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.expectedDeliveryFrom && data.expectedDeliveryTo) {
      if (data.expectedDeliveryTo < data.expectedDeliveryFrom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["expectedDeliveryTo"],
          message: "DELIVERY_TO_BEFORE_FROM",
        });
      }
    }
    if (data.initialPayment && data.initialPayment.amount > data.totalCost) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["initialPayment", "amount"],
        message: "INITIAL_PAYMENT_EXCEEDS_TOTAL",
      });
    }
    if (data.initialPayment && data.initialPayment.paymentDate < data.orderDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["initialPayment", "paymentDate"],
        message: "DATE_BEFORE_ORDER",
      });
    }
    zeroDecimalAmountRefinement(data, ctx);
  });

export const orderItemEditRowSchema = orderItemRowSchema.extend({
  id: z.string().cuid().optional(),
});

export const orderEditSchema = z
  .object({
    storeId: z.string().cuid({ message: "INVALID_STORE_ID" }).optional(),
    orderDate: z.coerce.date().optional(),
    expectedDeliveryFrom: z.coerce.date().nullable().optional(),
    expectedDeliveryTo: z.coerce.date().nullable().optional(),
    currencyCode: currencyCodeSchema.optional(),
    exchangeRate: exchangeRateSchema.nullable().optional(),
    totalCost: totalCostSchema.optional(),
    note: z.string().max(2000).nullable().optional(),
    items: z.array(orderItemEditRowSchema).max(MAX_ORDER_ITEMS, { message: "TOO_MANY_ITEMS" }).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.expectedDeliveryFrom && data.expectedDeliveryTo) {
      if (data.expectedDeliveryTo < data.expectedDeliveryFrom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["expectedDeliveryTo"],
          message: "DELIVERY_TO_BEFORE_FROM",
        });
      }
    }
    zeroDecimalAmountRefinement(data, ctx);
  });

/**
 * What happens to the money already declared against an order when it is cancelled. Under
 * store-level payments the payment itself is never destroyed by a cancellation, only its
 * declaration: `lost` leaves the declarations attached to the cancelled order (the money is gone,
 * and the dashboard reads it as such), `credit` removes them so the money returns to the store's
 * undeclared pool, available to cover another order.
 *
 * The legacy `keep` / `remove` spellings are still accepted and normalized, because they are what
 * the current cancel dialog sends.
 */
export const CANCEL_PAYMENTS_CHOICES = ["lost", "credit"] as const;
export type CancelPaymentsChoice = (typeof CANCEL_PAYMENTS_CHOICES)[number];

export const cancelPaymentsChoiceSchema = z
  .enum(["lost", "credit", "keep", "remove"])
  .default("lost")
  .transform((value): CancelPaymentsChoice => {
    if (value === "keep") return "lost";
    if (value === "remove") return "credit";
    return value;
  });

export const orderCancelSchema = z.object({
  orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
  paymentsChoice: cancelPaymentsChoiceSchema,
});

export const orderDeleteSchema = z.object({
  orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
});

export const orderReactivateSchema = z.object({
  orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
});

export const orderPaymentCreateSchema = z.object({
  orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
  amount: paymentAmountSchema,
  paymentDate: z.coerce.date().refine((d) => d <= new Date(), { message: "PAYMENT_DATE_IN_FUTURE" }),
});

/**
 * Deleting a payment from an order removes that order's declaration on it (the allocation), which
 * is the id an order's payment records carry. Whether the payment itself also goes is decided by
 * the mutation, not by the caller.
 *
 * Ids are not `cuid()`-shaped here: rows carried over from the per-order ledger keep a derived,
 * prefixed id so they stay traceable to the payment they came from.
 */
export const orderPaymentDeleteSchema = z.object({
  allocationId: z.string().min(1, { message: "INVALID_ALLOCATION_ID" }).max(64),
  orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
});

/** Upper bound on declaration lines per store payment. Guards against a tampered client payload. */
const MAX_STORE_PAYMENT_ALLOCATIONS = 200;

const storePaymentAllocationSchema = z.object({
  orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
  orderItemId: z.string().cuid({ message: "INVALID_ITEM_ID" }).optional(),
  // Zero is legal only alongside `settlesTarget` — the mutation, which sees the full batch, is
  // the one place that rule is enforced; the schema only bounds the shape.
  amountMinor: z.number().int().min(0).max(MAX_PAYMENT_AMOUNT),
  settlesTarget: z.boolean().optional(),
});

/**
 * A payment to a store, with its optional "what this covers" declaration. `currencyCode` is
 * omitted when the store's standing orders agree on one; the mutation inherits it in that case and
 * refuses with `CURRENCY_REQUIRED` otherwise.
 */
export const storePaymentCreateSchema = z.object({
  storeId: z.string().cuid({ message: "INVALID_STORE_ID" }),
  amount: paymentAmountSchema,
  paymentDate: z.coerce.date().refine((d) => d <= new Date(), { message: "PAYMENT_DATE_IN_FUTURE" }),
  currencyCode: currencyCodeSchema.optional(),
  note: z.string().max(2000).nullable().optional(),
  allocations: z.array(storePaymentAllocationSchema).max(MAX_STORE_PAYMENT_ALLOCATIONS).optional(),
});

export const orderItemDeleteSchema = z.object({
  itemId: z.string().cuid({ message: "INVALID_ITEM_ID" }),
  orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
});

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type OrderEditInput = z.infer<typeof orderEditSchema>;
export type OrderItemEditRowInput = z.infer<typeof orderItemEditRowSchema>;
export type OrderCancelInput = z.infer<typeof orderCancelSchema>;
export type OrderDeleteInput = z.infer<typeof orderDeleteSchema>;
export type OrderReactivateInput = z.infer<typeof orderReactivateSchema>;
export type OrderPaymentCreateInput = z.infer<typeof orderPaymentCreateSchema>;
export type OrderPaymentDeleteInput = z.infer<typeof orderPaymentDeleteSchema>;
export type OrderItemRowInput = z.infer<typeof orderItemRowSchema>;
export type OrderItemDeleteInput = z.infer<typeof orderItemDeleteSchema>;
export type StorePaymentCreateInput = z.infer<typeof storePaymentCreateSchema>;
