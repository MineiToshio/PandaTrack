import type { Prisma } from "../../../../generated/prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { flagOrdersForFxReconciliation } from "@/lib/data/orders/orderMutations";
import { flagDeliveriesForFxReconciliation } from "@/lib/data/deliveries/deliveryMutations";
import {
  assertKnownProductTypeKeys,
  parseCollectorPreferencesPatch,
  type CollectorPreferencesPatchInput,
  validateCollectorPreferencesState,
} from "@/lib/user-settings/collectorPreferencesValidation";
import { listExistingStoreProductTypeKeys } from "@/lib/data/catalog/storeProductTypeQueries";

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

async function applyCollectorPreferencesPatchWithin(
  tx: Prisma.TransactionClient,
  userId: string,
  patch: CollectorPreferencesPatchInput,
  scalar: Prisma.UserUncheckedUpdateInput,
  hasScalar: boolean,
  hasProductTypes: boolean,
): Promise<void> {
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
    preferredProductTypeKeys: resolvePatchedValue(
      patch.preferredProductTypeKeys,
      current.preferredProductTypes.map((row) => row.productTypeKey),
    ),
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
    // Membership is a catalog-existence check (not a hardcoded union), so admin-authored types are
    // selectable while typos still fail. Runs in the same tx as the write it guards.
    if (keys.length > 0) {
      const existing = await listExistingStoreProductTypeKeys(keys, tx);
      assertKnownProductTypeKeys(
        keys,
        existing.map((row) => row.key),
      );
    }
    await tx.userPreferredProductType.deleteMany({ where: { userId } });
    if (keys.length > 0) {
      await tx.userPreferredProductType.createMany({
        data: keys.map((productTypeKey) => ({ userId, productTypeKey })),
      });
    }
  }
}

/**
 * Applies validated preference patches inside a transaction (scalar fields + product type links).
 * Callers must pass an already-parsed patch from `parseCollectorPreferencesPatch`.
 *
 * An optional transaction client lets the caller include this patch in a wider transaction (for
 * example a base-currency change that must also flag orders for FX reconciliation) so every write
 * commits or rolls back together.
 */
export async function applyCollectorPreferencesPatch(
  userId: string,
  patch: CollectorPreferencesPatchInput,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const scalar = buildUserScalarUpdate(patch);
  const hasScalar = Object.keys(scalar).length > 0;
  const hasProductTypes = patch.preferredProductTypeKeys !== undefined;

  if (!hasScalar && !hasProductTypes) {
    return;
  }

  if (tx) {
    await applyCollectorPreferencesPatchWithin(tx, userId, patch, scalar, hasScalar, hasProductTypes);
    return;
  }

  await prisma.$transaction((tx) =>
    applyCollectorPreferencesPatchWithin(tx, userId, patch, scalar, hasScalar, hasProductTypes),
  );
}

/**
 * Parses and applies a collector preferences patch, or returns a Zod error.
 *
 * An optional transaction client is forwarded to `applyCollectorPreferencesPatch` so the patch can
 * participate in a wider transaction owned by the caller.
 */
export async function parseAndApplyCollectorPreferencesPatch(
  userId: string,
  raw: unknown,
  tx?: Prisma.TransactionClient,
): Promise<{ ok: true } | { ok: false; error: ZodError }> {
  const parsed = parseCollectorPreferencesPatch(raw);
  if (!parsed.ok) {
    return parsed;
  }
  try {
    await applyCollectorPreferencesPatch(userId, parsed.value, tx);
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, error };
    }
    throw error;
  }
  return { ok: true };
}

/**
 * Persists a base-currency change and, when the base currency actually changes, flags every order
 * AND delivery in a different currency for FX reconciliation — all in a single transaction. This
 * prevents the inconsistent state where the new base currency is saved but the affected orders or
 * deliveries keep their now stale rates unflagged (or vice versa). Flagging never mutates rates;
 * the collector reconciles orders in the orders FX modal and deliveries by editing each delivery.
 */
export async function applyBaseCurrencyChange(
  userId: string,
  rawPatch: unknown,
  options: { previousBaseCurrencyCode: string | null; nextBaseCurrencyCode: string },
): Promise<{ ok: true } | { ok: false; error: ZodError }> {
  return prisma.$transaction(async (tx) => {
    const applied = await parseAndApplyCollectorPreferencesPatch(userId, rawPatch, tx);
    if (!applied.ok) {
      return applied;
    }

    if (options.previousBaseCurrencyCode !== options.nextBaseCurrencyCode) {
      await flagOrdersForFxReconciliation(userId, options.nextBaseCurrencyCode, tx);
      await flagDeliveriesForFxReconciliation(userId, options.nextBaseCurrencyCode, tx);
    }

    return applied;
  });
}
