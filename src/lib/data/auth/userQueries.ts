import { prisma } from "@/lib/prisma";

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
export async function findUserIdByUsername(normalizedUsername: string): Promise<UserIdRow | null> {
  return prisma.user.findUnique({
    where: { username: normalizedUsername },
    select: { id: true },
  });
}

/**
 * Finds any user with the given email, excluding the provided user id.
 * Used to detect collisions when a user attempts to change their email.
 */
export async function findUserIdByEmailExcluding(
  email: string,
  excludeUserId: string,
): Promise<UserIdRow | null> {
  return prisma.user.findFirst({
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
export async function getUserProfileSnapshot(userId: string): Promise<UserProfileSnapshot | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, name: true, image: true },
  });
}

/**
 * Reads the `usernameChangedAt` timestamp used by the username change cooldown policy.
 * Returns `null` when the user does not exist.
 */
export async function findUsernameChangedAt(userId: string): Promise<UsernameChangeCooldownRow | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { usernameChangedAt: true },
  });
}

/**
 * Loads the user surface needed to derive the email-verification access state
 * (user row + linked providers). Returns `null` when the user does not exist.
 */
export async function findUserVerificationSnapshot(userId: string): Promise<UserVerificationSnapshotRow | null> {
  return prisma.user.findUnique({
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
