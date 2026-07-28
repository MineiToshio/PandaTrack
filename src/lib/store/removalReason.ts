import type { StoreRemovalReason } from "../../../generated/prisma/client";

/**
 * The four moderator-facing removal categories, split into neutral reasons and the single sanction
 * reason. The distinction drives whether a removed store renders neutral or sanction wording on the
 * order-side tombstone. Kept here (not in the store data layer) so both the store moderation
 * mutations and the order domain can import it without coupling.
 */
export const NEUTRAL_STORE_REMOVAL_REASONS = [
  "DUPLICATE",
  "CLOSED_OR_INACTIVE",
  "FALSE_INFO",
] as const satisfies readonly StoreRemovalReason[];

export const SANCTION_STORE_REMOVAL_REASONS = ["ABUSE"] as const satisfies readonly StoreRemovalReason[];

export const STORE_REMOVAL_REASONS = [
  ...NEUTRAL_STORE_REMOVAL_REASONS,
  ...SANCTION_STORE_REMOVAL_REASONS,
] as const satisfies readonly StoreRemovalReason[];

/** Value-derived union equal to the Prisma `StoreRemovalReason` enum, for client code that should
 * not import the generated client. */
export type StoreRemovalReasonValue = (typeof STORE_REMOVAL_REASONS)[number];

/**
 * True when the removal reason represents a sanction (abuse, scam, or fraud) rather than a neutral
 * administrative reason. Consumers use this to choose sanction vs neutral wording; it never exposes
 * report free text or reporter identity.
 */
export function isSanctionRemovalReason(reason: StoreRemovalReason): boolean {
  return reason === "ABUSE";
}
