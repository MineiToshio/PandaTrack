"use client";

import { useCallback, useRef, useState } from "react";
import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { getStorePaymentSheetOrdersAction } from "@/app/[locale]/(app)/_actions/storePaymentActions";
import type { AssignableOrder } from "@/lib/data/orders/storePaymentAssignableOrdersQueries";

export type StorePaymentSheetOpenSource = "orders_store_view" | "store_detail";

/**
 * Owns the sheet's open/close state and lazily loads its "¿A qué va este pago?" order list the
 * first time it opens for a given store. Shared by both entry points (the orders store-view, which
 * can open the sheet for any of several stores from one component instance, and the store detail
 * page, which always opens it for the same one) — `open` takes the store id per call rather than
 * fixing it at construction so a single hook instance can serve either shape.
 *
 * Each page still owns its own submit handler because the optimistic patch differs per page (see
 * `StoreGroupedView` and `StoreDetailContent`).
 */
export function useStorePaymentSheetOrders() {
  const [isOpen, setIsOpen] = useState(false);
  const [orders, setOrders] = useState<AssignableOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const loadedStoreIdRef = useRef<string | null>(null);

  const open = useCallback((storeId: string, source: StorePaymentSheetOpenSource) => {
    posthog.capture(POSTHOG_EVENTS.STORE.PAYMENT_SHEET_OPENED, { store_id: storeId, source });
    setIsOpen(true);
    if (loadedStoreIdRef.current === storeId) return;
    loadedStoreIdRef.current = storeId;
    setIsLoading(true);
    setOrders([]);
    void getStorePaymentSheetOrdersAction(storeId).then((result) => {
      setIsLoading(false);
      if (result.ok) setOrders(result.orders);
    });
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  return { isOpen, open, close, orders, isLoading };
}
