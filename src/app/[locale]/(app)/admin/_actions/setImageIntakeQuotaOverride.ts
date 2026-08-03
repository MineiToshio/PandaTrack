"use server";

import * as Sentry from "@sentry/nextjs";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { AdminAccessError, requireAdmin } from "@/lib/auth/auth-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import {
  ImageIntakeQuotaOverrideError,
  setImageIntakeQuotaOverride,
} from "@/lib/data/imageIntake/imageIntakeQuotaMutations";
import { setImageIntakeQuotaOverrideSchema } from "../_schemas/imageIntakeQuotaOverrideSchema";

export type SetImageIntakeQuotaOverrideResult = { success: true } | { success: false; error: string };

/**
 * Sets or clears one collector's monthly photo allowance from the moderation console.
 *
 * `requireAdmin()` is the real boundary; the nav entry and the route gate are presentation. The
 * audit row is written inside the same transaction as the change (see the mutation), so this action
 * cannot leave a change without a trail even if it fails afterwards.
 */
export async function setImageIntakeQuotaOverrideAction(input: unknown): Promise<SetImageIntakeQuotaOverrideResult> {
  try {
    const session = await requireAdmin();
    const parsed = setImageIntakeQuotaOverrideSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "validation_failed" };
    }

    const result = await setImageIntakeQuotaOverride({
      actorId: session.user.id,
      targetUserId: parsed.data.targetUserId,
      limit: parsed.data.limit,
      reason: parsed.data.reason,
    });

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.IMAGE_INTAKE.ADMIN_QUOTA_OVERRIDE_SET,
      // Identifiers and figures only: the free-text reason lives in the audit trail, never here.
      properties: {
        target_user_id: result.targetUserId,
        previous_limit: result.previousLimit,
        photo_limit: result.limit,
      },
    });

    // The console re-reads itself through `router.refresh()` on success, so there is no cached
    // route to invalidate here.
    return { success: true };
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return { success: false, error: "unauthorized" };
    }
    if (error instanceof ImageIntakeQuotaOverrideError) {
      return { success: false, error: error.code };
    }
    Sentry.captureException(error, { tags: { feature: "imageIntake", action: "setQuotaOverride" } });
    return { success: false, error: "overrideFailed" };
  }
}
