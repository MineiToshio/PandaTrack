import { z } from "zod";
import { isAllowedCollectorBaseCurrency, isCollectorCountryCode } from "@/lib/catalog/collectorCountries";
import {
  BUDGET_MINOR_UNITS_PER_MAJOR,
  BUDGET_RESET_DAY_MAX,
  BUDGET_RESET_DAY_MIN,
  MAX_BUDGET_AMOUNT_MINOR,
  MIN_BUDGET_AMOUNT_MINOR,
} from "@/lib/user-settings/budgetConstants";

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

const budgetAmountValueSchema = z.preprocess(emptyToNull, z.union([z.null(), z.number().int()])).pipe(
  z.union([
    z.null(),
    z
      .number()
      .int()
      .min(MIN_BUDGET_AMOUNT_MINOR)
      .max(MAX_BUDGET_AMOUNT_MINOR)
      // The collector budgets in whole currency units; minor units are only the storage shape.
      .refine((value) => value % BUDGET_MINOR_UNITS_PER_MAJOR === 0, {
        message: "BUDGET_FRACTIONAL_SUBUNITS",
      }),
  ]),
);

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

// Product-type keys are validated for shape only here; membership is a DB-existence check
// (`assertKnownProductTypeKeys`) run at the persistence boundary, so admin-authored types outside
// the seed union are selectable as preferences without a code change.
const productTypeKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_]+$/, { message: "INVALID_PRODUCT_TYPE" });

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

/**
 * Asserts every submitted product-type key exists in the catalog, given the set of keys the DB
 * confirmed present. Throws a {@link z.ZodError} (on `preferredProductTypeKeys`) for any unknown key
 * so callers can reuse their existing Zod error handling. This is the membership gate that replaced
 * the hardcoded seed-union check, so admin-authored types are accepted while typos are rejected.
 */
export function assertKnownProductTypeKeys(submittedKeys: readonly string[], existingKeys: readonly string[]): void {
  const known = new Set(existingKeys);
  const missing = submittedKeys.filter((key) => !known.has(key));
  if (missing.length > 0) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["preferredProductTypeKeys"],
        message: "INVALID_PRODUCT_TYPE",
      },
    ]);
  }
}
