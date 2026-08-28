"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { purgeProgressionLedger, setProgressionVisibility } from "@/lib/data/progression/progressionMutations";

/**
 * The two controls `BR-12-11` promises: the layer can be switched off, and its history can be
 * erased. Neither takes a target user; both resolve the acting collector from the session and touch
 * only rows keyed by that id, so there is no cross-user toggle or purge surface to guard.
 */

export type ProgressionSettingsErrorCode = "unauthorized" | "generic";

export type ToggleProgressionVisibilityResult = { ok: true } | { ok: false; error: ProgressionSettingsErrorCode };

/**
 * Persists `"Ocultar mi progresión"` (`FR-12-38`).
 *
 * The client applies the change in the same tick and reverts on a failure, so this action only has
 * to answer honestly. Nothing is deleted: accrual keeps running while the layer is hidden, which is
 * what lets switching it back on restore the accumulated progression rather than start from zero
 * (`AC-12-13`).
 */
export async function toggleProgressionVisibilityAction(
  hideProgression: boolean,
): Promise<ToggleProgressionVisibilityResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  try {
    await setProgressionVisibility(session.user.id, hideProgression);
    return { ok: true };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { action: "toggleProgressionVisibilityAction", userId: session.user.id },
    });
    return { ok: false, error: "generic" };
  }
}

export type PurgeProgressionLedgerActionResult =
  { ok: true; deletedEntries: number; deletedUnlocks: number } | { ok: false; error: ProgressionSettingsErrorCode };

/**
 * Erases the collector's own points history, permanently (`FR-12-46`).
 *
 * The documented exception to the repository's optimistic default: the action is irreversible, so
 * the UI awaits it behind a confirmation that states the permanence in plain words instead of
 * showing an empty album a moment before finding out the delete failed.
 */
export async function purgeProgressionLedgerAction(): Promise<PurgeProgressionLedgerActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  try {
    const result = await purgeProgressionLedger(session.user.id);
    return { ok: true, deletedEntries: result.deletedEntries, deletedUnlocks: result.deletedUnlocks };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { action: "purgeProgressionLedgerAction", userId: session.user.id },
    });
    return { ok: false, error: "generic" };
  }
}
