"use server";

import { headers } from "next/headers";
import { resolveAuthCallbackURL } from "@/lib/auth/authRedirect";
import { getSession } from "@/lib/auth/auth-server";
import { getVerificationSnapshot, sendVerificationEmail } from "@/lib/auth/authVerification";
import {
  assertResendVerificationCooldownAllows,
  recordResendVerificationAttempt,
} from "@/lib/auth/resendVerificationCooldown";

type ResendVerificationEmailInput = {
  locale: string;
  returnTo?: string;
};

export type ResendVerificationEmailResult =
  | { success: true }
  | { success: false; reason: "unauthenticated" | "not_required" | "send_failed" }
  | { success: false; reason: "cooldown"; retryAfterSeconds: number };

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

  const now = new Date();
  const cooldown = await assertResendVerificationCooldownAllows(session.user.id, now);

  if (!cooldown.ok) {
    return { success: false, reason: "cooldown", retryAfterSeconds: cooldown.retryAfterSeconds };
  }

  // Spend the cooldown window before calling the provider: a failing send should not give a retry
  // loop a free pass to keep hammering it.
  await recordResendVerificationAttempt(session.user.id, now);

  const callbackURL = resolveAuthCallbackURL(locale, returnTo);
  const requestHeaders = await headers();
  const sendResult = await sendVerificationEmail(snapshot.email, callbackURL, requestHeaders);

  if (!sendResult.ok) {
    return { success: false, reason: "send_failed" };
  }

  return { success: true };
}
