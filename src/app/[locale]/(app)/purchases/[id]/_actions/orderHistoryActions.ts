"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { deleteOrderHistoryEntry } from "@/lib/data/orders/orderMutations";
import { orderHistoryEntrySchema } from "../_schemas/orderHistoryEntrySchema";

export type DeleteHistoryEntryResult = { ok: true; deletedId: string } | { ok: false; error: string };

export async function deleteOrderHistoryEntryAction(
  entryId: string,
  orderId: string,
): Promise<DeleteHistoryEntryResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = orderHistoryEntrySchema.safeParse({ entryId, orderId });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await deleteOrderHistoryEntry(entryId, orderId, userId);
    if (!result.ok) return { ok: false, error: result.error };

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.ORDER.HISTORY_ENTRY_DELETED,
      properties: { orderId },
    });
    await posthog.shutdown();

    return { ok: true, deletedId: entryId };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "server_error" };
  }
}
