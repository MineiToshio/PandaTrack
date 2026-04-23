import { z } from "zod";
import { isAllowedCollectorBaseCurrency } from "@/lib/catalog/collectorCountries";

const MIN_TOTAL_COST = 1;
const MAX_TOTAL_COST = 999_999_999;
const MIN_PAYMENT_AMOUNT = 1;
const MAX_PAYMENT_AMOUNT = 999_999_999;
const MIN_EXCHANGE_RATE = 0.01;
const MAX_EXCHANGE_RATE = 99_999.99;

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

const exchangeRateSchema = z
  .number()
  .min(MIN_EXCHANGE_RATE, { message: "EXCHANGE_RATE_TOO_LOW" })
  .max(MAX_EXCHANGE_RATE, { message: "EXCHANGE_RATE_TOO_HIGH" })
  .multipleOf(0.01, { message: "EXCHANGE_RATE_INVALID_PRECISION" });

export const orderItemRowSchema = z.object({
  name: z.string().min(1, { message: "ITEM_NAME_REQUIRED" }).max(500, { message: "ITEM_NAME_TOO_LONG" }),
  quantity: z.number().int({ message: "QUANTITY_MUST_BE_INTEGER" }).min(1, { message: "QUANTITY_TOO_LOW" }),
  unitPrice: z
    .number()
    .int({ message: "UNIT_PRICE_MUST_BE_INTEGER" })
    .min(0, { message: "UNIT_PRICE_TOO_LOW" })
    .nullable()
    .optional(),
  productTypeKey: z.string().nullable().optional(),
  position: z.number().int().min(1, { message: "POSITION_TOO_LOW" }),
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
    items: z.array(orderItemRowSchema).optional(),
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
    items: z.array(orderItemEditRowSchema).optional(),
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
  });

export const orderCancelSchema = z.object({
  orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
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

export const orderPaymentDeleteSchema = z.object({
  paymentId: z.string().cuid({ message: "INVALID_PAYMENT_ID" }),
  orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
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
