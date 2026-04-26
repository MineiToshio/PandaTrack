"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { saveOrderNote } from "@/lib/data/orders/orderMutations";
import { orderNoteSchema } from "../_schemas/orderNoteSchema";

export type SaveOrderNoteResult = { ok: true; note: string | null; updatedAt: Date } | { ok: false; error: string };

export async function saveOrderNoteAction(orderId: string, rawNote: string | null): Promise<SaveOrderNoteResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = orderNoteSchema.safeParse({ orderId, note: rawNote });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await saveOrderNote(orderId, userId, rawNote);
    if (!result.ok) return { ok: false, error: result.error };

    if (result.changed) {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: userId,
        event: result.note !== null ? POSTHOG_EVENTS.ORDER.NOTE_SAVED : POSTHOG_EVENTS.ORDER.NOTE_DELETED,
        properties: { orderId },
      });
      await posthog.shutdown();
    }

    return { ok: true, note: result.note, updatedAt: result.updatedAt };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "server_error" };
  }
}
