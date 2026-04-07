import type { Prisma } from "../../generated/prisma/client";
import { validateUsernameCandidate } from "@/lib/user-settings/usernameRules";

type TestUserMinimal = {
  id: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
};

function buildUniqueTestUsername(email: string): { username: string } {
  const local = email
    .split("@")[0]
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);
  const entropy = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const base = (local && local.length >= 2 ? local : "user") + entropy;
  const candidate = base.slice(0, 30);
  const validated = validateUsernameCandidate(candidate);
  if (validated.ok) {
    return {
      username: validated.username,
    };
  }
  const fallback = `u${Date.now().toString(36)}x${Math.random().toString(36).slice(2, 6)}`.slice(0, 30);
  const again = validateUsernameCandidate(fallback);
  if (!again.ok) {
    throw new Error("Failed to build valid test username");
  }
  return { username: again.username };
}

/**
 * Prisma payload for creating a test `User` row (includes required username fields).
 */
export function createTestUserData(input: TestUserMinimal): Prisma.UserCreateInput {
  const now = new Date();
  const { username } = buildUniqueTestUsername(input.email);
  return {
    id: input.id,
    email: input.email,
    name: input.name ?? "Test User",
    emailVerified: input.emailVerified ?? true,
    username,
    createdAt: now,
    updatedAt: now,
  };
}
