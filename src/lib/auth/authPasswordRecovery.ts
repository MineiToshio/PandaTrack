import * as Sentry from "@sentry/nextjs";
import { createHash } from "node:crypto";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { sendEmailWithResend } from "@/lib/integrations/resend";
import { buildAuthPasswordResetEmail } from "@/lib/auth/authPasswordResetEmail";
import {
  deletePasswordResetVerificationToken,
  getPasswordRecoveryThrottleMarker,
  upsertPasswordRecoveryThrottleMarker,
} from "@/lib/auth/authPasswordRecoveryData";
import {
  getPasswordRecoveryActiveThrottleState,
  getPasswordRecoveryNextThrottleState,
  getPasswordRecoveryRemainingMinutes,
  parsePasswordRecoveryThrottleState,
} from "@/lib/auth/passwordRecoveryThrottle";
import { Locale, isLocale } from "@/types/locale";

type PasswordRecoveryRequestContext = {
  email: string;
  request?: Request;
  token: string;
  url: string;
};

type PasswordRecoveryThrottleResult = {
  allowed: boolean;
  cooldownMinutes?: number;
  scopeId: string;
};

function normalizeRecoveryEmail(email: string) {
  return email.trim().toLowerCase();
}

function getRequestIpAddress(request: Request | undefined) {
  const forwardedFor = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return (
    forwardedFor ||
    request?.headers.get("cf-connecting-ip")?.trim() ||
    request?.headers.get("x-real-ip")?.trim() ||
    "unknown-ip"
  );
}

function getRequestDeviceSignature(request: Request | undefined) {
  const userAgent = request?.headers.get("user-agent")?.trim() || "unknown-user-agent";
  const acceptLanguage = request?.headers.get("accept-language")?.trim() || "unknown-language";

  return `${userAgent}|${acceptLanguage}`;
}

function buildPasswordRecoveryThrottleScopeId(email: string, request: Request | undefined) {
  const fingerprint = createHash("sha256")
    .update(`${normalizeRecoveryEmail(email)}|${getRequestIpAddress(request)}|${getRequestDeviceSignature(request)}`)
    .digest("hex");

  return `password-recovery-throttle:${fingerprint}`;
}

export async function evaluatePasswordRecoveryThrottle(
  email: string,
  request: Request | undefined,
): Promise<PasswordRecoveryThrottleResult> {
  const scopeId = buildPasswordRecoveryThrottleScopeId(email, request);
  const existingMarker = await getPasswordRecoveryThrottleMarker(scopeId);
  const now = new Date();
  const currentState = parsePasswordRecoveryThrottleState(existingMarker?.value);
  const activeState = getPasswordRecoveryActiveThrottleState(currentState, now);

  if (activeState) {
    const nextState = getPasswordRecoveryNextThrottleState(activeState, now);

    await upsertPasswordRecoveryThrottleMarker(scopeId, nextState);

    return {
      allowed: false,
      cooldownMinutes: getPasswordRecoveryRemainingMinutes(nextState, now),
      scopeId,
    };
  }

  return { allowed: true, scopeId };
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
  token,
  url,
}: PasswordRecoveryRequestContext): Promise<void> {
  const throttleResult = await evaluatePasswordRecoveryThrottle(email, request);
  const posthog = getPostHogClient();

  if (!throttleResult.allowed) {
    await deletePasswordResetVerificationToken(token);
    posthog.capture({
      distinctId: email,
      event: POSTHOG_EVENTS.AUTH.FORGOT_PASSWORD_FAILED,
      properties: {
        reason: "rate_limited",
        cooldown_minutes: throttleResult.cooldownMinutes,
      },
    });
    return;
  }

  const locale = resolvePasswordRecoveryLocale(url, request);
  const emailContent = await buildAuthPasswordResetEmail(locale, url);

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
    await upsertPasswordRecoveryThrottleMarker(
      throttleResult.scopeId,
      getPasswordRecoveryNextThrottleState(null, new Date()),
    );
  } catch (error) {
    await deletePasswordResetVerificationToken(token);
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
