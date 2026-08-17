"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { isItemEligibleForDelivery } from "@/lib/orders/orderState";
import type { PendingProductsByStoreGroup } from "@/lib/data/orders/pendingProductsByStoreQueries";

/**
 * One live selection at a time, scoped to a single store. Starting one in another group replaces
 * the previous one, which mirrors the sheet's `activeStoreId` and makes the "one delivery, one
 * store" rule visible instead of only enforced server-side (`Delivery.storeId` is scalar, and
 * `createDelivery` refuses `PRODUCTS_FROM_DIFFERENT_STORE`).
 *
 * An EMPTY `itemIds` is meaningful, not the same as `null`: on touch there is no hover to reveal
 * the per-row tiles, so a group enters an explicit select mode with nothing marked yet.
 */
export type StoreProductSelection = { storeId: string; itemIds: Set<string> };

const EMPTY_IDS: ReadonlySet<string> = new Set<string>();

/**
 * Intersects a live selection with what the server now says is on screen AND still eligible.
 *
 * Without this, a resync that drops one of the marked products (a delivery logged in another tab,
 * a product that moved to `IN_TRANSIT`) leaves its id in the set with no row left to render, so no
 * checkbox left to clear — and the whole batch is then refused by `createDelivery` forever, with
 * the natural response (retry) never converging. Applied on every resync AND on rollback, since a
 * rollback restores the snapshot the refusal was computed against.
 *
 * A selection whose ids ALL vanished is dropped entirely rather than left empty: at that point
 * nothing the collector marked survives, so keeping the group in select mode would be asserting a
 * selection that no longer exists. An already-empty selection (touch select mode, nothing marked
 * yet) is untouched.
 */
export function pruneStoreSelection(
  selection: StoreProductSelection | null,
  groups: PendingProductsByStoreGroup[],
): StoreProductSelection | null {
  if (!selection) return null;
  const group = groups.find((candidate) => candidate.store.id === selection.storeId);
  if (!group) return null;

  const survivors = new Set<string>();
  for (const product of group.pendingProducts) {
    if (selection.itemIds.has(product.itemId) && isItemEligibleForDelivery(product.deliveryState)) {
      survivors.add(product.itemId);
    }
  }

  if (survivors.size === selection.itemIds.size) return selection;
  if (survivors.size === 0) return null;
  return { storeId: selection.storeId, itemIds: survivors };
}

export type ToggleOptions = {
  /** Extends the range from the last toggled tile of this group. */
  shiftKey: boolean;
  /** Eligible item ids of this group, in the order they are rendered, for the range extension. */
  eligibleIds: string[];
};

export function useStoreProductSelection() {
  const [selection, setSelection] = useState<StoreProductSelection | null>(null);
  /** Last tile the collector toggled, the anchor a `Shift` + click extends from. */
  const anchorRef = useRef<string | null>(null);
  const startedStoreRef = useRef<string | null>(null);

  // Fired from an effect rather than from inside a state updater: updaters run twice under
  // StrictMode and must stay pure, and a double-counted funnel entry is not worth the shortcut.
  useEffect(() => {
    const storeId = selection?.storeId ?? null;
    if (storeId && storeId !== startedStoreRef.current) {
      posthog.capture(POSTHOG_EVENTS.DELIVERY.STORE_SELECTION_STARTED, { store_id: storeId });
    }
    startedStoreRef.current = storeId;
  }, [selection?.storeId]);

  const idsFor = useCallback(
    (storeId: string): ReadonlySet<string> => (selection?.storeId === storeId ? selection.itemIds : EMPTY_IDS),
    [selection],
  );

  const isSelecting = useCallback((storeId: string) => selection?.storeId === storeId, [selection]);

  const begin = useCallback((storeId: string) => {
    anchorRef.current = null;
    setSelection((current) => (current?.storeId === storeId ? current : { storeId, itemIds: new Set<string>() }));
  }, []);

  const clear = useCallback(() => {
    anchorRef.current = null;
    setSelection(null);
  }, []);

  /** Drops the selection only when it belongs to this store (collapsing a group, for instance). */
  const clearStore = useCallback((storeId: string) => {
    setSelection((current) => {
      if (current?.storeId !== storeId) return current;
      anchorRef.current = null;
      return null;
    });
  }, []);

  const toggle = useCallback((storeId: string, itemId: string, options: ToggleOptions) => {
    const anchor = anchorRef.current;
    setSelection((current) => {
      const sameStore = current !== null && current.storeId === storeId;
      const next = sameStore ? new Set(current.itemIds) : new Set<string>();

      if (sameStore && options.shiftKey && anchor && anchor !== itemId) {
        const from = options.eligibleIds.indexOf(anchor);
        const to = options.eligibleIds.indexOf(itemId);
        if (from !== -1 && to !== -1) {
          const [low, high] = from < to ? [from, to] : [to, from];
          // A range EXTENDS the selection; it never un-marks item by item. Un-marking a run one
          // tile at a time is the rarer intent, and a shift-range that also removes is the shape
          // people report as "it deleted my selection".
          for (let index = low; index <= high; index += 1) next.add(options.eligibleIds[index]);
          return { storeId, itemIds: next };
        }
      }

      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return { storeId, itemIds: next };
    });
    anchorRef.current = itemId;
  }, []);

  /** The group's master checkbox: every eligible product, or none. */
  const setAll = useCallback((storeId: string, eligibleIds: string[], checked: boolean) => {
    anchorRef.current = null;
    setSelection({ storeId, itemIds: checked ? new Set(eligibleIds) : new Set<string>() });
  }, []);

  const prune = useCallback((groups: PendingProductsByStoreGroup[]) => {
    setSelection((current) => pruneStoreSelection(current, groups));
  }, []);

  /** Puts a snapshot back after a refused batch, so the collector does not re-mark 28 tiles. */
  const replace = useCallback((next: StoreProductSelection | null) => {
    anchorRef.current = null;
    // A restored snapshot is the SAME selection coming back, not a new one: the submit cleared it
    // and the refusal put it back, both without the collector doing anything. Marking the store as
    // already-started before the state lands is what keeps the funnel effect from counting an entry
    // per failed batch — an event that would claim a selection was begun that nobody began.
    startedStoreRef.current = next?.storeId ?? null;
    setSelection(next);
  }, []);

  return useMemo(
    () => ({ selection, idsFor, isSelecting, begin, clear, clearStore, toggle, setAll, prune, replace }),
    [selection, idsFor, isSelecting, begin, clear, clearStore, toggle, setAll, prune, replace],
  );
}
