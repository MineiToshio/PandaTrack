import * as Sentry from "@sentry/nextjs";
import type { PrismaClient } from "../../../generated/prisma/client";
import {
  USERNAME_GENERATION_MAX_ATTEMPTS,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/user-settings/usernameConstants";
import { validateUsernameCandidate, normalizeUsernameForUniqueness } from "@/lib/user-settings/usernameRules";
import { findUserIdByUsername } from "@/queries/user";

function randomAlphanumericSuffix(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/**
 * Normalizes an email local part toward the allowed username charset.
 */
export function normalizeEmailLocalPartForUsernameBase(localPart: string): string {
  const lower = localPart.trim().toLowerCase();
  const replaced = lower.replace(/[^a-z0-9]+/g, "-");
  const collapsed = replaced.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return collapsed;
}

function buildCandidateBaseFromEmailLocalPart(localPart: string): string {
  const normalized = normalizeEmailLocalPartForUsernameBase(localPart);
  if (normalized.length >= USERNAME_MIN_LENGTH) {
    return normalized.slice(0, USERNAME_MAX_LENGTH);
  }
  return "collector";
}

function attachSuffix(base: string, suffix: string): string {
  const connector = base.endsWith("-") ? "" : "-";
  const combined = `${base}${connector}${suffix}`;
  if (combined.length <= USERNAME_MAX_LENGTH) {
    return combined;
  }
  const maxBaseLen = USERNAME_MAX_LENGTH - connector.length - suffix.length;
  if (maxBaseLen < USERNAME_MIN_LENGTH) {
    return suffix.slice(0, USERNAME_MAX_LENGTH);
  }
  const trimmedBase = base.slice(0, maxBaseLen).replace(/-+$/g, "");
  if (trimmedBase.length < USERNAME_MIN_LENGTH) {
    return `${trimmedBase}${connector}${suffix}`.slice(0, USERNAME_MAX_LENGTH);
  }
  return `${trimmedBase}${connector}${suffix}`;
}

async function isUsernameAvailable(db: PrismaClient, username: string): Promise<boolean> {
  const existing = await findUserIdByUsername(db, username);
  return existing === null;
}

function buildFallbackUsername(): string {
  const suffix = randomAlphanumericSuffix(12);
  const candidate = `u-${suffix}`;
  return candidate.slice(0, USERNAME_MAX_LENGTH);
}

/**
 * Generates a unique username for a newly created account (FR-07-07).
 * Collision-safe because usernames are persisted in canonical lowercase form.
 */
export async function generateUniqueUsernameForNewUser(db: PrismaClient, email: string): Promise<{ username: string }> {
  const localPart = email.includes("@") ? (email.split("@")[0] ?? "") : email;
  const base = buildCandidateBaseFromEmailLocalPart(localPart);

  for (let attempt = 0; attempt < USERNAME_GENERATION_MAX_ATTEMPTS; attempt += 1) {
    const suffix = randomAlphanumericSuffix(4);
    const rawCandidate = attachSuffix(base, suffix);
    const validated = validateUsernameCandidate(rawCandidate);
    if (!validated.ok) {
      continue;
    }
    const available = await isUsernameAvailable(db, validated.username);
    if (available) {
      return {
        username: validated.username,
      };
    }
  }

  for (let attempt = 0; attempt < USERNAME_GENERATION_MAX_ATTEMPTS; attempt += 1) {
    const rawCandidate = buildFallbackUsername();
    const validated = validateUsernameCandidate(rawCandidate);
    if (!validated.ok) {
      continue;
    }
    const available = await isUsernameAvailable(db, validated.username);
    if (available) {
      return {
        username: validated.username,
      };
    }
  }

  const error = new Error("Username generation exhausted collision retries");
  Sentry.captureException(error, { extra: { emailLocalPartLen: localPart.length } });
  throw error;
}

/**
 * Validates that a username is available for assignment (format + uniqueness).
 */
export async function isUsernameNormalizedTaken(db: PrismaClient, normalized: string): Promise<boolean> {
  const row = await findUserIdByUsername(db, normalizeUsernameForUniqueness(normalized));
  return row !== null;
}

export async function isUsernameTaken(db: PrismaClient, username: string): Promise<boolean> {
  return isUsernameNormalizedTaken(db, username);
}
