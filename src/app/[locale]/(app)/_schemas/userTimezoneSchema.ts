import { z } from "zod";

/** Longest IANA zone identifier in the tz database is well under this; a crafted value is rejected early. */
const MAX_TIMEZONE_LENGTH = 64;

/** Character set of the tz database identifiers (`America/Argentina/Buenos_Aires`, `Etc/GMT+3`). */
const TIMEZONE_CHARACTER_PATTERN = /^[A-Za-z0-9+_/-]+$/;

/**
 * True when the runtime's own time zone database recognizes the value. This is the authoritative
 * check: it is the same database every consumer of the stored value formats against, so a value
 * that passes here can never break a reminder window or a dashboard period.
 */
export function isSupportedTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * A timezone reported by a browser. It arrives from the client and is therefore never trusted:
 * shape and length are guarded first, then the value must resolve against the runtime's zone
 * database before it can reach the database.
 */
export const userTimezoneSchema = z
  .string()
  .trim()
  .min(1, { message: "TIMEZONE_REQUIRED" })
  .max(MAX_TIMEZONE_LENGTH, { message: "TIMEZONE_TOO_LONG" })
  .regex(TIMEZONE_CHARACTER_PATTERN, { message: "TIMEZONE_INVALID" })
  .refine(isSupportedTimeZone, { message: "TIMEZONE_INVALID" });

export type UserTimezoneInput = z.infer<typeof userTimezoneSchema>;
