import { prisma } from "@/lib/prisma";

export const USERNAME_CHANGE_COOLDOWN_DAYS = 7;

export function isWithinUsernameChangeCooldown(usernameChangedAt: Date, now: Date, windowDays: number): boolean {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return now.getTime() - usernameChangedAt.getTime() < windowMs;
}

export async function assertUsernameChangeCooldownAllows(
  userId: string,
  now: Date,
): Promise<{ ok: true } | { ok: false; retryAfterIso: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { usernameChangedAt: true },
  });

  if (!user?.usernameChangedAt) {
    return { ok: true };
  }

  if (!isWithinUsernameChangeCooldown(user.usernameChangedAt, now, USERNAME_CHANGE_COOLDOWN_DAYS)) {
    return { ok: true };
  }

  const retryAt = new Date(user.usernameChangedAt.getTime() + USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  return { ok: false, retryAfterIso: retryAt.toISOString() };
}

/**
 * Records a successful username change for rate limiting (FR-07-33, BR-07-18).
 */
export async function recordSuccessfulUsernameChange(userId: string, now: Date): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { usernameChangedAt: now },
  });
}
