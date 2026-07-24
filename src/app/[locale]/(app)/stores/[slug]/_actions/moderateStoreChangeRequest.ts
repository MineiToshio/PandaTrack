"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { AdminAccessError, requireAdmin } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { getEditableStoreBySlug } from "@/lib/data/stores/storeGovernanceQueries";
import {
  applyStoreChangeRequest,
  rejectStoreChangeRequest,
  StoreChangeRequestError,
} from "@/lib/data/stores/storeGovernanceMutations";
import { storeChangeRequestModerationSchema } from "../_schemas/storeChangeRequestModerationSchema";

export type ApplyStoreChangeRequestActionResult =
  { success: true; outcome: "applied" | "superseded" } | { success: false; error: string };

export type RejectStoreChangeRequestActionResult = { success: true } | { success: false; error: string };

function collectFirstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "validation_failed";
}

/** Revalidates the store detail and the public listing so the review outcome is reflected on both. */
function revalidateStoreSurfaces(locale: string, slug: string) {
  revalidatePath(`/${locale}${ROUTES.stores}/${slug}`);
  revalidatePath(`/${locale}${ROUTES.stores}`);
}

function mapChangeRequestError(error: unknown): { success: false; error: string } {
  if (error instanceof AdminAccessError) {
    return { success: false, error: "unauthorized" };
  }
  if (error instanceof StoreChangeRequestError) {
    return { success: false, error: error.code };
  }
  Sentry.captureException(error);
  return { success: false, error: "moderationFailed" };
}

export async function applyStoreChangeRequestAction(input: unknown): Promise<ApplyStoreChangeRequestActionResult> {
  try {
    const session = await requireAdmin();
    const parsed = storeChangeRequestModerationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: collectFirstIssue(parsed.error) };
    }

    const store = await getEditableStoreBySlug(parsed.data.slug);
    if (!store) {
      return { success: false, error: "storeNotFound" };
    }

    const result = await applyStoreChangeRequest(store, parsed.data.changeRequestId, session.user.id);

    if (result.outcome === "applied") {
      getPostHogClient().capture({
        distinctId: session.user.id,
        event: POSTHOG_EVENTS.STORE.CHANGE_REQUEST_APPLIED,
        // Identifiers and counts only; never the free-text change-request comment.
        properties: {
          store_slug: parsed.data.slug,
          change_request_id: parsed.data.changeRequestId,
          applied_field_count: result.appliedFieldCount,
          superseded_count: result.supersededCount,
        },
      });
    }

    revalidateStoreSurfaces(parsed.data.locale, parsed.data.slug);
    return { success: true, outcome: result.outcome };
  } catch (error) {
    return mapChangeRequestError(error);
  }
}

export async function rejectStoreChangeRequestAction(input: unknown): Promise<RejectStoreChangeRequestActionResult> {
  try {
    const session = await requireAdmin();
    const parsed = storeChangeRequestModerationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: collectFirstIssue(parsed.error) };
    }

    const store = await getEditableStoreBySlug(parsed.data.slug);
    if (!store) {
      return { success: false, error: "storeNotFound" };
    }

    await rejectStoreChangeRequest(store, parsed.data.changeRequestId, session.user.id);

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.STORE.CHANGE_REQUEST_REJECTED,
      // Identifiers only; never the free-text change-request comment.
      properties: { store_slug: parsed.data.slug, change_request_id: parsed.data.changeRequestId },
    });

    revalidateStoreSurfaces(parsed.data.locale, parsed.data.slug);
    return { success: true };
  } catch (error) {
    return mapChangeRequestError(error);
  }
}
