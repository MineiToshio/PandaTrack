import { RESERVED_USERNAMES, USERNAME_BLOCKED_SEGMENTS } from "@/lib/user-settings/usernameRules";

export const DISPLAY_NAME_MAX_LENGTH = 50;

export type DisplayNameValidationFailure =
  | "DISPLAY_NAME_EMPTY"
  | "DISPLAY_NAME_TOO_LONG"
  | "DISPLAY_NAME_RESERVED"
  | "DISPLAY_NAME_BLOCKED_SEGMENT";

export type DisplayNameValidationResult =
  | { ok: true; name: string }
  | { ok: false; reason: DisplayNameValidationFailure };

/**
 * Splits a normalized display name into word tokens for blocked-segment checking.
 * Splits on any non-alphanumeric character to avoid substring false positives (FR-07-11, BR-07-12).
 */
function getDisplayNameTokens(normalized: string): string[] {
  return normalized.split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Validates a display name candidate.
 * Rules: trim, max 50 chars, same reserved-name/brand/blocked-token protections as username,
 * but more permissive about spaces and punctuation (BR-07-12).
 *
 * Returns the trimmed display name when valid.
 */
export function validateDisplayNameCandidate(raw: string): DisplayNameValidationResult {
  const name = raw.trim();

  if (name.length === 0) {
    return { ok: false, reason: "DISPLAY_NAME_EMPTY" };
  }

  if (name.length > DISPLAY_NAME_MAX_LENGTH) {
    return { ok: false, reason: "DISPLAY_NAME_TOO_LONG" };
  }

  const normalized = name.toLowerCase();

  if (RESERVED_USERNAMES.has(normalized)) {
    return { ok: false, reason: "DISPLAY_NAME_RESERVED" };
  }

  const tokens = getDisplayNameTokens(normalized);
  if (tokens.some((token) => USERNAME_BLOCKED_SEGMENTS.has(token))) {
    return { ok: false, reason: "DISPLAY_NAME_BLOCKED_SEGMENT" };
  }

  return { ok: true, name };
}
