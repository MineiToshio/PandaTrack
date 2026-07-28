import type { StoreRemovalReason, StoreStatus } from "../../../generated/prisma/client";
import { isSanctionRemovalReason } from "./removalReason";

/** Visual/copy register for a removed-store tombstone: neutral by default, sanction for abuse. */
export type StoreTombstoneTone = "neutral" | "sanction";

export type StoreTombstone = {
  /** True only when the store has been moderated out (`REJECTED`). */
  isRemoved: boolean;
  /** Which copy/visual variant applies. Meaningful only when `isRemoved` is true. */
  tone: StoreTombstoneTone;
};

type TombstoneStoreInput = {
  status: StoreStatus;
  removalReason: StoreRemovalReason | null;
};

/**
 * Pure resolver shared by every order surface that renders a store name. It reports whether the
 * referenced store was removed and, if so, which tombstone register to show. It never re-derives
 * the abuse classification: it reads the `removalReason` persisted by the store-side moderation
 * flow through `isSanctionRemovalReason`, keeping the neutral-vs-sanction decision in one place.
 */
export function resolveStoreTombstone(store: TombstoneStoreInput): StoreTombstone {
  const isRemoved = store.status === "REJECTED";
  const tone: StoreTombstoneTone =
    isRemoved && store.removalReason !== null && isSanctionRemovalReason(store.removalReason) ? "sanction" : "neutral";
  return { isRemoved, tone };
}
