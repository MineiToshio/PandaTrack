"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getCollectorPreferencesSnapshot, parseAndApplyCollectorPreferencesPatch } from "@/queries/userSettings";

export type PreferencesErrorCode = "unauthorized" | "validation" | "generic";

export type SavePreferencesResult = { ok: true } | { ok: false; error: PreferencesErrorCode };

type PreferencesPayload = {
  preferredCountryCode: string | null;
  baseCurrencyCode: string | null;
  preferredProductTypeKeys: string[];
  budgetAmount: number | null;
  budgetResetDayOfMonth: number | null;
};

/**
 * Persists collector preferences (FR-07-20–FR-07-26, FR-07-32).
 * Delegates parsing, validation, and atomic persistence to the data layer.
 * Currency-change confirmation is enforced on the client before calling this action.
 */
export async function savePreferencesAction(payload: PreferencesPayload): Promise<SavePreferencesResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  try {
    const result = await parseAndApplyCollectorPreferencesPatch(session.user.id, {
      preferredCountryCode: payload.preferredCountryCode,
      baseCurrencyCode: payload.baseCurrencyCode,
      budgetAmount: payload.budgetAmount,
      budgetResetDayOfMonth: payload.budgetResetDayOfMonth,
      preferredProductTypeKeys: payload.preferredProductTypeKeys,
    });

    if (!result.ok) {
      return { ok: false, error: "validation" };
    }

    return { ok: true };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { action: "savePreferencesAction", userId: session.user.id },
    });
    return { ok: false, error: "generic" };
  }
}

export type PreferencesSnapshot = {
  preferredCountryCode: string | null;
  baseCurrencyCode: string | null;
  budgetAmount: number | null;
  budgetResetDayOfMonth: number | null;
  preferredProductTypeKeys: string[];
};

/**
 * Loads the current collector preferences for the settings page.
 */
export async function getPreferencesSnapshotAction(): Promise<PreferencesSnapshot | null> {
  const session = await getSession();
  if (!session?.user?.id) {
    return null;
  }

  const snapshot = await getCollectorPreferencesSnapshot(session.user.id);
  if (!snapshot) {
    return null;
  }

  return {
    preferredCountryCode: snapshot.preferredCountryCode,
    baseCurrencyCode: snapshot.baseCurrencyCode,
    budgetAmount: snapshot.budgetAmount,
    budgetResetDayOfMonth: snapshot.budgetResetDayOfMonth,
    preferredProductTypeKeys: snapshot.preferredProductTypeKeys,
  };
}
