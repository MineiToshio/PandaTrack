"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import {
  addOrderPayment,
  deleteOrderPayment,
  type OrderPaymentAllocationInput,
} from "@/lib/data/orders/orderPaymentMutations";
import { orderPaymentCreateSchema, orderPaymentDeleteSchema } from "@/lib/orders/orderValidation";
import type { OrderPaymentRecord } from "@/lib/data/orders/orderPaymentAllocations";
import type { PaymentSummary } from "@/lib/orders/paymentSummary";
import { revalidateCollectionSurfaces } from "@/lib/cache/revalidateCollectionSurfaces";

type PaymentMutationPayload = PaymentSummary & { payments: OrderPaymentRecord[] };

/** Which formula produced the lines. Analytics only: it never reaches the database. */
export type OrderPaymentSplitMode = "none" | "equal" | "byPrice" | "manual";

export type AddPaymentActionResult =
  | ({ ok: true; paymentId: string } & PaymentMutationPayload)
  | {
      ok: false;
      error: string;
      /** The product the refusal is about, so the form can mark that row rather than the whole draft. */
      orderItemId?: string;
    };

export type DeletePaymentActionResult =
  ({ ok: true; deletedPayment: boolean } & PaymentMutationPayload) | { ok: false; error: string };

/**
 * Records a payment on an order, optionally saying how much of it each product takes.
 *
 * `allocations` carries only the product lines. The part of the payment that names no product is
 * derived by the mutation as `amount - sum`, so the client cannot state a leftover that disagrees
 * with the money actually paid.
 */
export async function addPaymentAction(
  orderId: string,
  amount: number,
  paymentDate: Date,
  allocations?: OrderPaymentAllocationInput[],
  /** Which formula the collector used. Only the form knows it, and only analytics reads it. */
  splitMode: OrderPaymentSplitMode = "none",
): Promise<AddPaymentActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = orderPaymentCreateSchema.safeParse({ orderId, amount, paymentDate, allocations });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await addOrderPayment({
      orderId,
      userId,
      amount,
      paymentDate,
      allocations: parsed.data.allocations,
    });
    if (!result.ok) return { ok: false, error: result.error, orderItemId: result.orderItemId };

    // Any cached copy of a list or the dashboard is now wrong; see the helper for why

    // `router.refresh()` on the client is not enough.

    revalidateCollectionSurfaces();

    const posthog = getPostHogClient();
    // Two new properties on the existing event, no new event name: the question they answer is
    // whether the breakdown is used at all and by which formula, which is a property of recording a
    // payment rather than a separate thing that happened.
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.ORDER.PAYMENT_ADDED,
      properties: { orderId, breakdownLines: parsed.data.allocations?.length ?? 0, splitMode },
    });
    await posthog.shutdown();

    return result;
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "server_error" };
  }
}

/**
 * Removes a payment from this order. The first argument is the id carried by the order's own
 * payment records, which under store-level payments is the payment (the transfer), and what goes is
 * this order's whole claim on it: a payment shared with other orders survives losing that claim.
 */
export async function deletePaymentAction(paymentId: string, orderId: string): Promise<DeletePaymentActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = orderPaymentDeleteSchema.safeParse({ paymentId, orderId });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await deleteOrderPayment({ paymentId, orderId, userId });
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
