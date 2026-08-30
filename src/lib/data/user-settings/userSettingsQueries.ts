import { cache } from "react";
import { prisma } from "@/lib/prisma";

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

export type UserCurrencyContext = {
  baseCurrencyCode: string | null;
  timezone: string | null;
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
 * Loads the currency + timezone pair pages need to render money and civil-day comparisons
 * (order/delivery create, detail, and edit pages, plus the delivery create/edit Server Actions).
 * Kept as one query so callers that only need `baseCurrencyCode` and callers that also need
 * `timezone` share a single data-layer function instead of nine inline `prisma.user.findUnique`
 * calls with slightly different selects.
 */
export async function getUserCurrencyContext(userId: string): Promise<UserCurrencyContext | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { baseCurrencyCode: true, timezone: true },
  });

  if (!row) {
    return null;
  }

  return {
    baseCurrencyCode: row.baseCurrencyCode,
    timezone: row.timezone,
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
