"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { getStorePaymentSheetOrdersAction } from "@/app/[locale]/(app)/_actions/storePaymentActions";
import type { AssignableOrder } from "@/lib/data/orders/storePaymentAssignableOrdersQueries";

export type StorePaymentSheetOpenSource = "orders_store_view" | "store_detail";

export type StorePaymentSheetOrdersState =
  | { status: "idle" }
  | { status: "loading"; storeId: string }
  /**
   * A refetch over a payload that is still on screen. It carries the PREVIOUS payload so the list
   * never empties under a live draft: the sheet's typed lines only exist as long as the rows they
   * were typed into do, and a refetch is the one moment they would otherwise vanish.
   */
  | { status: "refreshing"; storeId: string; stamp: number; orders: AssignableOrder[]; stale: boolean }
  /**
   * `stamp` is the invalidation counter the payload was fetched under; a bumped counter retires it.
   * `stale` marks a payload that is on screen only because a refresh over it failed: it is the last
   * one that DID land, which is not the same thing as current, and the collector has to be told.
   */
  | { status: "ready"; storeId: string; stamp: number; orders: AssignableOrder[]; stale: boolean }
  | { status: "error"; storeId: string };

/** The payload a refetch keeps on screen while it flies, and falls back to if it never lands. */
type KeptPayload = { stamp: number; orders: AssignableOrder[]; stale: boolean };

/**
 * Owns the sheet's open/close state and lazily loads its allocation list the first time it opens
 * for a given store. Shared by both entry points (the orders store-view, which can open the sheet
 * for any of several stores from one component instance, and the store detail page, which always
 * opens it for the same one) — `open` takes the store id per call rather than fixing it at
 * construction so a single hook instance can serve either shape.
 *
 * The cached payload is keyed by store id AND by an invalidation stamp. Every resolved mutation
 * bumps the stamp, success or failure alike: a rollback also leaves the server in a state the
 * client can no longer assert, and a second payment to the same store computed against a stale
 * `assignableMinor` would offer ceilings the server has already refused.
 *
 * Each page still owns its own submit handler because the optimistic patch differs per page (see
 * `StoreGroupedView` and `StorePaymentStateProvider`).
 */
