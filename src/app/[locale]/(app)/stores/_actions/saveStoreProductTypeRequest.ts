"use server";

import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { createStoreProductTypeRequest } from "@/queries/storeGovernance";
import { storeProductTypeRequestSchema } from "../_schemas/storeProductTypeRequestSchema";

export type SaveStoreProductTypeRequestResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function saveStoreProductTypeRequest(
  _prev: SaveStoreProductTypeRequestResult | null,
  formData: FormData,
): Promise<SaveStoreProductTypeRequestResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false, error: "unauthorized" };
  }

  const parsed = storeProductTypeRequestSchema.safeParse({
    locale: formData.get("locale"),
    source: formData.get("source"),
    suggestedName: formData.get("suggestedName"),
    reason: formData.get("reason"),
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

  try {
    await createStoreProductTypeRequest(prisma, {
      userId: session.user.id,
      suggestedName: parsed.data.suggestedName,
      reason: parsed.data.reason,
    });

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.STORE.PRODUCT_TYPE_REQUEST_SUBMITTED,
      properties: {
        source: parsed.data.source,
        suggested_name_length: parsed.data.suggestedName.length,
        has_reason: Boolean(parsed.data.reason?.trim()),
      },
    });

    return { success: true };
  } catch {
    return { success: false, error: "saveProductTypeRequestFailed" };
  }
}
