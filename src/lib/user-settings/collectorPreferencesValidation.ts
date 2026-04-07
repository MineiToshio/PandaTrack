import { z } from "zod";
import { isAllowedCollectorBaseCurrency, isCollectorCountryCode } from "@/lib/catalog/collectorCountries";
import { isStoreProductTypeKey } from "@/lib/catalog/storeProductTypes";
import {
  BUDGET_RESET_DAY_MAX,
  BUDGET_RESET_DAY_MIN,
  MAX_BUDGET_AMOUNT,
  MIN_BUDGET_AMOUNT,
} from "@/lib/user-settings/usernameConstants";

export function isValidIanaTimezone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

const emptyToNull = (value: unknown): unknown => {
  if (value === "") {
    return null;
  }
  return value;
};

const countryValueSchema = z.preprocess(
  emptyToNull,
  z.union([
    z.null(),
    z
      .string()
      .length(2)
      .refine((code) => isCollectorCountryCode(code), { message: "INVALID_COUNTRY" }),
  ]),
);

const currencyValueSchema = z.preprocess(
  emptyToNull,
  z.union([
    z.null(),
    z
      .string()
      .length(3)
      .refine((code) => isAllowedCollectorBaseCurrency(code), { message: "INVALID_CURRENCY" }),
  ]),
);

const budgetAmountValueSchema = z
  .preprocess(emptyToNull, z.union([z.null(), z.number().int()]))
  .pipe(z.union([z.null(), z.number().int().min(MIN_BUDGET_AMOUNT).max(MAX_BUDGET_AMOUNT)]));

const budgetResetDayValueSchema = z
  .preprocess(emptyToNull, z.union([z.null(), z.number().int()]))
  .pipe(z.union([z.null(), z.number().int().min(BUDGET_RESET_DAY_MIN).max(BUDGET_RESET_DAY_MAX)]));

const timezoneValueSchema = z.preprocess(
  emptyToNull,
  z.union([
    z.null(),
    z
      .string()
      .min(2)
      .max(64)
      .refine((tz) => isValidIanaTimezone(tz), { message: "INVALID_TIMEZONE" }),
  ]),
);

const productTypeKeySchema = z
  .string()
  .min(1)
  .max(64)
  .refine((key) => isStoreProductTypeKey(key), { message: "INVALID_PRODUCT_TYPE" });

const productTypeKeysSchema = z
  .array(productTypeKeySchema)
  .max(64)
  .transform((keys) => Array.from(new Set(keys)));

export const collectorPreferencesPatchSchema = z
  .object({
    preferredCountryCode: countryValueSchema.optional(),
    baseCurrencyCode: currencyValueSchema.optional(),
    budgetAmount: budgetAmountValueSchema.optional(),
    budgetResetDayOfMonth: budgetResetDayValueSchema.optional(),
    timezone: timezoneValueSchema.optional(),
    preferredProductTypeKeys: productTypeKeysSchema.optional(),
  })
  .strict();

export const collectorPreferencesStateSchema = z
  .object({
    preferredCountryCode: countryValueSchema,
    baseCurrencyCode: currencyValueSchema,
    budgetAmount: budgetAmountValueSchema,
    budgetResetDayOfMonth: budgetResetDayValueSchema,
    timezone: timezoneValueSchema,
    preferredProductTypeKeys: productTypeKeysSchema,
  })
  .superRefine((value, ctx) => {
    if (value.budgetAmount !== null && value.baseCurrencyCode === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["baseCurrencyCode"],
        message: "BASE_CURRENCY_REQUIRED_FOR_BUDGET",
      });
    }
  });

export type CollectorPreferencesPatchInput = z.infer<typeof collectorPreferencesPatchSchema>;
export type CollectorPreferencesStateInput = z.infer<typeof collectorPreferencesStateSchema>;

export function parseCollectorPreferencesPatch(
  input: unknown,
): { ok: true; value: CollectorPreferencesPatchInput } | { ok: false; error: z.ZodError } {
  const parsed = collectorPreferencesPatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error };
  }
  return { ok: true, value: parsed.data };
}

export function validateCollectorPreferencesState(
  input: unknown,
): { ok: true; value: CollectorPreferencesStateInput } | { ok: false; error: z.ZodError } {
  const parsed = collectorPreferencesStateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error };
  }
  return { ok: true, value: parsed.data };
}
