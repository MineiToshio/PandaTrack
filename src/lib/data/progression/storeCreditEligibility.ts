import { StoreStatus, StoreVisibility } from "../../../../generated/prisma/client";

/**
 * The one definition of "this store may credit anything".
 *
 * It lives in its own module because two very different readers need exactly the same answer: the
 * recompute, which re-derives eligibility for every ledger entry against current state, and the
 * write path, which must refuse to append the entry in the first place. If those two ever disagreed,
 * a collector would see points appear and then silently vanish, or the reverse.
 *
 * A private store and a store that is not `APPROVED` credit nothing: not the order, not the arrival,
 * not the review, not the discovery. Approval is the lock, because it is the only step a collector
 * cannot perform alone, and a private store has no counterparty anyone else can ever see.
 *
 * Who REGISTERED the store is deliberately not part of the answer. In PandaTrack the normal path is
 * that the collector registers the store they buy from, so treating the creator as disqualified
 * punished the ordinary flow while adding nothing: an invented store still has to survive
 * moderation before a single point exists, and that is the anti-abuse gate.
 */

/** Store shape the credit gate needs, and nothing else. */
export type StoreEligibilityRow = {
  status: StoreStatus;
  visibility: StoreVisibility;
  isPrivate: boolean;
};

/**
 * The `select` every host mutation must widen its own store lookup to before it can gate a credit.
 *
 * Stated once, as a value, so a call site cannot accidentally read a narrower row and get a
 * confident `false` out of a field it never loaded.
 */
export const STORE_CREDIT_ELIGIBILITY_SELECT = {
  status: true,
  visibility: true,
  isPrivate: true,
} as const;

/**
 * The same gate as a nested Prisma filter, for the queries that push it down instead of resolving
 * rows and testing them afterwards.
 *
 * Kept beside {@link isStoreCreditEligible} rather than re-typed at each query, because the two
 * shapes answering differently is precisely the drift this module exists to prevent.
 */
export const CREDITABLE_STORE_FILTER = {
  status: StoreStatus.APPROVED,
  visibility: StoreVisibility.PUBLIC,
  isPrivate: false,
} as const;

export function isStoreCreditEligible(store: StoreEligibilityRow | null | undefined): boolean {
  if (!store) {
    return false;
  }
  return store.status === StoreStatus.APPROVED && store.visibility === StoreVisibility.PUBLIC && !store.isPrivate;
}
