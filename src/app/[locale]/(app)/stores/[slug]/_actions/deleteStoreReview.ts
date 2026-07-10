"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { deleteStoreReview as deleteStoreReviewQuery } from "@/lib/data/stores/storeMutations";

const deleteStoreReviewSchema = z.object({
  reviewId: z.string().trim().min(1),
  locale: z.string().trim().min(2),
});

export type DeleteStoreReviewActionResult = { success: true } | { success: false; error: string };

export async function deleteStoreReview(
  _prev: DeleteStoreReviewActionResult | null,
  formData: FormData,
): Promise<DeleteStoreReviewActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false, error: "unauthorized" };
  }

  const parsed = deleteStoreReviewSchema.safeParse({
    reviewId: formData.get("reviewId"),
    locale: formData.get("locale"),
  });

  if (!parsed.success) {
    return { success: false, error: "validation_failed" };
  }

  try {
    const result = await deleteStoreReviewQuery({
      reviewId: parsed.data.reviewId,
      userId: session.user.id,
    });

    if (!result) {
      return { success: false, error: "reviewNotFound" };
    }

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.STORE.REVIEW_DELETED,
      properties: {
        store_slug: result.slug,
      },
    });

    revalidatePath(`/${parsed.data.locale}${ROUTES.stores}`);
    revalidatePath(`/${parsed.data.locale}${ROUTES.stores}/${result.slug}`);

    return { success: true };
  } catch (error) {
    Sentry.captureException(error);
    return { success: false, error: "deleteReviewFailed" };
  }
}