export function useStorePaymentSheetOrders() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<StorePaymentSheetOrdersState>({ status: "idle" });
  // Mirrors `state` for the callbacks, which have to decide whether to fetch without re-creating
  // themselves on every payload change (both coordinators pass `open` down through memoized props).
  const stateRef = useRef<StorePaymentSheetOrdersState>(state);
  const stampRef = useRef(0);
  const requestIdRef = useRef(0);
  // Mirrors `isOpen` for `invalidate`, which has to know whether anything is still on screen
  // reading the payload it is retiring, without re-creating itself when the sheet opens or closes.
  const isOpenRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyState = useCallback((next: StorePaymentSheetOrdersState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const load = useCallback(
    (storeId: string, kept: KeptPayload | null) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const stamp = stampRef.current;
      applyState(
        kept
          ? { status: "refreshing", storeId, stamp: kept.stamp, orders: kept.orders, stale: kept.stale }
          : { status: "loading", storeId },
      );

      // A load that cannot deliver falls back to whatever it was refreshing over. An expired
      // session is an error, not an empty store — but with a payload on screen, replacing it with
      // an error state is worse than saying nothing: it wipes the rows a hand-typed draft lives in,
      // for orders the collector has already been shown. The stamp still moved, so the next open
      // refetches anyway, and the server remains the authority on every ceiling.
      //
      // It comes back marked `stale`, though. Falling back silently is what leaves old ceilings
      // presented as current with nothing to say so and no way to ask again that does not cost the
      // draft: the sheet turns the flag into a notice and a retry that keeps the rows.
      const onUnavailable = () => {
        if (requestIdRef.current !== requestId) return;
        applyState(kept ? { status: "ready", storeId, ...kept, stale: true } : { status: "error", storeId });
      };

      void getStorePaymentSheetOrdersAction(storeId).then((result) => {
        // A response only applies while it is still the newest in flight: opening store B before
        // store A answered must never land A's orders under B's name.
        if (requestIdRef.current !== requestId) return;
        if (!result.ok) {
          onUnavailable();
          return;
        }
        applyState({ status: "ready", storeId, stamp, orders: result.orders, stale: false });
      }, onUnavailable);
    },
    [applyState],
  );

  const open = useCallback(
    (storeId: string, source: StorePaymentSheetOpenSource) => {
      posthog.capture(POSTHOG_EVENTS.STORE.PAYMENT_SHEET_OPENED, { store_id: storeId, source });
      isOpenRef.current = true;
      setIsOpen(true);
      const current = stateRef.current;
      const isFresh =
        current.status === "ready" &&
        current.storeId === storeId &&
        current.stamp === stampRef.current &&
        // A payload kept after a failed refresh is not a cache hit, whatever its stamp says.
        !current.stale;
      if (isFresh) return;
      load(storeId, null);
    },
    [load],
  );

  /**
   * Asks again for the same store. With a payload already on screen it refetches OVER it, exactly
   * like an invalidation: this is the button a collector reaches for after a refresh failed under a
   * live draft, and a retry that emptied the list first would cost them the very thing they are
   * retrying to keep. Only the cold-error branch (nothing kept) goes back to a skeleton.
   */
  const retry = useCallback(() => {
    const current = stateRef.current;
    if (current.status === "idle") return;
    const kept =
      current.status === "ready" || current.status === "refreshing"
        ? { stamp: current.stamp, orders: current.orders, stale: current.stale }
        : null;
    load(current.storeId, kept);
  }, [load]);

  /**
   * Retires the cached payload. Call on every resolved mutation, success or failure.
   *
   * Bumping the stamp is enough while the sheet is closed, because `open` re-checks it. It is NOT
   * enough while the sheet is on screen: a refusal leaves it open, and the ceilings it would keep
   * offering are the very ones it just declared stale, so the collector could "fix" a line against
   * a balance that no longer exists and be refused again forever. So an invalidation with the sheet
   * open refetches in place, keeping the current payload readable while the new one flies.
   *
   * The refetch waits one turn of the event loop before committing to itself: the sheet decides
   * whether to stay open in the microtasks that follow this call (a refusal keeps it open, an
   * accepted payment closes it), so asking again afterwards is what keeps every successful payment
   * from paying for a round trip nobody is left to read.
   */
  const invalidate = useCallback(() => {
    stampRef.current += 1;
    if (refreshTimerRef.current !== null) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      const current = stateRef.current;
      if (!isOpenRef.current || current.status === "idle") return;
      const kept =
        current.status === "ready" || current.status === "refreshing"
          ? { stamp: current.stamp, orders: current.orders, stale: current.stale }
          : null;
      load(current.storeId, kept);
    }, 0);
  }, [load]);

  // Closing keeps the payload: it stays valid for the same store under the same stamp.
  const close = useCallback(() => {
    isOpenRef.current = false;
    setIsOpen(false);
  }, []);

  // A page navigation between an invalidation and its deferred refetch would otherwise leave the
  // timer to fetch for a component that no longer exists.
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current !== null) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  return {
    isOpen,
    open,
    close,
    retry,
    invalidate,
    orders: state.status === "ready" || state.status === "refreshing" ? state.orders : [],
    // A refresh over a payload already on screen is deliberately NOT "loading": swapping the list
    // for a skeleton would take the draft's rows away with it.
    isLoading: state.status === "loading",
    hasError: state.status === "error",
    /** The payload on screen outlived a refresh that failed: last known, not current. */
    isStale: (state.status === "ready" || state.status === "refreshing") && state.stale,
    /** A refetch is flying over the payload on screen, so a retry would only duplicate it. */
    isRefreshing: state.status === "refreshing",
  };
}
