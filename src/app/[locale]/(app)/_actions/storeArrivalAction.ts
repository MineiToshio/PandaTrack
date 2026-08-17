"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { createDelivery } from "@/lib/data/deliveries/deliveryMutations";
import { getCollectorPreferencesSnapshot } from "@/lib/data/user-settings/userSettingsQueries";
import { deliveryStoreArrivalSchema } from "@/lib/deliveries/deliveryValidation";
import { revalidateCollectionSurfaces } from "@/lib/cache/revalidateCollectionSurfaces";

export type StoreArrivalActionInput = {
  storeId: string;
  productIds: string[];
  receivedDate: Date;
  /** Omitted when the collector does not know when the store dispatched it. */
  shippedDate: Date | null;
  /** Minor units, already parsed by the client form. */
  cost: number;
  currencyCode: string;
  exchangeRate: number | null;
};

export type StoreArrivalActionResult =
  | { ok: true; deliveryId: string; productCount: number; orderCount: number }
  | { ok: false; error: string; ineligibleProductIds?: string[] };

/**
 * Records a delivery that already reached the collector, scoped to a store rather than to a single
 * order ("ya me llegó" from the orders list "Por tienda" view).
 *
 * One `Delivery` per confirmation, never one per order, even when the selection spans several
 * orders of that store (`FR-08-02`, `BR-08-12`): the physical fact is one box, so N rows would mean
 * N `DLV-*` identifiers and N shipping-cost questions for a cost that belongs to the box.
 *
 * The products are never trusted as sent: `createDelivery` re-reads every item inside its own
 * transaction and refuses anything not owned by the caller (`PRODUCTS_FROM_DIFFERENT_STORE`), not
 * from `storeId`, not still eligible (`PRODUCT_NOT_ELIGIBLE`, with the offending ids so the client
 * can flag exactly those rows), or belonging to a cancelled order (`ORDER_CANCELLED`). This action
 * therefore does no ownership read of its own: adding one would be a second, drift-prone copy of a
 * rule the transaction already enforces atomically.
 *
 * `currencyCode` is the currency of the *shipping cost*, not of the products. A store-scoped
 * selection can legitimately mix orders denominated in different currencies; with the default cost
 * of 0 (`BR-08-10`) the code is only a unit label on the delivery row.
 */
export async function storeArrivalAction(input: StoreArrivalActionInput): Promise<StoreArrivalActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }
  const userId = session.user.id;

  const parsed = deliveryStoreArrivalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };
  }

  const preferences = await getCollectorPreferencesSnapshot(userId);
  const baseCurrencyCode = preferences?.baseCurrencyCode ?? null;
  if (baseCurrencyCode && parsed.data.currencyCode !== baseCurrencyCode && parsed.data.exchangeRate == null) {
    return { ok: false, error: "EXCHANGE_RATE_REQUIRED" };
  }

  try {
    const result = await createDelivery(userId, {
      storeId: parsed.data.storeId,
      // Same standing-in rule as the per-order quick arrival: once the box is here the dispatch
      // date is unknowable, so the arrival date fills the required column (`FR-08-37`).
      deliveryDate: parsed.data.shippedDate ?? parsed.data.receivedDate,
      receivedDate: parsed.data.receivedDate,
      cost: parsed.data.cost,
      currencyCode: parsed.data.currencyCode,
      exchangeRate: parsed.data.exchangeRate,
      productIds: parsed.data.productIds,
    });

    if (!result.ok) {
      return { ok: false, error: result.error, ineligibleProductIds: result.ineligibleProductIds };
    }

    // Any cached copy of a list or the dashboard is now wrong; see the helper for why
    // `router.refresh()` on the client is not enough.
    revalidateCollectionSurfaces();

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.DELIVERY.STORE_ARRIVAL_LOGGED,
      properties: {
        deliveryId: result.deliveryId,
        store_id: parsed.data.storeId,
        product_count: result.productCount,
        order_count: result.orderCount,
        had_shipped_date: parsed.data.shippedDate != null,
        backdated: parsed.data.receivedDate.toDateString() !== new Date().toDateString(),
      },
    });
    await posthog.shutdown();

    return {
      ok: true,
      deliveryId: result.deliveryId,
      productCount: result.productCount,
      orderCount: result.orderCount,
    };
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("feature", "delivery_store_arrival");
      scope.setContext("storeArrival", {
        storeId: parsed.data.storeId,
        productCount: parsed.data.productIds.length,
        currencyCode: parsed.data.currencyCode,
        hasExchangeRate: parsed.data.exchangeRate != null,
      });
      Sentry.captureException(error);
    });
    return { ok: false, error: "server_error" };
  }
}
