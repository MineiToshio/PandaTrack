import { z } from "zod";
import { isAllowedCollectorBaseCurrency } from "@/lib/catalog/collectorCountries";
import { exchangeRateSchema } from "@/lib/orders/orderValidation";
import { isWholeMajorAmount, isZeroDecimalCurrency } from "@/lib/currency";

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
 * Zero-decimal currencies have no subunit, so the ×100 minor-units cost must land on a whole
 * major amount. Skips when currency or cost is absent (partial edit payloads).
 */
const zeroDecimalCostRefinement = (
  data: { currencyCode?: string; cost?: number },
  ctx: z.RefinementCtx,
) => {
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
    deliveryDate: z.coerce.date().refine((d) => d <= new Date(), { message: "DELIVERY_DATE_IN_FUTURE" }),
    expectedArrivalFrom: z.coerce.date().nullable().optional(),
    expectedArrivalTo: z.coerce.date().nullable().optional(),
    cost: deliveryCostSchema,
    currencyCode: currencyCodeSchema,
    exchangeRate: exchangeRateSchema.nullable().optional(),
    productIds: z
      .array(z.string().cuid({ message: "INVALID_PRODUCT_ID" }))
      .min(1, { message: "NO_PRODUCTS_SELECTED" })
      .max(MAX_DELIVERY_PRODUCTS, { message: "TOO_MANY_PRODUCTS" }),
  })
  .superRefine(expectedArrivalRefinement)
  .superRefine(zeroDecimalCostRefinement);

export const deliveryEditSchema = z
  .object({
    deliveryId: z.string().cuid({ message: "INVALID_DELIVERY_ID" }),
    deliveryDate: z.coerce
      .date()
      .refine((d) => d <= new Date(), { message: "DELIVERY_DATE_IN_FUTURE" })
      .optional(),
    expectedArrivalFrom: z.coerce.date().nullable().optional(),
    expectedArrivalTo: z.coerce.date().nullable().optional(),
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
  receivedDate: z.coerce.date().refine((d) => d <= new Date(), { message: "RECEIVED_DATE_IN_FUTURE" }),
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
export type DeliveryEditInput = z.infer<typeof deliveryEditSchema>;
export type DeliveryMarkDeliveredInput = z.infer<typeof deliveryMarkDeliveredSchema>;
export type DeliveryReopenInput = z.infer<typeof deliveryReopenSchema>;
export type DeliveryCancelInput = z.infer<typeof deliveryCancelSchema>;
export type DeliveryDeleteInput = z.infer<typeof deliveryDeleteSchema>;
export type DeliveryNoteUpdateInput = z.infer<typeof deliveryNoteUpdateSchema>;
