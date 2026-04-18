import type { PrismaClient } from "../../generated/prisma/client";

export type UserIdRow = { id: string };

export type UserProfileSnapshot = {
  username: string;
  name: string;
  image: string | null;
};

export type UsernameChangeCooldownRow = {
  usernameChangedAt: Date | null;
};

export type UserVerificationSnapshotRow = {
  id: string;
  email: string;
  createdAt: Date;
  unverifiedGraceStartsAt: Date | null;
  emailVerified: boolean;
  accounts: Array<{ providerId: string }>;
};

/**
 * Finds a user by exact username (case-sensitive, already-normalized lookup).
 * Callers normalize the username via `normalizeUsernameForUniqueness` before calling this function.
 */
export async function findUserIdByUsername(db: PrismaClient, normalizedUsername: string): Promise<UserIdRow | null> {
  return db.user.findUnique({
    where: { username: normalizedUsername },
    select: { id: true },
  });
}

/**
 * Finds any user with the given email, excluding the provided user id.
 * Used to detect collisions when a user attempts to change their email.
 */
export async function findUserIdByEmailExcluding(
  db: PrismaClient,
  email: string,
  excludeUserId: string,
): Promise<UserIdRow | null> {
  return db.user.findFirst({
    where: {
      email,
      NOT: { id: excludeUserId },
    },
    select: { id: true },
  });
}

/**
 * Returns the profile surface used by settings profile actions (`username`, `name`, `image`).
 */
export async function getUserProfileSnapshot(db: PrismaClient, userId: string): Promise<UserProfileSnapshot | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: { username: true, name: true, image: true },
  });
}

/**
 * Updates the user's canonical username. Rate limiting and format validation are the caller's responsibility.
 */
export async function updateUserUsername(db: PrismaClient, userId: string, normalizedUsername: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { username: normalizedUsername },
  });
}

/**
 * Updates the user's display name (`User.name`).
 */
export async function updateUserDisplayName(db: PrismaClient, userId: string, name: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { name },
  });
}

/**
 * Updates the user's avatar URL (`User.image`). Pass `null` to clear the avatar.
 */
export async function updateUserImage(db: PrismaClient, userId: string, imageUrl: string | null): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { image: imageUrl },
  });
}

/**
 * Reads the `usernameChangedAt` timestamp used by the username change cooldown policy.
 * Returns `null` when the user does not exist.
 */
export async function findUsernameChangedAt(
  db: PrismaClient,
  userId: string,
): Promise<UsernameChangeCooldownRow | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: { usernameChangedAt: true },
  });
}

/**
 * Stamps the `usernameChangedAt` timestamp after a successful username change.
 */
export async function updateUserUsernameChangedAt(db: PrismaClient, userId: string, changedAt: Date): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { usernameChangedAt: changedAt },
  });
}

/**
 * Clears `User.unverifiedGraceStartsAt` after a successful email verification.
 * Called from the Better Auth `afterEmailVerification` hook.
 */
export async function clearUnverifiedGraceStartsAt(db: PrismaClient, userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { unverifiedGraceStartsAt: null },
  });
}

/**
 * Loads the user surface needed to derive the email-verification access state
 * (user row + linked providers). Returns `null` when the user does not exist.
 */
export async function findUserVerificationSnapshot(
  db: PrismaClient,
  userId: string,
): Promise<UserVerificationSnapshotRow | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      createdAt: true,
      unverifiedGraceStartsAt: true,
      emailVerified: true,
      accounts: {
        select: { providerId: true },
      },
    },
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
export async function applyEmailChangeTransaction(
  db: PrismaClient,
  userId: string,
  newEmail: string,
  now: Date,
): Promise<void> {
  await db.$transaction(async (tx) => {
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
