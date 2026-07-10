import type { Prisma } from "../../generated/prisma/client";
import { cache } from "react";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { flagOrdersForFxReconciliation } from "@/lib/data/orders/orderMutations";
import { flagDeliveriesForFxReconciliation } from "@/lib/data/deliveries/deliveryMutations";
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

export type AppShellUserIdentitySnapshot = {
  username: string;
  name: string | null;
  image: string | null;
};

export type SettingsPageSnapshot = {
  email: string;
  emailVerified: boolean;
  username: string;
  name: string;
  image: string | null;
  preferredCountryCode: string | null;
  baseCurrencyCode: string | null;
  budgetAmount: number | null;
  budgetResetDayOfMonth: number | null;
  preferredProductTypeKeys: string[];
  /** Timestamp of the last username change. Drives the 7-day cooldown chip. */
  usernameChangedAt: Date | null;
  /** Timestamp of the credential account's last update. Approximates password last-changed. Null when the user has no credential provider. */
  passwordChangedAt: Date | null;
};

/**
 * Loads the user identity surface needed by the private app shell.
 */
export async function getAppShellUserIdentity(userId: string): Promise<AppShellUserIdentitySnapshot | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      name: true,
      image: true,
    },
  });

  if (!row) {
    return null;
  }

  return {
    username: row.username,
    name: row.name,
    image: row.image,
  };
}

/**
 * Loads the combined surface (identity + account + preferences) needed by the settings page.
 * Consolidates all settings fields into a single round-trip.
 */
export async function getSettingsPageSnapshot(userId: string): Promise<SettingsPageSnapshot | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      emailVerified: true,
      username: true,
      name: true,
      image: true,
      preferredCountryCode: true,
      baseCurrencyCode: true,
      budgetAmount: true,
      budgetResetDayOfMonth: true,
      usernameChangedAt: true,
      preferredProductTypes: { select: { productTypeKey: true }, orderBy: { productTypeKey: "asc" } },
      accounts: {
        where: { providerId: "credential" },
        select: { updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!row) {
    return null;
  }

  return {
    email: row.email,
    emailVerified: row.emailVerified,
    username: row.username,
    name: row.name,
    image: row.image,
    preferredCountryCode: row.preferredCountryCode,
    baseCurrencyCode: row.baseCurrencyCode,
    budgetAmount: row.budgetAmount,
    budgetResetDayOfMonth: row.budgetResetDayOfMonth,
    preferredProductTypeKeys: row.preferredProductTypes.map((rowItem) => rowItem.productTypeKey),
    usernameChangedAt: row.usernameChangedAt,
    passwordChangedAt: row.accounts[0]?.updatedAt ?? null,
  };
}

/**
 * Loads persisted collector preferences and preferred product type keys for settings consumers.
 * Wrapped in `cache()` because the (app) layout, the dashboard page, and the dashboard data
 * layer each need this snapshot within the same request; React dedupes the read across all of them.
 */
export const getCollectorPreferencesSnapshot = cache(
  async (userId: string): Promise<CollectorPreferencesSnapshot | null> => {
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
  },
);

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
