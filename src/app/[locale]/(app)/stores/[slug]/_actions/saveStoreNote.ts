"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { getStoreBySlug, upsertStoreNote } from "@/queries/store";
import { storeNoteSchema } from "../_schemas/storeNoteSchema";

export type SaveStoreNoteResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }
  | { success: false; fieldErrors: Record<string, string[]> };

export async function saveStoreNote(
  _prev: SaveStoreNoteResult | null,
  formData: FormData,
): Promise<SaveStoreNoteResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false, error: "unauthorized" };
  }

  const parsed = storeNoteSchema.safeParse({
    slug: formData.get("slug"),
    locale: formData.get("locale"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.length > 0 ? issue.path.map(String).join(".") : "form";
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path].push(issue.message);
    }
    return { success: false, fieldErrors };
  }

  const store = await getStoreBySlug(prisma, parsed.data.slug);
  if (!store) {
    return { success: false, error: "storeUnavailable" };
  }

  try {
    await upsertStoreNote(prisma, {
      storeId: store.id,
      userId: session.user.id,
      content: parsed.data.content,
    });

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.STORE.NOTE_SAVED,
      properties: {
        store_slug: store.slug,
        content_length: parsed.data.content.length,
      },
    });

    revalidatePath(`/${parsed.data.locale}${ROUTES.stores}/${store.slug}`);

    return { success: true };
  } catch (error) {
    Sentry.captureException(error);
    return { success: false, error: "saveNoteFailed" };
  }
}
