"use server";

import { headers } from "next/headers";
import { resolveAuthCallbackURL } from "@/lib/authRedirect";
import { getSession } from "@/lib/auth-server";
import { getVerificationSnapshot, sendVerificationEmail } from "@/lib/authVerification";

type ResendVerificationEmailInput = {
  locale: string;
  returnTo?: string;
};

export type ResendVerificationEmailResult =
  | { success: true }
  | { success: false; reason: "unauthenticated" | "not_required" | "send_failed" };

export async function resendVerificationEmail({
  locale,
  returnTo,
}: ResendVerificationEmailInput): Promise<ResendVerificationEmailResult> {
  const session = await getSession();

  if (!session) {
    return { success: false, reason: "unauthenticated" };
  }

  const snapshot = await getVerificationSnapshot(session.user.id);

  if (!snapshot || snapshot.state === "verified" || snapshot.state === "not_applicable") {
    return { success: false, reason: "not_required" };
  }

  const callbackURL = resolveAuthCallbackURL(locale, returnTo);
  const requestHeaders = await headers();
  const sendResult = await sendVerificationEmail(snapshot.email, callbackURL, requestHeaders);

  if (!sendResult.ok) {
    return { success: false, reason: "send_failed" };
  }

  return { success: true };
}
