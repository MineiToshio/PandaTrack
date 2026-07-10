"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { setOrderItemArrivedAtStore } from "@/lib/data/orders/orderMutations";
import { orderItemDeleteSchema } from "@/lib/orders/orderValidation";

export type SetOrderItemArrivedResult = { ok: true; arrived: boolean } | { ok: false; error: string };

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
