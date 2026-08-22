"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import {
  createStoreAccountAdjustment,
  deleteStoreAccountAdjustment,
  type CreateStoreAccountAdjustmentError,
} from "@/lib/data/orders/storeAccountAdjustmentMutations";
import {
  getStoreReconciliationPreview,
  type StoreReconciliationPreview,
} from "@/lib/data/orders/storeAccountAdjustmentQueries";
import {
  createStoreAccountAdjustmentSchema,
  deleteStoreAccountAdjustmentSchema,
  getStoreReconciliationPreviewSchema,
} from "@/lib/orders/storeAccountAdjustmentValidation";
import { revalidateCollectionSurfaces } from "@/lib/cache/revalidateCollectionSurfaces";

/**
 * Server Actions for the "cuadrar cuenta" (reconcile account) sheet (WO-11, `ADR 0034`). Every
 * function here is scoped by the session's own `userId`, never one supplied by the caller, mirroring
 * every other store-money action in this domain (`storePaymentActions.ts`).
 */

export type GetStoreReconciliationPreviewActionResult =
  | { ok: true; preview: StoreReconciliationPreview }
  | { ok: false; error: "unauthorized" | "validation" | "server_error" };

/**
 * Loads the read-only breakdown shown before the reconciliation write is offered: fetched on demand
 * when the sheet opens, exactly like `getStorePaymentSheetOrdersAction` loads the payment sheet's
 * own order list. Read-only and idempotent (`ADR 0034`, Technical Notes): calling it changes nothing.
 */
export async function getStoreReconciliationPreviewAction(
  storeId: string,
  currencyCode: string,
): Promise<GetStoreReconciliationPreviewActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const parsed = getStoreReconciliationPreviewSchema.safeParse({ storeId, currencyCode });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const preview = await getStoreReconciliationPreview(session.user.id, parsed.data.storeId, parsed.data.currencyCode);
    return { ok: true, preview };
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("feature", "store_account_adjustment");
      scope.setContext("storeReconciliationPreview", { storeId, currencyCode });
      Sentry.captureException(error);
    });
    return { ok: false, error: "server_error" };
  }
}

export type CreateStoreAccountAdjustmentActionInput = {
  storeId: string;
  currencyCode: string;
  reason: string;
  lines: { orderId: string; amountMinor: number }[];
};

export type CreateStoreAccountAdjustmentActionResult =
  | { ok: true; adjustmentId: string }
  | {
      ok: false;
      error: CreateStoreAccountAdjustmentError | "unauthorized" | "validation" | "server_error";
      orderId?: string;
    };

/**
 * Records a "cuadrar cuenta" declaration. Every refusal `createStoreAccountAdjustment` can return is
 * forwarded verbatim, including the `orderId` a line-scoped refusal names, so the sheet's error-key
 * mapping can point at the row a server-side race (Concurrency, WO-11) refused after the client's own
 * ceiling accepted it.
 */
export async function createStoreAccountAdjustmentAction(
  input: CreateStoreAccountAdjustmentActionInput,
): Promise<CreateStoreAccountAdjustmentActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = createStoreAccountAdjustmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await createStoreAccountAdjustment({ userId, ...parsed.data });
    if (!result.ok) {
      return { ok: false, error: result.error, orderId: result.orderId };
    }

    revalidateCollectionSurfaces();

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.STORE.RECONCILIATION_ADJUSTMENT_CREATED,
      properties: {
        store_id: input.storeId,
        currency_code: input.currencyCode,
        lines_count: parsed.data.lines.length,
      },
    });
    await posthog.shutdown();

    return { ok: true, adjustmentId: result.adjustmentId };
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("feature", "store_account_adjustment");
      scope.setContext("storeAccountAdjustment", { storeId: input.storeId, linesCount: input.lines.length });
      Sentry.captureException(error);
    });
    return { ok: false, error: "server_error" };
  }
}

export type DeleteStoreAccountAdjustmentActionResult =
  { ok: true } | { ok: false; error: "NOT_FOUND" | "unauthorized" | "validation" | "server_error" };

/** Deletes a whole reconciliation adjustment, its lines cascading with it (WO-11). */
export async function deleteStoreAccountAdjustmentAction(
  adjustmentId: string,
): Promise<DeleteStoreAccountAdjustmentActionResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = deleteStoreAccountAdjustmentSchema.safeParse({ adjustmentId });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await deleteStoreAccountAdjustment({ userId, adjustmentId: parsed.data.adjustmentId });
    if (!result.ok) return result;

    revalidateCollectionSurfaces();

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.STORE.RECONCILIATION_ADJUSTMENT_DELETED,
      properties: {},
    });
    await posthog.shutdown();

    return { ok: true };
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("feature", "store_account_adjustment");
      scope.setContext("storeAccountAdjustment", { adjustmentId });
      Sentry.captureException(error);
    });
    return { ok: false, error: "server_error" };
  }
}
