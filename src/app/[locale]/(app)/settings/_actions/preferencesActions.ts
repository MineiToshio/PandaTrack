"use server";

import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import {
  applyBaseCurrencyChange,
  getCollectorPreferencesSnapshot,
  parseAndApplyCollectorPreferencesPatch,
} from "@/queries/userSettings";
import { routing } from "@/i18n/routing";

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
    const patch = {
      preferredCountryCode: payload.preferredCountryCode,
      baseCurrencyCode: payload.baseCurrencyCode,
      budgetAmount: payload.budgetAmount,
      budgetResetDayOfMonth: payload.budgetResetDayOfMonth,
      preferredProductTypeKeys: payload.preferredProductTypeKeys,
    };

    // A base-currency change must always flag stale-rate orders in the same transaction,
    // even when it arrives through this generic action instead of updateCurrencyAction —
    // otherwise a crafted payload could switch currency and leave conversions silently stale.
    const current = await getCollectorPreferencesSnapshot(session.user.id);
    if (!current) {
      return { ok: false, error: "unauthorized" };
    }

    const result =
      payload.baseCurrencyCode && payload.baseCurrencyCode !== current.baseCurrencyCode
        ? await applyBaseCurrencyChange(session.user.id, patch, {
            previousBaseCurrencyCode: current.baseCurrencyCode,
            nextBaseCurrencyCode: payload.baseCurrencyCode,
          })
        : await parseAndApplyCollectorPreferencesPatch(session.user.id, patch);

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

export type UpdateCurrencyInput = {
  baseCurrencyCode: string;
  /** Two-path flag (P-S8-01 / FR-07-32). When true, the client should be routed to the FX reconciliation flow afterwards. */
  saveFxRates: boolean;
};

export type UpdateCurrencyResult =
  | { ok: true; redirectToFxReconcile: boolean }
  | { ok: false; error: PreferencesErrorCode };

/**
 * Persists the base currency change (FR-07-32 two-path). Path B (`saveFxRates: true`) does
 * not run a bulk FX reconciliation here — it signals the client to redirect into the existing
 * `FxReconciliationModal` flow on `/orders`, where the user can preview and confirm per-row.
 *
 * Rationale (S8 Fase B research synthesis): silent bulk mutation from a Settings modal
 * erodes user trust and conflicts with the Splitwise/Toshl regret pattern. Centralizing
 * reconciliation in the orders modal honors transparent-automation expectations for the
 * 18–25 collector audience and avoids partial-failure errors landing on the wrong surface.
 */
export async function updateCurrencyAction(input: UpdateCurrencyInput): Promise<UpdateCurrencyResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  const trimmed = input.baseCurrencyCode.trim().toUpperCase();
  if (!trimmed || trimmed.length !== 3) {
    return { ok: false, error: "validation" };
  }

  try {
    const current = await getCollectorPreferencesSnapshot(session.user.id);
    if (!current) {
      return { ok: false, error: "unauthorized" };
    }

    // Persist the base-currency change and flag stale-rate orders for FX reconciliation atomically,
    // so we never leave the user with a new base currency but stale, unflagged order rates.
    const result = await applyBaseCurrencyChange(
      session.user.id,
      {
        preferredCountryCode: current.preferredCountryCode,
        baseCurrencyCode: trimmed,
        budgetAmount: current.budgetAmount,
        budgetResetDayOfMonth: current.budgetResetDayOfMonth,
        preferredProductTypeKeys: current.preferredProductTypeKeys,
      },
      { previousBaseCurrencyCode: current.baseCurrencyCode, nextBaseCurrencyCode: trimmed },
    );

    if (!result.ok) {
      return { ok: false, error: "validation" };
    }

    return { ok: true, redirectToFxReconcile: input.saveFxRates };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { action: "updateCurrencyAction", userId: session.user.id },
    });
    return { ok: false, error: "generic" };
  }
}

export type UpdateLanguageResult = { ok: true; locale: "es" | "en" } | { ok: false; error: PreferencesErrorCode };

const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Persists the preferred UI language (FR-07-23 / P-S8-02). Stored in the `NEXT_LOCALE`
 * cookie consumed by next-intl. The client navigates to the localized URL after success.
 */
export async function updateLanguageAction(locale: string): Promise<UpdateLanguageResult> {
  if (locale !== "es" && locale !== "en") {
    return { ok: false, error: "validation" };
  }

  if (!routing.locales.includes(locale)) {
    return { ok: false, error: "validation" };
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: LOCALE_COOKIE_NAME,
    value: locale,
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
  });

  return { ok: true, locale };
}
