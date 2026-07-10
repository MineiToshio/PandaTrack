"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { APIError } from "better-auth/api";
import { Prisma } from "../../../../../../generated/prisma/client";
import { auth } from "@/lib/auth/auth";
import { getSession } from "@/lib/auth/auth-server";
import { buildAuthEmailChangeSecurityEmail } from "@/lib/auth/authEmailChangeSecurityEmail";
import { getAccountCapabilitiesForUser } from "@/lib/auth/accountCapabilities";
import { assertEmailChangeCooldownAllows, recordSuccessfulEmailChange } from "@/lib/auth/emailChangeRateLimit";
import { ROUTES } from "@/lib/constants";
import { sendEmailWithResend } from "@/lib/integrations/resend";
import { findUserIdByEmailExcluding } from "@/lib/data/auth/userQueries";
import { applyEmailChangeTransaction } from "@/lib/data/auth/userMutations";
import type { Locale } from "@/types/locale";
import {
  type ChangePasswordFormInput,
  type EmailChangeActionResult,
  type EmailChangeFormInput,
  type PasswordActionResult,
  type SetPasswordFormInput,
  changePasswordFormSchema,
  emailChangeFormSchema,
  setPasswordFormSchema,
  type SettingsAccountErrorCode,
} from "@/app/[locale]/(app)/settings/_schemas/accountCredentials";

function getBetterAuthErrorCode(error: unknown): string | undefined {
  if (error instanceof APIError) {
    const body = error.body as { code?: string } | undefined;
    return body?.code;
  }
  return undefined;
}

function mapBetterAuthErrorToSettingsCode(error: unknown): SettingsAccountErrorCode {
  const code = getBetterAuthErrorCode(error);
  if (code === "INVALID_PASSWORD") {
    return "invalidPassword";
  }
  if (code === "PASSWORD_TOO_SHORT") {
    return "passwordTooShort";
  }
  if (code === "PASSWORD_TOO_LONG") {
    return "passwordTooLong";
  }
  if (code === "PASSWORD_ALREADY_SET") {
    return "passwordAlreadySet";
  }
  return "generic";
}

function revalidateSettings(locale: string) {
  revalidatePath(`/${locale}${ROUTES.settings}`);
  revalidatePath(`/${locale}`, "layout");
}

export async function submitEmailChangeAction(input: EmailChangeFormInput): Promise<EmailChangeActionResult> {
  const session = await getSession();
  if (!session?.user?.id || !session.user.email) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = emailChangeFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const { locale, newEmail, currentPassword } = parsed.data;
  const capabilities = await getAccountCapabilitiesForUser(session.user.id);
  if (!capabilities.canChangeEmail) {
    return { ok: false, error: "notAllowed" };
  }

  const normalizedEmail = newEmail.toLowerCase();
  const currentEmail = session.user.email.toLowerCase();

  if (normalizedEmail === currentEmail) {
    return { ok: false, error: "sameEmail" };
  }

  const now = new Date();
  const cooldown = await assertEmailChangeCooldownAllows(session.user.id, now);
  if (!cooldown.ok) {
    return { ok: false, error: "rateLimited", retryAfterIso: cooldown.retryAfterIso };
  }

  const existingUser = await findUserIdByEmailExcluding(normalizedEmail, session.user.id);

  if (existingUser) {
    return { ok: false, error: "emailTaken" };
  }

  const requestHeaders = await headers();

  try {
    await auth.api.verifyPassword({
      body: { password: currentPassword },
      headers: requestHeaders,
    });
  } catch (error) {
    const mapped = mapBetterAuthErrorToSettingsCode(error);
    if (mapped !== "generic") {
      return { ok: false, error: mapped };
    }
    Sentry.captureException(error);
    return { ok: false, error: "generic" };
  }

  const callbackURL = `/${locale}${ROUTES.settings}`;
  const oldEmail = session.user.email;

  try {
    await applyEmailChangeTransaction(session.user.id, normalizedEmail, now);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "emailTaken" };
    }
    Sentry.captureException(error);
    return { ok: false, error: "generic" };
  }

  await recordSuccessfulEmailChange(session.user.id, now);

  try {
    const emailContent = await buildAuthEmailChangeSecurityEmail(locale as Locale, normalizedEmail);
    await sendEmailWithResend({
      to: oldEmail,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });
  } catch (error) {
    Sentry.captureException(error);
  }

  try {
    await auth.api.sendVerificationEmail({
      headers: requestHeaders,
      body: {
        email: normalizedEmail,
        callbackURL,
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    return { ok: false, error: "generic" };
  }

  revalidateSettings(locale);
  return { ok: true };
}

export async function submitChangePasswordAction(input: ChangePasswordFormInput): Promise<PasswordActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = changePasswordFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const capabilities = await getAccountCapabilitiesForUser(session.user.id);
  if (!capabilities.canChangePassword) {
    return { ok: false, error: "notAllowed" };
  }

  const requestHeaders = await headers();

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: false,
      },
      headers: requestHeaders,
    });
  } catch (error) {
    const mapped = mapBetterAuthErrorToSettingsCode(error);
    if (mapped !== "generic") {
      return { ok: false, error: mapped };
    }
    Sentry.captureException(error);
    return { ok: false, error: "generic" };
  }

  revalidateSettings(parsed.data.locale);
  return { ok: true };
}

export async function submitSetPasswordAction(input: SetPasswordFormInput): Promise<PasswordActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = setPasswordFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const capabilities = await getAccountCapabilitiesForUser(session.user.id);
  if (!capabilities.canSetPassword) {
    return { ok: false, error: "notAllowed" };
  }

  const requestHeaders = await headers();

  try {
    await auth.api.setPassword({
      body: { newPassword: parsed.data.newPassword },
      headers: requestHeaders,
    });
  } catch (error) {
    const mapped = mapBetterAuthErrorToSettingsCode(error);
    if (mapped !== "generic") {
      return { ok: false, error: mapped };
    }
    Sentry.captureException(error);
    return { ok: false, error: "generic" };
  }

  revalidateSettings(parsed.data.locale);
  return { ok: true };
}
