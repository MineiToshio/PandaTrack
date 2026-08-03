import { z } from "zod";
import { writeAuditEntry } from "@/lib/data/admin/adminAuditMutations";
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from "@/lib/data/admin/adminAuditVocabulary";
import { MAX_MONTHLY_PHOTO_LIMIT_OVERRIDE } from "@/lib/imageIntake/constants";
import { prisma } from "@/lib/prisma";

const setQuotaOverrideSchema = z.object({
  actorId: z.string().min(1),
  targetUserId: z.string().min(1),
  /** `null` clears the override and returns the account to the product default. */
  limit: z.number().int().min(0).max(MAX_MONTHLY_PHOTO_LIMIT_OVERRIDE).nullable(),
  /** Required: an override is a privileged, silent change to another account's allowance. */
  reason: z.string().trim().min(1),
});

export type SetImageIntakeQuotaOverrideInput = z.input<typeof setQuotaOverrideSchema>;

export type SetImageIntakeQuotaOverrideResult = {
  targetUserId: string;
  previousLimit: number | null;
  limit: number | null;
};

/** Raised when the account the administrator typed does not exist. */
export class ImageIntakeQuotaOverrideError extends Error {
  constructor(readonly code: "user-not-found") {
    super(code);
    this.name = "ImageIntakeQuotaOverrideError";
  }
}

/**
 * Sets or clears one collector's monthly photo override, writing the audit entry in the same
 * transaction as the change itself, so the trail can never be missing for a change that landed.
 *
 * Only the allowance moves. Photos already spent this period are left exactly as they are: raising
 * the limit gives the collector the difference immediately, and lowering it below what is already
 * spent leaves a balance of zero rather than a negative one, which the remaining-photo arithmetic
 * already clamps.
 */
export async function setImageIntakeQuotaOverride(
  input: SetImageIntakeQuotaOverrideInput,
): Promise<SetImageIntakeQuotaOverrideResult> {
  const data = setQuotaOverrideSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: data.targetUserId },
      select: { aiMonthlyPhotoLimit: true },
    });

    if (!target) {
      throw new ImageIntakeQuotaOverrideError("user-not-found");
    }

    await tx.user.update({
      where: { id: data.targetUserId },
      data: { aiMonthlyPhotoLimit: data.limit },
    });

    await writeAuditEntry(
      {
        actorId: data.actorId,
        action: AUDIT_ACTIONS.IMAGE_INTAKE_QUOTA_OVERRIDE,
        targetType: AUDIT_TARGET_TYPES.USER,
        targetId: data.targetUserId,
        reason: data.reason,
      },
      tx,
    );

    return { targetUserId: data.targetUserId, previousLimit: target.aiMonthlyPhotoLimit, limit: data.limit };
  });
}
