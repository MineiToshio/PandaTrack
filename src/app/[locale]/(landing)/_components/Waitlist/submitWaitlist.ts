"use server";

import { createSubscriber, tagSubscriberByLocale } from "@/lib/kit";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { getPostHogClient } from "@/lib/posthog-server";
import { isLocale } from "@/types/locale";
import { waitlistSchema } from "./waitlistSchema";

export type SubmitWaitlistResult =
  | { success: true }
  | { success: false; error: string }
  | { success: false; fieldErrors: Record<string, string[]> };

export async function submitWaitlist(formData: FormData): Promise<SubmitWaitlistResult> {
  const raw = {
    email: formData.get("email") ?? undefined,
    name: formData.get("name") ?? undefined,
    comment: formData.get("comment") ?? undefined,
  };

  const parsed = waitlistSchema.safeParse({
    email: typeof raw.email === "string" ? raw.email.trim() : "",
    name: typeof raw.name === "string" ? raw.name.trim() || undefined : undefined,
    comment: typeof raw.comment === "string" ? raw.comment.trim() || undefined : undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0] as string;
      if (!fieldErrors[path]) fieldErrors[path] = [];
      const message = issue.message;
      if (message === "emailRequired" || message === "emailInvalid") {
        fieldErrors[path].push(message);
      } else {
        fieldErrors[path].push(issue.message);
      }
    }
    return { success: false, fieldErrors };
  }

  const { email, name } = parsed.data;
  const rawLocale = formData.get("locale");
  const locale = typeof rawLocale === "string" && isLocale(rawLocale.trim()) ? rawLocale.trim() : undefined;

  const posthog = getPostHogClient();

  try {
    await createSubscriber({ email, firstName: name ?? undefined });
    if (locale) {
      try {
        await tagSubscriberByLocale(locale, email);
      } catch (tagErr) {
        console.error("Waitlist locale tag failed (subscriber was created):", tagErr);
      }
    }

    // Track successful waitlist signup on server
    posthog.capture({
      distinctId: email,
      event: POSTHOG_EVENTS.LANDING.WAITLIST.SUCCESS,
      properties: {
        email,
        has_name: !!name,
        locale: locale ?? "unknown",
      },
    });

    // Identify user by email
    posthog.identify({
      distinctId: email,
      properties: {
        email,
        name: name ?? undefined,
        locale: locale ?? undefined,
        signed_up_at: new Date().toISOString(),
      },
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Waitlist signup failed:", message);

    // Track failed waitlist signup on server
    posthog.capture({
      distinctId: email,
      event: POSTHOG_EVENTS.LANDING.WAITLIST.FAILED,
      properties: {
        email,
        error_message: message,
        locale: locale ?? "unknown",
      },
    });

    return { success: false, error: "submitError" };
  }
}
