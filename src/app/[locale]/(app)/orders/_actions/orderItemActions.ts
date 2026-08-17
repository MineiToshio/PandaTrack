"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { setOrderItemArrivedAtStore } from "@/lib/data/orders/orderMutations";
import { setOrderItemPaidDeclared } from "@/lib/data/orders/orderItemMutations";
import { orderItemDeleteSchema, orderItemPaidDeclarationSchema } from "@/lib/orders/orderValidation";
import { revalidateCollectionSurfaces } from "@/lib/cache/revalidateCollectionSurfaces";

export type SetOrderItemArrivedResult = { ok: true; arrived: boolean } | { ok: false; error: string };

export type SetOrderItemPaidDeclaredResult =
  | { ok: true; declared: boolean }
  | { ok: false; error: "unauthorized" | "validation" | "ITEM_NOT_FOUND" | "server_error" };

export async function setOrderItemArrivedAction(
  orderId: string,
  itemId: string,
  arrived: boolean,
): Promise<SetOrderItemArrivedResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  // Reuse the item-id schema purely to validate the {orderId, itemId} cuid pair before mutating.
  const parsed = orderItemDeleteSchema.safeParse({ orderId, itemId });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await setOrderItemArrivedAtStore(itemId, userId, arrived);
    if (!result.ok) return { ok: false, error: result.error };

    // Any cached copy of a list or the dashboard is now wrong; see the helper for why

    // `router.refresh()` on the client is not enough.

    revalidateCollectionSurfaces();

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: arrived ? POSTHOG_EVENTS.ORDER.ITEM_MARKED_ARRIVED : POSTHOG_EVENTS.ORDER.ITEM_REVERTED_PENDING,
      properties: { orderId, itemId },
    });
    await posthog.shutdown();

    return { ok: true, arrived: result.deliveryState === "ARRIVED_AT_STORE" };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "server_error" };
  }
}

/**
 * Sets or clears the collector's "this product is paid" mark.
 *
 * It moves no money on purpose. The store's debt, the dashboard's figures and the payment reminders
 * all read allocations, never this column, so a marked product still counts as owed until real money
 * is recorded against it. That is the point: a mark that lowered a balance would be an invented
 * figure entering the books.
 */
export async function setOrderItemPaidDeclaredAction(
  orderId: string,
  itemId: string,
  declared: boolean,
): Promise<SetOrderItemPaidDeclaredResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = orderItemPaidDeclarationSchema.safeParse({ orderId, itemId, declared });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await setOrderItemPaidDeclared(itemId, userId, declared);
    if (!result.ok) return { ok: false, error: result.error };

    // The mark is read by the orders list, the store-grouped view and the order detail, all of
    // which are cached; see the helper for why `router.refresh()` alone would not be enough.
    revalidateCollectionSurfaces();

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: declared ? POSTHOG_EVENTS.ORDER.ITEM_PAID_DECLARED : POSTHOG_EVENTS.ORDER.ITEM_PAID_UNDECLARED,
      properties: { orderId, itemId },
    });
    await posthog.shutdown();

    return { ok: true, declared };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "server_error" };
  }
}
