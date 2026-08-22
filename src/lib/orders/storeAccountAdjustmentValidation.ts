import { z } from "zod";
import { isAllowedCollectorBaseCurrency } from "@/lib/catalog/collectorCountries";
import { MAX_PAYMENT_AMOUNT } from "@/lib/orders/orderValidation";

/**
 * The `createStoreAccountAdjustmentAction` payload boundary (WO-11, `ADR 0034`).
 *
 * Deliberately shape-only: `reason` accepts an empty string here rather than enforcing
 * non-emptiness at this layer, so an empty submission reaches `createStoreAccountAdjustment` and
 * comes back as its own `REASON_REQUIRED` refusal instead of a generic `validation` error the sheet
 * cannot map to the reason field. The same is true for an empty `lines` array and
 * `NO_ADJUSTMENT_NEEDED`: this schema only guards types and bounds a hostile payload could exceed,
 * never the domain rules the mutation itself already owns.
 */

const currencyCodeSchema = z
  .string()
  .length(3)
  .refine((code) => isAllowedCollectorBaseCurrency(code), { message: "INVALID_CURRENCY" });

/** Upper bound on lines per declaration. Guards against a tampered client payload, not a real limit
 *  a collector could reach by hand: the sheet lists at most one row per non-cancelled order. */
const MAX_ADJUSTMENT_LINES = 500;

const createStoreAccountAdjustmentLineSchema = z.object({
  orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
  amountMinor: z.number().int().min(1).max(MAX_PAYMENT_AMOUNT),
});

export const createStoreAccountAdjustmentSchema = z.object({
  storeId: z.string().cuid({ message: "INVALID_STORE_ID" }),
  currencyCode: currencyCodeSchema,
  reason: z.string().max(2000),
  lines: z.array(createStoreAccountAdjustmentLineSchema).max(MAX_ADJUSTMENT_LINES),
});

export type CreateStoreAccountAdjustmentActionInput = z.infer<typeof createStoreAccountAdjustmentSchema>;

export const deleteStoreAccountAdjustmentSchema = z.object({
  adjustmentId: z.string().cuid({ message: "INVALID_ADJUSTMENT_ID" }),
});

export const getStoreReconciliationPreviewSchema = z.object({
  storeId: z.string().cuid({ message: "INVALID_STORE_ID" }),
  currencyCode: currencyCodeSchema,
});
