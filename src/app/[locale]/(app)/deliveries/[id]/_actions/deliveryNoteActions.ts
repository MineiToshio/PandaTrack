"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { updateDeliveryNote } from "@/lib/data/deliveries/deliveryMutations";
import { deliveryNoteUpdateSchema } from "@/lib/deliveries/deliveryValidation";

export type SaveDeliveryNoteResult = { ok: true; note: string | null; updatedAt: Date } | { ok: false; error: string };

export async function saveDeliveryNoteAction(
  deliveryId: string,
  rawNote: string | null,
): Promise<SaveDeliveryNoteResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = deliveryNoteUpdateSchema.safeParse({ deliveryId, note: rawNote });
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const result = await updateDeliveryNote(deliveryId, userId, rawNote);
    if (!result.ok) return { ok: false, error: result.error };

    if (result.changed) {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: userId,
        event: result.note !== null ? POSTHOG_EVENTS.DELIVERY.NOTE_SAVED : POSTHOG_EVENTS.DELIVERY.NOTE_DELETED,
        properties: { deliveryId },
      });
      await posthog.shutdown();
    }

    return { ok: true, note: result.note, updatedAt: result.updatedAt };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "server_error" };
  }
}
