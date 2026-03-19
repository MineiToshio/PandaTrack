"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { getStoreBySlug, upsertStoreReview } from "@/queries/store";
import { storeReviewSchema } from "../_schemas/storeReviewSchema";

export type SaveStoreReviewResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function saveStoreReview(
  _prev: SaveStoreReviewResult | null,
  formData: FormData,
): Promise<SaveStoreReviewResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false, error: "unauthorized" };
  }

  const parsed = storeReviewSchema.safeParse({
    slug: formData.get("slug"),
    locale: formData.get("locale"),
    overallRating: formData.get("overallRating"),
    comment: formData.get("comment"),
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

  const store = await getStoreBySlug(prisma, parsed.data.slug);
  if (!store) {
    return { success: false, error: "storeUnavailable" };
  }

  try {
    await upsertStoreReview(prisma, {
      storeId: store.id,
      userId: session.user.id,
      overallRating: parsed.data.overallRating,
      comment: parsed.data.comment,
    });

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.STORE.REVIEW_SAVED,
      properties: {
        store_slug: store.slug,
        overall_rating: parsed.data.overallRating,
        has_comment: Boolean(parsed.data.comment),
      },
    });

    revalidatePath(`/${parsed.data.locale}${ROUTES.stores}`);
    revalidatePath(`/${parsed.data.locale}${ROUTES.stores}/${store.slug}`);

    return { success: true };
  } catch {
    return { success: false, error: "saveReviewFailed" };
  }
}
