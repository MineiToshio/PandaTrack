import { z } from "zod";
import { MAX_MONTHLY_PHOTO_LIMIT_OVERRIDE } from "@/lib/imageIntake/constants";

/** Shortest reason that says anything; the trail is worthless with a blank note. */
const REASON_MIN_LENGTH = 3;
export const OVERRIDE_REASON_MAX_LENGTH = 280;

/**
 * Boundary schema for the quota override console.
 *
 * `limit` is `null` to clear the override and hand the account back to the product default, and a
 * whole number otherwise. `reason` is required rather than optional: this changes another person's
 * allowance without telling them, so the trail must always say why.
 */
export const setImageIntakeQuotaOverrideSchema = z.object({
  targetUserId: z.string().min(1),
  limit: z.number().int().min(0).max(MAX_MONTHLY_PHOTO_LIMIT_OVERRIDE).nullable(),
  reason: z.string().trim().min(REASON_MIN_LENGTH).max(OVERRIDE_REASON_MAX_LENGTH),
});

export type SetImageIntakeQuotaOverrideInput = z.infer<typeof setImageIntakeQuotaOverrideSchema>;
