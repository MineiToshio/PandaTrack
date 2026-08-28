"use server";

import * as Sentry from "@sentry/nextjs";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { AdminAccessError, requireAdmin } from "@/lib/auth/auth-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { voidUserProgressionPoints } from "@/lib/data/progression/progressionMutations";
import { voidProgressionPointsSchema } from "../_schemas/voidProgressionPointsSchema";

export type VoidProgressionPointsResult =
  | { success: true; voidedEntryCount: number; maturedPoints: number; highestRankIndex: number }
  | { success: false; error: string };

/**
 * Voids every live point a collector holds, from the admin console.
 *
 * `requireAdmin()` is the real boundary. The route gate and the nav entry are presentation, and this
 * action is independently reachable, so it gates again on its own. It is also the component that
 * establishes `actorId`: the mutation documents that it takes that value on trust, so it is read
 * from the verified session and never from the request payload.
 *
 * The reversal, the recompute and the audit row all commit inside the mutation's single
 * transaction. `AUDIT_WRITE_FAILED` means the whole void rolled back, so it is mapped to a refusal
 * here rather than to a success: a reversal nobody can trace back to an administrator is exactly
 * what that rollback exists to prevent.
 */
export async function voidProgressionPointsAction(input: unknown): Promise<VoidProgressionPointsResult> {
  try {
    const session = await requireAdmin();
    const parsed = voidProgressionPointsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "validation_failed" };
    }

    const result = await voidUserProgressionPoints({
      actorId: session.user.id,
      targetUserId: parsed.data.targetUserId,
      reason: parsed.data.reason,
    });

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.ADMIN.PROGRESSION_POINTS_VOIDED,
      // Identifiers and counts only: the free-text reason belongs to the audit trail, never here.
      properties: {
        target_user_id: parsed.data.targetUserId,
        voided_entry_count: result.voidedEntryCount,
        matured_points: result.maturedPoints,
      },
    });

    // The console re-reads itself through `router.refresh()` on success, so there is no cached route
    // to invalidate here.
    return {
      success: true,
      voidedEntryCount: result.voidedEntryCount,
      maturedPoints: result.maturedPoints,
      highestRankIndex: result.highestRankIndex,
    };
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return { success: false, error: "unauthorized" };
    }
    Sentry.captureException(error, { tags: { feature: "progression", action: "voidPoints" } });
    return { success: false, error: "voidFailed" };
  }
}
