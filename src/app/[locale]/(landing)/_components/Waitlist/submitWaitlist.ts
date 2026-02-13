"use server";

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

  // Option B: no persistence yet; return success. Replace with DB write when ready.
  void parsed.data;
  return { success: true };
}
