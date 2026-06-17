"use server";

import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import {
  cancelDelivery,
  deleteDelivery,
  markDeliveryDelivered,
  reopenDelivery,
} from "@/lib/data/deliveries/deliveryMutations";
import {
  deliveryCancelSchema,
  deliveryDeleteSchema,
  deliveryMarkDeliveredSchema,
  deliveryReopenSchema,
} from "@/lib/deliveries/deliveryValidation";

export type DeliveryLifecycleActionResult = { ok: true } | { ok: false; error: string };

export async function markDeliveredAction(
  deliveryId: string,
  receivedDate: Date,
): Promise<DeliveryLifecycleActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = deliveryMarkDeliveredSchema.safeParse({ deliveryId, receivedDate });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };

  try {
    const result = await markDeliveryDelivered(parsed.data.deliveryId, userId, parsed.data.receivedDate);
    if (!result.ok) return { ok: false, error: result.error };

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.DELIVERY.MARKED_DELIVERED,
      properties: { deliveryId, productCount: result.productCount },
    });
    await posthog.shutdown();

    return { ok: true };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "server_error" };
  }
}

export async function reopenDeliveryAction(deliveryId: string): Promise<DeliveryLifecycleActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = deliveryReopenSchema.safeParse({ deliveryId });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await reopenDelivery(parsed.data.deliveryId, userId);
    if (!result.ok) return { ok: false, error: result.error };

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.DELIVERY.REOPENED,
      properties: { deliveryId, productCount: result.productCount },
    });
    await posthog.shutdown();

    return { ok: true };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "server_error" };
  }
}

export async function cancelDeliveryAction(deliveryId: string): Promise<DeliveryLifecycleActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = deliveryCancelSchema.safeParse({ deliveryId });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await cancelDelivery(parsed.data.deliveryId, userId);
    if (!result.ok) return { ok: false, error: result.error };

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.DELIVERY.CANCELLED,
      properties: { deliveryId, productCount: result.productCount },
    });
    await posthog.shutdown();

    return { ok: true };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "server_error" };
  }
}

export async function deleteDeliveryAction(deliveryId: string, locale: string): Promise<DeliveryLifecycleActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = deliveryDeleteSchema.safeParse({ deliveryId });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await deleteDelivery(parsed.data.deliveryId, userId);
    if (!result.ok) return { ok: false, error: result.error };

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.DELIVERY.DELETED,
      properties: { deliveryId, productCount: result.productCount },
    });
    await posthog.shutdown();

    redirect(`/${locale}${ROUTES.deliveries}`);
  } catch (err) {
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
    Sentry.captureException(err);
    return { ok: false, error: "server_error" };
  }
}
