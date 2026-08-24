import { z } from "zod";

/** Shortest reason that says anything; a blank note leaves the trail worthless. */
const REASON_MIN_LENGTH = 3;
export const VOID_REASON_MAX_LENGTH = 280;

/**
 * Boundary schema for the administrative point void.
 *
 * There is no scope field, and that is the shipped behaviour rather than an omission: the mutation
 * voids every live entry the collector holds. A reason is required here as well as inside the
 * mutation, so a blank one is refused before a transaction is ever opened; `.trim()` runs first so
 * whitespace cannot pass for an explanation.
 */
export const voidProgressionPointsSchema = z.object({
  targetUserId: z.string().min(1),
  reason: z.string().trim().min(REASON_MIN_LENGTH).max(VOID_REASON_MAX_LENGTH),
});

export type VoidProgressionPointsInput = z.infer<typeof voidProgressionPointsSchema>;
