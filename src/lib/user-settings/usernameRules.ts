import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/lib/user-settings/usernameConstants";

/** Full-username reserved handles (case-insensitive). */
export const RESERVED_USERNAMES = new Set(["admin", "help", "pandatrack", "root", "support", "system", "team"]);

/**
 * Tokens that must not appear as whole hyphen-separated segments of a username.
 * Avoids broad substring matching (FR-07-11, BR-07-11).
 */
export const USERNAME_BLOCKED_SEGMENTS = new Set([
  "fuck",
  "nazi",
  "nigga",
  "nigger",
  "porn",
  "rape",
  "shit",
  "slut",
  "whore",
]);

const USERNAME_ALLOWED_PATTERN = /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/;

export type UsernameValidationFailure =
  | "USERNAME_FORMAT"
  | "USERNAME_LENGTH"
  | "USERNAME_RESERVED"
  | "USERNAME_BLOCKED_SEGMENT";

export type UsernameValidationResult = { ok: true; username: string } | { ok: false; reason: UsernameValidationFailure };

export function normalizeUsernameForUniqueness(username: string): string {
  return username.trim().toLowerCase();
}

export function getUsernameSegments(normalizedUsername: string): string[] {
  return normalizedUsername.split("-").filter(Boolean);
}

export function isReservedUsernameNormalized(normalized: string): boolean {
  return RESERVED_USERNAMES.has(normalized);
}

export function usernameContainsBlockedSegment(normalized: string): boolean {
  const segments = getUsernameSegments(normalized);
  return segments.some((segment) => USERNAME_BLOCKED_SEGMENTS.has(segment));
}

/**
 * Validates a collector username candidate (format, length, reserved, blocked segments).
 * Returns the canonical lowercase username when valid.
 */
export function validateUsernameCandidate(raw: string): UsernameValidationResult {
  const username = normalizeUsernameForUniqueness(raw);

  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return { ok: false, reason: "USERNAME_LENGTH" };
  }

  if (!USERNAME_ALLOWED_PATTERN.test(username)) {
    return { ok: false, reason: "USERNAME_FORMAT" };
  }

  if (isReservedUsernameNormalized(username)) {
    return { ok: false, reason: "USERNAME_RESERVED" };
  }

  if (usernameContainsBlockedSegment(username)) {
    return { ok: false, reason: "USERNAME_BLOCKED_SEGMENT" };
  }

  return { ok: true, username };
}
