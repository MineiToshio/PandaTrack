"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { addOrderPayment, deleteOrderPayment } from "@/lib/data/orders/orderPaymentMutations";
import { orderPaymentCreateSchema, orderPaymentDeleteSchema } from "@/lib/orders/orderValidation";
import type { OrderPaymentRecord } from "@/lib/data/orders/orderPaymentAllocations";
import type { PaymentSummary } from "@/lib/orders/paymentSummary";
import { revalidateCollectionSurfaces } from "@/lib/cache/revalidateCollectionSurfaces";

type PaymentMutationPayload = PaymentSummary & { payments: OrderPaymentRecord[] };

export type AddPaymentActionResult =
  ({ ok: true; paymentId: string } & PaymentMutationPayload) | { ok: false; error: string };

export type DeletePaymentActionResult =
  ({ ok: true; deletedPayment: boolean } & PaymentMutationPayload) | { ok: false; error: string };

export async function addPaymentAction(
  orderId: string,
  amount: number,
  paymentDate: Date,
): Promise<AddPaymentActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = orderPaymentCreateSchema.safeParse({ orderId, amount, paymentDate });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await addOrderPayment({ orderId, userId, amount, paymentDate });
    if (!result.ok) return { ok: false, error: result.error };

    // Any cached copy of a list or the dashboard is now wrong; see the helper for why

    // `router.refresh()` on the client is not enough.

    revalidateCollectionSurfaces();

    const posthog = getPostHogClient();
    posthog.capture({ distinctId: userId, event: POSTHOG_EVENTS.ORDER.PAYMENT_ADDED, properties: { orderId } });
    await posthog.shutdown();

    return result;
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "server_error" };
  }
}

/**
 * Removes a payment from this order. The first argument is the id carried by the order's own
 * payment records, which under store-level payments is the allocation (this order's claim on a
 * payment), not the payment itself: a payment shared with other orders survives losing this claim.
 */
export async function deletePaymentAction(allocationId: string, orderId: string): Promise<DeletePaymentActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = orderPaymentDeleteSchema.safeParse({ allocationId, orderId });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await deleteOrderPayment({ allocationId, orderId, userId });
    if (!result.ok) return { ok: false, error: result.error };

    // Any cached copy of a list or the dashboard is now wrong; see the helper for why

    // `router.refresh()` on the client is not enough.

    revalidateCollectionSurfaces();

    const posthog = getPostHogClient();
    posthog.capture({ distinctId: userId, event: POSTHOG_EVENTS.ORDER.PAYMENT_DELETED, properties: { orderId } });
    await posthog.shutdown();

    return result;
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "server_error" };
  }
}
