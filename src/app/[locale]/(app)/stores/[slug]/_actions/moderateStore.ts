"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { AdminAccessError, requireAdmin } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import {
  approveStore,
  getModerationStoreBySlug,
  removeStore,
  StoreModerationError,
} from "@/lib/data/stores/storeModerationMutations";
import { notifyStoreRejected } from "@/lib/notifications/storeRejectionNotifier";
import { storeModerationSchema, storeRemovalSchema } from "../_schemas/storeModerationSchema";

export type ModerateStoreResult = { success: true } | { success: false; error: string };

function collectFirstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "validation_failed";
}

/** Revalidates the store detail and the public listing so the transition is reflected on both. */
function revalidateStoreSurfaces(locale: string, slug: string) {
  revalidatePath(`/${locale}${ROUTES.stores}/${slug}`);
  revalidatePath(`/${locale}${ROUTES.stores}`);
}

function mapModerationError(error: unknown): ModerateStoreResult {
  if (error instanceof AdminAccessError) {
    return { success: false, error: "unauthorized" };
  }
  if (error instanceof StoreModerationError) {
    return { success: false, error: error.code };
  }
  Sentry.captureException(error);
  return { success: false, error: "moderationFailed" };
}

export async function approveStoreAction(input: unknown): Promise<ModerateStoreResult> {
  try {
    const session = await requireAdmin();
    const parsed = storeModerationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: collectFirstIssue(parsed.error) };
    }

    const store = await getModerationStoreBySlug(parsed.data.slug);
    if (!store) {
      return { success: false, error: "storeNotFound" };
    }

    const result = await approveStore({
      storeId: store.id,
      actorId: session.user.id,
      note: parsed.data.note,
    });

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.STORE.APPROVED,
      properties: { store_slug: result.slug },
    });

    revalidateStoreSurfaces(parsed.data.locale, result.slug);
    return { success: true };
  } catch (error) {
    return mapModerationError(error);
  }
}

export async function removeStoreAction(input: unknown): Promise<ModerateStoreResult> {
  try {
    const session = await requireAdmin();
    const parsed = storeRemovalSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: collectFirstIssue(parsed.error) };
    }

    const store = await getModerationStoreBySlug(parsed.data.slug);
    if (!store) {
      return { success: false, error: "storeNotFound" };
    }

    const result = await removeStore({
      storeId: store.id,
      actorId: session.user.id,
      removalReason: parsed.data.removalReason,
      note: parsed.data.note,
    });

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.STORE.REMOVED,
      // Only the reason category is sent, never the free-text internal note.
      properties: { store_slug: result.slug, removal_reason: parsed.data.removalReason },
    });

    // Notify the creator that their store was rejected. Awaited (not a fire-and-forget
    // promise or post-response hook, which Vercel can terminate early) but fully isolated:
    // any failure is swallowed so it never blocks or rolls back the moderation transition,
    // which has already committed. Expected non-send outcomes (opt-out, no subscription,
    // same-day duplicate) resolve silently inside the notifier and are not captured.
    try {
      await notifyStoreRejected({
        creatorUserId: result.createdByUserId,
        storeId: result.id,
        storeName: result.name,
        removalReason: parsed.data.removalReason,
        locale: parsed.data.locale,
      });
    } catch (notifyError) {
      Sentry.captureException(notifyError);
    }

    revalidateStoreSurfaces(parsed.data.locale, result.slug);
    return { success: true };
  } catch (error) {
    return mapModerationError(error);
  }
}
