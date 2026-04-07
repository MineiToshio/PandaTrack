import type { Prisma } from "../../generated/prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  parseCollectorPreferencesPatch,
  type CollectorPreferencesPatchInput,
  validateCollectorPreferencesState,
} from "@/lib/user-settings/collectorPreferencesValidation";

export type CollectorPreferencesSnapshot = {
  preferredCountryCode: string | null;
  baseCurrencyCode: string | null;
  budgetAmount: number | null;
  budgetResetDayOfMonth: number | null;
  timezone: string | null;
  preferredProductTypeKeys: string[];
};

/**
 * Loads persisted collector preferences and preferred product type keys for settings consumers.
 */
export async function getCollectorPreferencesSnapshot(userId: string): Promise<CollectorPreferencesSnapshot | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      preferredCountryCode: true,
      baseCurrencyCode: true,
      budgetAmount: true,
      budgetResetDayOfMonth: true,
      timezone: true,
      preferredProductTypes: { select: { productTypeKey: true }, orderBy: { productTypeKey: "asc" } },
    },
  });

  if (!row) {
    return null;
  }

  return {
    preferredCountryCode: row.preferredCountryCode,
    baseCurrencyCode: row.baseCurrencyCode,
    budgetAmount: row.budgetAmount,
    budgetResetDayOfMonth: row.budgetResetDayOfMonth,
    timezone: row.timezone,
    preferredProductTypeKeys: row.preferredProductTypes.map((rowItem) => rowItem.productTypeKey),
  };
}

function buildUserScalarUpdate(patch: CollectorPreferencesPatchInput): Prisma.UserUncheckedUpdateInput {
  const data: Prisma.UserUncheckedUpdateInput = {};

  if (patch.preferredCountryCode !== undefined) {
    data.preferredCountryCode = patch.preferredCountryCode;
  }
  if (patch.baseCurrencyCode !== undefined) {
    data.baseCurrencyCode = patch.baseCurrencyCode;
  }
  if (patch.budgetAmount !== undefined) {
    data.budgetAmount = patch.budgetAmount;
  }
  if (patch.budgetResetDayOfMonth !== undefined) {
    data.budgetResetDayOfMonth = patch.budgetResetDayOfMonth;
  }
  if (patch.timezone !== undefined) {
    data.timezone = patch.timezone;
  }

  return data;
}

/**
 * Applies validated preference patches inside a transaction (scalar fields + product type links).
 * Callers must pass an already-parsed patch from `parseCollectorPreferencesPatch`.
 */
export async function applyCollectorPreferencesPatch(
  userId: string,
  patch: CollectorPreferencesPatchInput,
): Promise<void> {
  const scalar = buildUserScalarUpdate(patch);
  const hasScalar = Object.keys(scalar).length > 0;
  const hasProductTypes = patch.preferredProductTypeKeys !== undefined;

  if (!hasScalar && !hasProductTypes) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id: userId },
      select: {
        preferredCountryCode: true,
        baseCurrencyCode: true,
        budgetAmount: true,
        budgetResetDayOfMonth: true,
        timezone: true,
        preferredProductTypes: { select: { productTypeKey: true }, orderBy: { productTypeKey: "asc" } },
      },
    });

    if (!current) {
      return;
    }

    const resolvePatchedValue = <T>(value: T | undefined, fallback: T): T => {
      return value === undefined ? fallback : value;
    };

    const nextState = validateCollectorPreferencesState({
      preferredCountryCode: resolvePatchedValue(patch.preferredCountryCode, current.preferredCountryCode),
      baseCurrencyCode: resolvePatchedValue(patch.baseCurrencyCode, current.baseCurrencyCode),
      budgetAmount: resolvePatchedValue(patch.budgetAmount, current.budgetAmount),
      budgetResetDayOfMonth: resolvePatchedValue(patch.budgetResetDayOfMonth, current.budgetResetDayOfMonth),
      timezone: resolvePatchedValue(patch.timezone, current.timezone),
      preferredProductTypeKeys:
        resolvePatchedValue(patch.preferredProductTypeKeys, current.preferredProductTypes.map((row) => row.productTypeKey)),
    });

    if (!nextState.ok) {
      throw nextState.error;
    }

    if (hasScalar) {
      await tx.user.update({
        where: { id: userId },
        data: scalar,
      });
    }

    if (hasProductTypes) {
      const keys = patch.preferredProductTypeKeys ?? [];
      await tx.userPreferredProductType.deleteMany({ where: { userId } });
      if (keys.length > 0) {
        await tx.userPreferredProductType.createMany({
          data: keys.map((productTypeKey) => ({ userId, productTypeKey })),
        });
      }
    }
  });
}

/**
 * Parses and applies a collector preferences patch, or returns a Zod error.
 */
export async function parseAndApplyCollectorPreferencesPatch(
  userId: string,
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: ZodError }> {
  const parsed = parseCollectorPreferencesPatch(raw);
  if (!parsed.ok) {
    return parsed;
  }
  try {
    await applyCollectorPreferencesPatch(userId, parsed.value);
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, error };
    }
    throw error;
  }
  return { ok: true };
}
