"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { AdminAccessError, requireAdmin } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import {
  approveStoreProductTypeRequest,
  rejectStoreProductTypeRequest,
  StoreProductTypeApprovalError,
} from "@/lib/data/catalog/storeProductTypeMutations";
import {
  approveProductTypeRequestSchema,
  rejectProductTypeRequestSchema,
} from "../_schemas/productTypeRequestModerationSchema";

export type ApproveProductTypeRequestResult = { success: true; key: string } | { success: false; error: string };

export type RejectProductTypeRequestResult = { success: true } | { success: false; error: string };

function collectFirstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "validation_failed";
}

/**
 * Revalidates the admin surface plus the store catalog surfaces a newly authored type appears on, so
 * the type is immediately selectable and filterable once approved.
 */
function revalidateCatalogSurfaces(locale: string) {
  revalidatePath(`/${locale}${ROUTES.admin}`);
  revalidatePath(`/${locale}${ROUTES.stores}`);
  revalidatePath(`/${locale}${ROUTES.stores}/new`);
}

function mapModerationError(error: unknown): { success: false; error: string } {
  if (error instanceof AdminAccessError) {
    return { success: false, error: "unauthorized" };
  }
  if (error instanceof StoreProductTypeApprovalError) {
    return { success: false, error: error.code };
  }
  Sentry.captureException(error);
  return { success: false, error: "moderationFailed" };
}

export async function approveProductTypeRequestAction(input: unknown): Promise<ApproveProductTypeRequestResult> {
  try {
    const session = await requireAdmin();
    const parsed = approveProductTypeRequestSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: collectFirstIssue(parsed.error) };
    }

    const result = await approveStoreProductTypeRequest({
      requestId: parsed.data.requestId,
      actorId: session.user.id,
      nameEs: parsed.data.nameEs,
      nameEn: parsed.data.nameEn,
      key: parsed.data.key,
    });

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.STORE.PRODUCT_TYPE_REQUEST_APPROVED,
      // Identifiers only: never the requester identity or any free-text reason.
      properties: { request_id: result.requestId, product_type_key: result.key },
    });

    revalidateCatalogSurfaces(parsed.data.locale);
    return { success: true, key: result.key };
  } catch (error) {
    return mapModerationError(error);
  }
}

export async function rejectProductTypeRequestAction(input: unknown): Promise<RejectProductTypeRequestResult> {
  try {
    const session = await requireAdmin();
    const parsed = rejectProductTypeRequestSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: collectFirstIssue(parsed.error) };
    }

    const result = await rejectStoreProductTypeRequest({
      requestId: parsed.data.requestId,
      actorId: session.user.id,
    });

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.STORE.PRODUCT_TYPE_REQUEST_REJECTED,
      // Identifiers only: never the requester identity or any free-text reason.
      properties: { request_id: result.requestId },
    });

    revalidateCatalogSurfaces(parsed.data.locale);
    return { success: true };
  } catch (error) {
    return mapModerationError(error);
  }
}
