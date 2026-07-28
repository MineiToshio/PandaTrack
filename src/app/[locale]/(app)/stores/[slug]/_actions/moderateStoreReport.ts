"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { AdminAccessError, requireAdmin } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import {
  dismissStoreReport,
  resolveStoreReport,
  StoreModerationError,
} from "@/lib/data/stores/storeModerationMutations";
import { storeReportModerationSchema } from "../_schemas/storeReportModerationSchema";

export type ModerateStoreReportResult =
  /**
   * `openReportsRemaining` is the store's open-report count after the transition. The caller uses it
   * to drive the derived public notice: reaching `0` is what clears it, and it is also the value an
   * optimistic client restores from on failure.
   */
  { success: true; openReportsRemaining: number } | { success: false; error: string };

function collectFirstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "validation_failed";
}

/** Revalidates the store detail and the public listing so the resolution is reflected on both. */
function revalidateStoreSurfaces(locale: string, slug: string) {
  revalidatePath(`/${locale}${ROUTES.stores}/${slug}`);
  revalidatePath(`/${locale}${ROUTES.stores}`);
}

function mapModerationError(error: unknown): ModerateStoreReportResult {
  if (error instanceof AdminAccessError) {
    return { success: false, error: "unauthorized" };
  }
  if (error instanceof StoreModerationError) {
    return { success: false, error: error.code };
  }
  Sentry.captureException(error);
  return { success: false, error: "moderationFailed" };
}

export async function resolveStoreReportAction(input: unknown): Promise<ModerateStoreReportResult> {
  try {
    const session = await requireAdmin();
    const parsed = storeReportModerationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: collectFirstIssue(parsed.error) };
    }

    const result = await resolveStoreReport({ reportId: parsed.data.reportId, actorId: session.user.id });

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.STORE.REPORT_RESOLVED,
      // Identifiers and one count only: never the raw report free-text or the reporter identity. A
      // zero `open_reports_remaining` marks the resolution that cleared the store's public notice.
      properties: {
        store_slug: parsed.data.slug,
        report_id: parsed.data.reportId,
        open_reports_remaining: result.openReportsRemaining,
      },
    });

    revalidateStoreSurfaces(parsed.data.locale, parsed.data.slug);
    return { success: true, openReportsRemaining: result.openReportsRemaining };
  } catch (error) {
    return mapModerationError(error);
  }
}

export async function dismissStoreReportAction(input: unknown): Promise<ModerateStoreReportResult> {
  try {
    const session = await requireAdmin();
    const parsed = storeReportModerationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: collectFirstIssue(parsed.error) };
    }

    const result = await dismissStoreReport({ reportId: parsed.data.reportId, actorId: session.user.id });

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.STORE.REPORT_DISMISSED,
      // Identifiers and one count only: never the raw report free-text or the reporter identity. A
      // zero `open_reports_remaining` marks the dismissal that cleared the store's public notice.
      properties: {
        store_slug: parsed.data.slug,
        report_id: parsed.data.reportId,
        open_reports_remaining: result.openReportsRemaining,
      },
    });

    revalidateStoreSurfaces(parsed.data.locale, parsed.data.slug);
    return { success: true, openReportsRemaining: result.openReportsRemaining };
  } catch (error) {
    return mapModerationError(error);
  }
}
