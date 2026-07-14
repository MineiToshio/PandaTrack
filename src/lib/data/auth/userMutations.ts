import { prisma } from "@/lib/prisma";

/**
 * Updates the user's canonical username. Rate limiting and format validation are the caller's responsibility.
 */
export async function updateUserUsername(userId: string, normalizedUsername: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { username: normalizedUsername },
  });
}

/**
 * Updates the user's display name (`User.name`).
 */
export async function updateUserDisplayName(userId: string, name: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { name },
  });
}

/**
 * Updates the user's avatar URL (`User.image`). Pass `null` to clear the avatar.
 */
export async function updateUserImage(userId: string, imageUrl: string | null): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { image: imageUrl },
  });
}

/**
 * Persists the collector's explicit UI language choice (`User.locale`).
 */
export async function updateUserLocale(userId: string, locale: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { locale },
  });
}

/**
 * Stores the locale a collector is browsing with, but only while `User.locale` is still
 * empty. The conditional `updateMany` makes this a single atomic write: an existing value
 * always belongs to the collector's own language choice and is never overwritten.
 */
export async function captureUserLocaleIfUnset(userId: string, locale: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, locale: null },
    data: { locale },
  });
}

/**
 * Persists the collector's IANA timezone (`User.timezone`). The caller is responsible for
 * validating the value against the runtime's zone database before it reaches this writer.
 */
export async function updateUserTimezone(userId: string, timezone: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { timezone },
  });
}

/**
 * Stamps the `usernameChangedAt` timestamp after a successful username change.
 */
export async function updateUserUsernameChangedAt(userId: string, changedAt: Date): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { usernameChangedAt: changedAt },
  });
}

/**
 * Clears `User.unverifiedGraceStartsAt` after a successful email verification.
 * Called from the Better Auth `afterEmailVerification` hook.
 */
export async function clearUnverifiedGraceStartsAt(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { unverifiedGraceStartsAt: null },
  });
}

/**
 * Atomically applies an email change:
 * 1. Updates `User.email`, resets `emailVerified`, and stamps `unverifiedGraceStartsAt`.
 * 2. Keeps the credential provider's `accountId` in sync with the new email.
 *
 * Caller is responsible for catching `P2002` unique constraint violations and mapping them to
 * a user-facing "email taken" error.
 */
export async function applyEmailChangeTransaction(userId: string, newEmail: string, now: Date): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        emailVerified: false,
        unverifiedGraceStartsAt: now,
      },
    });
    await tx.account.updateMany({
      where: { userId, providerId: "credential" },
      data: { accountId: newEmail },
    });
  });
}
