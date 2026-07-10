import { prisma } from "@/lib/prisma";
import { findUsernameChangedAt, updateUserUsernameChangedAt } from "@/queries/user";

export const USERNAME_CHANGE_COOLDOWN_DAYS = 7;

export function isWithinUsernameChangeCooldown(usernameChangedAt: Date, now: Date, windowDays: number): boolean {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return now.getTime() - usernameChangedAt.getTime() < windowMs;
}

export async function assertUsernameChangeCooldownAllows(
  userId: string,
  now: Date,
): Promise<{ ok: true } | { ok: false; retryAfterIso: string }> {
  const row = await findUsernameChangedAt(prisma, userId);

  if (!row?.usernameChangedAt) {
    return { ok: true };
  }

  if (!isWithinUsernameChangeCooldown(row.usernameChangedAt, now, USERNAME_CHANGE_COOLDOWN_DAYS)) {
    return { ok: true };
  }

  const retryAt = new Date(row.usernameChangedAt.getTime() + USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  return { ok: false, retryAfterIso: retryAt.toISOString() };
}

/**
 * Records a successful username change for rate limiting.
 */
export async function recordSuccessfulUsernameChange(userId: string, now: Date): Promise<void> {
  await updateUserUsernameChangedAt(prisma, userId, now);
}
