"use server";

import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { cancelOrder, deleteOrder, reactivateOrder } from "@/lib/data/orders/orderMutations";
import { MAX_CANCELLATION_REASON_LENGTH } from "@/lib/orders/orderValidation";

export type OrderLifecycleResult = { ok: true } | { ok: false; error: string };

export async function cancelOrderAction(
  orderId: string,
  cancellationReason: string | null = null,
): Promise<OrderLifecycleResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const reason = cancellationReason?.trim() ? cancellationReason.trim().slice(0, MAX_CANCELLATION_REASON_LENGTH) : null;

  try {
    const result = await cancelOrder(orderId, userId, reason);
    if (!result.ok) return { ok: false, error: result.error };

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.ORDER.CANCELLED,
      properties: { orderId, hasReason: reason !== null },
    });
    await posthog.shutdown();

    return { ok: true };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "server_error" };
  }
}

export async function deleteOrderAction(orderId: string, locale: string): Promise<OrderLifecycleResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  try {
    const result = await deleteOrder(orderId, userId);
    if (!result.ok) return { ok: false, error: result.error };

    const posthog = getPostHogClient();
    posthog.capture({ distinctId: userId, event: POSTHOG_EVENTS.ORDER.DELETED, properties: { orderId } });
    await posthog.shutdown();

    redirect(`/${locale}${ROUTES.orders}`);
  } catch (err) {
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
    Sentry.captureException(err);
    return { ok: false, error: "server_error" };
  }
}

export async function reactivateOrderAction(orderId: string): Promise<OrderLifecycleResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  try {
    const result = await reactivateOrder(orderId, userId);
    if (!result.ok) return { ok: false, error: result.error };

    const posthog = getPostHogClient();
    posthog.capture({ distinctId: userId, event: POSTHOG_EVENTS.ORDER.REACTIVATED, properties: { orderId } });
    await posthog.shutdown();

    return { ok: true };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "server_error" };
  }
}
