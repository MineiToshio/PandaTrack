"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { createDelivery } from "@/lib/data/deliveries/deliveryMutations";
import { getDeliverySourceOrder } from "@/lib/data/deliveries/deliveryQueries";
import { getCollectorPreferencesSnapshot } from "@/lib/data/user-settings/userSettingsQueries";
import { deliveryQuickArrivalSchema } from "@/lib/deliveries/deliveryValidation";
import { revalidateCollectionSurfaces } from "@/lib/cache/revalidateCollectionSurfaces";

export type QuickArrivalActionInput = {
  orderId: string;
  productIds: string[];
  receivedDate: Date;
  /** Omitted when the collector does not know when the store dispatched it. */
  shippedDate: Date | null;
  /** Minor units, already parsed by the client form. */
  cost: number;
  currencyCode: string;
  exchangeRate: number | null;
};

export type QuickArrivalActionResult = { ok: true; deliveryId: string } | { ok: false; error: string };

/**
 * Records a delivery that already reached the collector, in one step ("ya me llegó").
 *
 * The store is resolved from the owned order rather than trusted from the client, and the write
 * itself goes through the shared `createDelivery` transaction with `receivedDate` set, so the
 * delivery is born DELIVERED and the source order status is re-derived exactly as it would be
 * through the wizard plus mark-delivered.
 */
export async function quickArrivalAction(input: QuickArrivalActionInput): Promise<QuickArrivalActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }
  const userId = session.user.id;

  const parsed = deliveryQuickArrivalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };
  }

  const sourceOrder = await getDeliverySourceOrder(parsed.data.orderId, userId);
  if (!sourceOrder) {
    return { ok: false, error: "ORDER_NOT_FOUND" };
  }
  if (sourceOrder.status === "CANCELLED") {
    return { ok: false, error: "ORDER_CANCELLED" };
  }

  const preferences = await getCollectorPreferencesSnapshot(userId);
  const baseCurrencyCode = preferences?.baseCurrencyCode ?? null;
  if (baseCurrencyCode && parsed.data.currencyCode !== baseCurrencyCode && parsed.data.exchangeRate == null) {
    return { ok: false, error: "EXCHANGE_RATE_REQUIRED" };
  }

  try {
    const result = await createDelivery(userId, {
      storeId: sourceOrder.storeId,
      // The shipping date is genuinely unknowable once the box is already here; standing it in
      // with the arrival date keeps the required column honest about the only fact we have.
      deliveryDate: parsed.data.shippedDate ?? parsed.data.receivedDate,
      receivedDate: parsed.data.receivedDate,
      cost: parsed.data.cost,
      currencyCode: parsed.data.currencyCode,
      exchangeRate: parsed.data.exchangeRate,
      productIds: parsed.data.productIds,
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    // Any cached copy of a list or the dashboard is now wrong; see the helper for why

    // `router.refresh()` on the client is not enough.

    revalidateCollectionSurfaces();

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.DELIVERY.QUICK_ARRIVAL_LOGGED,
      properties: {
        deliveryId: result.deliveryId,
        product_count: result.productCount,
        order_id: parsed.data.orderId,
        had_shipped_date: parsed.data.shippedDate != null,
        backdated: parsed.data.receivedDate.toDateString() !== new Date().toDateString(),
      },
    });
    await posthog.shutdown();

    return { ok: true, deliveryId: result.deliveryId };
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("feature", "delivery_quick_arrival");
      scope.setContext("quickArrival", {
        orderId: parsed.data.orderId,
        productCount: parsed.data.productIds.length,
        currencyCode: parsed.data.currencyCode,
        hasExchangeRate: parsed.data.exchangeRate != null,
      });
      Sentry.captureException(error);
    });
    return { ok: false, error: "server_error" };
  }
}
