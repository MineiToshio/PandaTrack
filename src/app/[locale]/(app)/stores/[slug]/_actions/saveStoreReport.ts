"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { getEditableStoreBySlug } from "@/queries/storeGovernance";
import { upsertStoreReport } from "@/queries/storeGovernance";
import { storeReportSchema } from "../_schemas/storeReportSchema";

export type SaveStoreReportResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function saveStoreReport(
  _prev: SaveStoreReportResult | null,
  formData: FormData,
): Promise<SaveStoreReportResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false, error: "unauthorized" };
  }

  const parsed = storeReportSchema.safeParse({
    slug: formData.get("slug"),
    locale: formData.get("locale"),
    reason: formData.get("reason"),
    details: formData.get("details"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.length > 0 ? issue.path.map(String).join(".") : "form";
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path].push(issue.message);
    }
    return { success: false, error: "validation_failed", fieldErrors };
  }

  const store = await getEditableStoreBySlug(prisma, parsed.data.slug);
  if (!store) {
    return { success: false, error: "storeUnavailable" };
  }

  try {
    await upsertStoreReport(prisma, {
      storeId: store.id,
      userId: session.user.id,
      reason: parsed.data.reason,
      details: parsed.data.details,
    });

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.STORE.REPORT_SUBMITTED,
      properties: {
        store_slug: store.slug,
        reason: parsed.data.reason,
        has_details: Boolean(parsed.data.details?.trim()),
      },
    });

    revalidatePath(`/${parsed.data.locale}${ROUTES.stores}/${store.slug}`);

    return { success: true };
  } catch {
    return { success: false, error: "saveReportFailed" };
  }
}
