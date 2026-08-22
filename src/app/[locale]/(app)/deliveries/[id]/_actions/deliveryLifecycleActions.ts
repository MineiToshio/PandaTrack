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
  type RevertedStorePaymentSnapshot,
  type SurvivingConsumedAllocationSnapshot,
} from "@/lib/data/deliveries/deliveryMutations";
import { runOrderCloseMoneyTransaction } from "@/lib/data/orders/storePaymentMutations";
import {
  deliveryCancelSchema,
  deliveryDeleteSchema,
  deliveryMarkDeliveredSchema,
  deliveryReopenSchema,
} from "@/lib/deliveries/deliveryValidation";
import { isLocale } from "@/types/locale";
import { revalidateCollectionSurfaces } from "@/lib/cache/revalidateCollectionSurfaces";

export type DeliveryLifecycleActionResult = { ok: true } | { ok: false; error: string };

export type MarkDeliveredActionResult =
  { ok: true; consumedUnassignedMinor: number; moneyTransactionPending: boolean } | { ok: false; error: string };

export async function markDeliveredAction(deliveryId: string, receivedDate: Date): Promise<MarkDeliveredActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = deliveryMarkDeliveredSchema.safeParse({ deliveryId, receivedDate });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };

  try {
    const result = await markDeliveryDelivered(parsed.data.deliveryId, userId, parsed.data.receivedDate);
    if (!result.ok) return { ok: false, error: result.error };

    // Any cached copy of a list or the dashboard is now wrong; see the helper for why

    // `router.refresh()` on the client is not enough.

    revalidateCollectionSurfaces();

    // Order-close consumption (`FR-08-46`, `ADR 0033`): this formal-flow launcher renders no
    // settlement checkbox, so it never enables the settlement half — only consumption runs, for
    // every order this mark-delivered just closed to COMPLETED. Attempted only once the delivery
    // transaction above has committed, and independent from it: a failure here must never turn
    // into `ok: false`, since the arrival itself already persisted. The collector's own retry
    // surface for this consumption-only gap is left as an open implementation question by the WO;
    // reporting it via Sentry keeps it from being silently lost in the meantime.
    let consumedUnassignedMinor = 0;
    let moneyTransactionPending = false;
    if (result.closedOrders.length > 0) {
      try {
        const outcomes = await runOrderCloseMoneyTransaction({
          userId,
          deliveryId: parsed.data.deliveryId,
          closedOrders: result.closedOrders.map((order) => ({ orderId: order.orderId, closed: true })),
        });
        consumedUnassignedMinor = outcomes.reduce((sum, outcome) => sum + (outcome.consumedMinor ?? 0), 0);
        // Any order this consumption-only pass could not process (a genuine refusal, extremely
        // unlikely with no settlement half enabled) also needs the client's Retry surface, same as
        // a thrown error: neither case is safe to silently drop.
        moneyTransactionPending = outcomes.some((outcome) => outcome.status === "refused");
      } catch (moneyError) {
        moneyTransactionPending = true;
        Sentry.withScope((scope) => {
          scope.setTag("feature", "delivery_settlement_money_transaction");
          scope.setContext("markDeliveredConsumption", { deliveryId: parsed.data.deliveryId });
          Sentry.captureException(moneyError);
        });
      }
    }

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.DELIVERY.MARKED_DELIVERED,
      properties: {
        deliveryId,
        productCount: result.productCount,
        ...(consumedUnassignedMinor > 0 ? { consumed_unassigned_minor: consumedUnassignedMinor } : {}),
      },
    });
    await posthog.shutdown();

    return { ok: true, consumedUnassignedMinor, moneyTransactionPending };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "server_error" };
  }
}

export type ReopenDeliveryActionResult =
  | {
      ok: true;
      revertedSettlements: {
        totalAmountMinor: number;
        payments: RevertedStorePaymentSnapshot[];
        survivingConsumedMinor: number;
        survivingConsumedAllocations: SurvivingConsumedAllocationSnapshot[];
      };
    }
  | { ok: false; error: string };

export async function reopenDeliveryAction(deliveryId: string): Promise<ReopenDeliveryActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = deliveryReopenSchema.safeParse({ deliveryId });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await reopenDelivery(parsed.data.deliveryId, userId);
    if (!result.ok) return { ok: false, error: result.error };

    // Any cached copy of a list or the dashboard is now wrong; see the helper for why

    // `router.refresh()` on the client is not enough.

    revalidateCollectionSurfaces();

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.DELIVERY.REOPENED,
      properties: {
        deliveryId,
        productCount: result.productCount,
        ...(result.revertedSettlements.totalAmountMinor > 0
          ? { settlement_reverted_amount_minor: result.revertedSettlements.totalAmountMinor }
          : {}),
        ...(result.revertedSettlements.survivingConsumedMinor > 0
          ? { consumption_survived_amount_minor: result.revertedSettlements.survivingConsumedMinor }
          : {}),
      },
    });
    await posthog.shutdown();

    return { ok: true, revertedSettlements: result.revertedSettlements };
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

    // Any cached copy of a list or the dashboard is now wrong; see the helper for why

    // `router.refresh()` on the client is not enough.

    revalidateCollectionSurfaces();

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

  // Never let an unsupported locale reach redirect(); it is interpolated into the URL.
  if (!isLocale(locale)) return { ok: false, error: "validation" };

  try {
    const result = await deleteDelivery(parsed.data.deliveryId, userId);
    if (!result.ok) return { ok: false, error: result.error };

    // Any cached copy of a list or the dashboard is now wrong; see the helper for why

    // `router.refresh()` on the client is not enough.

    revalidateCollectionSurfaces();

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
