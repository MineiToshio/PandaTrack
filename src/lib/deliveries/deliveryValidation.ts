import { z } from "zod";
import { isAllowedCollectorBaseCurrency } from "@/lib/catalog/collectorCountries";
import { exchangeRateSchema } from "@/lib/orders/orderValidation";
import { isWholeMajorAmount, isZeroDecimalCurrency } from "@/lib/currency";
import { domainDateSchema } from "@/lib/domainDateSchema";

const MAX_DELIVERY_COST = 999_999_999;
const MAX_NOTE_LENGTH = 2000;
// Upper bound on products grouped into a single delivery; keeps the payload from being used to flood the mutation.
const MAX_DELIVERY_PRODUCTS = 200;

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

export type DeliveryCreateInput = z.infer<typeof deliveryCreateSchema>;
export type DeliveryQuickArrivalInput = z.infer<typeof deliveryQuickArrivalSchema>;
export type DeliveryStoreArrivalInput = z.infer<typeof deliveryStoreArrivalSchema>;
export type DeliveryEditInput = z.infer<typeof deliveryEditSchema>;
export type DeliveryMarkDeliveredInput = z.infer<typeof deliveryMarkDeliveredSchema>;
export type DeliveryReopenInput = z.infer<typeof deliveryReopenSchema>;
export type DeliveryCancelInput = z.infer<typeof deliveryCancelSchema>;
export type DeliveryDeleteInput = z.infer<typeof deliveryDeleteSchema>;
export type DeliveryNoteUpdateInput = z.infer<typeof deliveryNoteUpdateSchema>;
