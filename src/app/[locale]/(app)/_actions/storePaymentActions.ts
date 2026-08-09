"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import {
  createStorePayment,
  deleteStorePayment,
  type CreateStorePaymentError,
} from "@/lib/data/orders/storePaymentMutations";
import {
  getAssignableOrdersByStore,
  type AssignableOrder,
} from "@/lib/data/orders/storePaymentAssignableOrdersQueries";
import { storePaymentCreateSchema, storePaymentDeleteSchema } from "@/lib/orders/orderValidation";
import { revalidateCollectionSurfaces } from "@/lib/cache/revalidateCollectionSurfaces";

export type GetStorePaymentSheetOrdersResult =
  { ok: true; orders: AssignableOrder[] } | { ok: false; error: "unauthorized" };

/**
 * Loads the "¿A qué va este pago?" declaration list when the store payment sheet opens. Fetched
 * on demand (not carried on the page) so neither the orders store-view nor the store detail page
 * has to load every order's items up front for a sheet most visits never open.
 */
export async function getStorePaymentSheetOrdersAction(storeId: string): Promise<GetStorePaymentSheetOrdersResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const orders = await getAssignableOrdersByStore(session.user.id, storeId);
  return { ok: true, orders };
}

export type CreateStorePaymentActionInput = {
  storeId: string;
  amount: number;
  paymentDate: Date;
  currencyCode?: string;
  note?: string | null;
  allocations?: { orderId: string; orderItemId?: string; amountMinor: number; settlesTarget?: boolean }[];
};

export type CreateStorePaymentActionResult =
  | {
      ok: true;
      paymentId: string;
      currencyCode: string;
      affectedOrders: { orderId: string; allocatedAmountMinor: number }[];
    }
  | { ok: false; error: CreateStorePaymentError | "unauthorized" | "validation" | "server_error" };

/**
 * Records a payment to a store, with its optional declaration of what it covers. Called
 * fire-and-forget from the sheet's Optimistic Confirmation submit — the sheet has already closed
 * by the time this resolves, so every failure surfaces through the caller's toast, not an inline
 * form error.
 */
export async function createStorePaymentAction(
  input: CreateStorePaymentActionInput,
): Promise<CreateStorePaymentActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = storePaymentCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await createStorePayment({ userId, ...parsed.data });
    if (!result.ok) return { ok: false, error: result.error };

    revalidateCollectionSurfaces();

    const allocationsCount = parsed.data.allocations?.length ?? 0;
    const hasItemAllocations = (parsed.data.allocations ?? []).some((allocation) => allocation.orderItemId != null);
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.STORE.PAYMENT_REGISTERED,
      properties: {
        store_id: input.storeId,
        allocations_count: allocationsCount,
        has_item_allocations: hasItemAllocations,
        // "On account": money handed over with nothing declared against a specific order yet.
        is_on_account: allocationsCount === 0,
      },
    });
    await posthog.shutdown();

    return {
      ok: true,
      paymentId: result.paymentId,
      currencyCode: result.currencyCode,
      affectedOrders: result.affectedOrders.map((order) => ({
        orderId: order.orderId,
        allocatedAmountMinor: order.allocatedAmountMinor,
      })),
    };
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("feature", "store_payment");
      scope.setContext("storePayment", {
        storeId: input.storeId,
        hasAllocations: (input.allocations ?? []).length > 0,
      });
      Sentry.captureException(error);
    });
    return { ok: false, error: "server_error" };
  }
}

export type DeleteStorePaymentActionResult =
  | { ok: true; affectedOrderIds: string[] }
  | { ok: false; error: "NOT_FOUND" | "unauthorized" | "validation" | "server_error" };

/**
 * Deletes a payment from the store detail "Pagos a esta tienda" list — the only screen that can
 * reach a payment independent of any single order's allocations. Takes the money back entirely,
 * including every allocation declared against it, unlike an order-scoped delete which may only
 * remove that order's slice of a shared payment (see `deleteOrderPayment`).
 */
export async function deleteStorePaymentAction(paymentId: string): Promise<DeleteStorePaymentActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = storePaymentDeleteSchema.safeParse({ paymentId });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await deleteStorePayment(parsed.data.paymentId, userId);
    if (!result.ok) return result;

    revalidateCollectionSurfaces();

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.STORE.PAYMENT_DELETED,
      properties: { affected_orders_count: result.affectedOrderIds.length },
    });
    await posthog.shutdown();

    return result;
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("feature", "store_payment");
      scope.setContext("storePayment", { paymentId });
      Sentry.captureException(error);
    });
    return { ok: false, error: "server_error" };
  }
}
