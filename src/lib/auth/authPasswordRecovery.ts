import * as Sentry from "@sentry/nextjs";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { sendEmailWithResend } from "@/lib/integrations/resend";
import { buildAuthPasswordResetEmail } from "@/lib/auth/authPasswordResetEmail";
import { Locale, isLocale } from "@/types/locale";

type PasswordRecoveryRequestContext = {
  email: string;
  request?: Request;
  token: string;
  url: string;
};

type PasswordRecoveryThrottleResult = {
  allowed: boolean;
};

export async function evaluatePasswordRecoveryThrottle(): Promise<PasswordRecoveryThrottleResult> {
  return { allowed: true };
}

const DEFAULT_LOCALE: Locale = "es";

function getLocaleFromPath(pathname: string): Locale | null {
  const localeMatch = pathname.match(/^\/(es|en)(\/|$)/);
  const locale = localeMatch?.[1];

  return locale && isLocale(locale) ? locale : null;
}

function getLocaleFromResetUrl(resetUrl: string): Locale | null {
  try {
    const url = new URL(resetUrl);
    const localeFromOwnPath = getLocaleFromPath(url.pathname);

    if (localeFromOwnPath) {
      return localeFromOwnPath;
    }

    const callbackUrl = url.searchParams.get("callbackURL");

    if (!callbackUrl) {
      return null;
    }

    const callbackPath = new URL(callbackUrl, "https://pandatrack.local").pathname;
    return getLocaleFromPath(callbackPath);
  } catch {
    return null;
  }
}

function getLocaleFromCookie(request: Request | undefined): Locale | null {
  const cookieHeader = request?.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  const localeMatch = cookieHeader.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  const locale = localeMatch?.[1] ? decodeURIComponent(localeMatch[1]) : null;

  return locale && isLocale(locale) ? locale : null;
}

function getLocaleFromAcceptLanguage(request: Request | undefined): Locale | null {
  const acceptLanguage = request?.headers.get("accept-language");

  if (!acceptLanguage) {
    return null;
  }

  const preferredTag = acceptLanguage.split(",")[0]?.trim().toLowerCase();
  const language = preferredTag?.split("-")[0];

  return language && isLocale(language) ? language : null;
}

function resolvePasswordRecoveryLocale(resetUrl: string, request: Request | undefined): Locale {
  return (
    getLocaleFromResetUrl(resetUrl) ??
    getLocaleFromCookie(request) ??
    getLocaleFromAcceptLanguage(request) ??
    DEFAULT_LOCALE
  );
}

function createPasswordRecoveryDeliveryError(): Error {
  return new Error("PASSWORD_RESET_EMAIL_DELIVERY_FAILED");
}

export async function handlePasswordRecoveryRequest({
  email,
  request,
  url,
}: PasswordRecoveryRequestContext): Promise<void> {
  const throttleResult = await evaluatePasswordRecoveryThrottle();

  if (!throttleResult.allowed) {
    return;
  }

  const locale = resolvePasswordRecoveryLocale(url, request);
  const emailContent = await buildAuthPasswordResetEmail(locale, url);
  const posthog = getPostHogClient();

  try {
    await sendEmailWithResend({
      to: email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    posthog.capture({
      distinctId: email,
      event: POSTHOG_EVENTS.AUTH.FORGOT_PASSWORD_EMAIL_SENT,
      properties: {
        locale,
      },
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        auth_flow: "password_recovery",
      },
      extra: {
        locale,
      },
    });

    posthog.capture({
      distinctId: email,
      event: POSTHOG_EVENTS.AUTH.FORGOT_PASSWORD_EMAIL_FAILED,
      properties: {
        locale,
        reason: error instanceof Error ? error.message : "unknown_error",
      },
    });

    throw createPasswordRecoveryDeliveryError();
  }
}
