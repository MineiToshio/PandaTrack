/**
 * Pure quota arithmetic for the monthly AI-photo bag: period and day keys, the effective monthly
 * limit, the remaining balance, and the renewal date the exhausted copy states.
 *
 * Deliberately free of Prisma and of any I/O, so the reservation path (`src/lib/data/imageIntake/`)
 * and the passive counter shown on every create surface share one definition of "which month is
 * this" and "how many photos are left" instead of each deriving it again.
 */

import { DEFAULT_MONTHLY_PHOTO_QUOTA } from "./constants";

/** Billing period a moment belongs to, `YYYY-MM` in UTC. Reset is implicit in this key: no job resets anything. */
export function formatPeriodKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** Calendar day a moment belongs to, `YYYY-MM-DD` in UTC, backing the anti-burst daily cap. */
export function formatDayKey(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${formatPeriodKey(date)}-${day}`;
}

/** First instant of the period after the one `date` falls in: the moment the bag refills. */
export function nextPeriodStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

/**
 * Monthly ceiling actually enforced for one collector. `null` means uncapped, which is the case
 * for administrators: they have no photo cap, though their consumption is still recorded and the
 * global spend cut-off still applies to them.
 */
export function resolveEffectiveMonthlyLimit(params: { isAdmin: boolean; override: number | null }): number | null {
  if (params.isAdmin) return null;
  if (params.override !== null && Number.isInteger(params.override) && params.override >= 0) {
    return params.override;
  }
  return DEFAULT_MONTHLY_PHOTO_QUOTA;
}

/** Photos left in the bag, never negative. `null` (uncapped) stays `null`. */
export function computeRemainingPhotos(limit: number | null, usedPhotos: number): number | null {
  if (limit === null) return null;
  return Math.max(0, limit - usedPhotos);
}

/**
 * What every quota surface reads: the counter on the method selector, the passive counter and the
 * overflow banner on the upload screen, and the exhausted state.
 *
 * `limit` and `remaining` are `null` together and only for an uncapped collector, in which case no
 * counter line is rendered at all rather than a placeholder number.
 */
export type ImageIntakeQuotaSnapshot = {
  limit: number | null;
  usedPhotos: number;
  remaining: number | null;
  periodKey: string;
  /** ISO instant the bag refills on, for the renewal date the exhausted copy states. */
  renewalAtIso: string;
};

/**
 * How many photos the collector must remove for the batch to fit, or `null` when it already fits
 * (or when no cap applies). This is the only interruption in the whole quota system, so it is
 * expressed as the number the copy states back rather than as a bare boolean.
 */
export function computePhotoOverflow(attachedCount: number, remaining: number | null): number | null {
  if (remaining === null) return null;
  const excess = attachedCount - remaining;
  return excess > 0 ? excess : null;
}

/** Assembles the snapshot from the two stored facts (override, photos used) plus the current instant. */
export function buildQuotaSnapshot(params: {
  isAdmin: boolean;
  override: number | null;
  usedPhotos: number;
  now: Date;
}): ImageIntakeQuotaSnapshot {
  const limit = resolveEffectiveMonthlyLimit({ isAdmin: params.isAdmin, override: params.override });
  return {
    limit,
    usedPhotos: params.usedPhotos,
    remaining: computeRemainingPhotos(limit, params.usedPhotos),
    periodKey: formatPeriodKey(params.now),
    renewalAtIso: nextPeriodStart(params.now).toISOString(),
  };
}
