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
