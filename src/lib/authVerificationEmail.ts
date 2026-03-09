import { APP_NAME } from "@/lib/constants";
import { Locale, isLocale } from "@/types/locale";

const DEFAULT_LOCALE: Locale = "es";

type VerificationEmailMessages = {
  subject: string;
  text: string;
  intro: string;
  cta: string;
  fallback: string;
};

function getLocaleFromPath(pathname: string): Locale | null {
  const localeMatch = pathname.match(/^\/(es|en)(\/|$)/);
  const locale = localeMatch?.[1];
  return locale && isLocale(locale) ? locale : null;
}

function getLocaleFromCallbackUrl(verificationUrl: string): Locale | null {
  try {
    const url = new URL(verificationUrl);
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

function resolveEmailLocale(verificationUrl: string, request: Request | undefined): Locale {
  return (
    getLocaleFromCallbackUrl(verificationUrl) ??
    getLocaleFromCookie(request) ??
    getLocaleFromAcceptLanguage(request) ??
    DEFAULT_LOCALE
  );
}

async function getVerificationEmailMessages(locale: Locale): Promise<VerificationEmailMessages> {
  const authMessages =
    locale === "en"
      ? (await import("@/i18n/locales/en/auth.json")).default
      : (await import("@/i18n/locales/es/auth.json")).default;

  return authMessages.verificationEmail as VerificationEmailMessages;
}

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type BuildAuthVerificationEmailInput = {
  verificationUrl: string;
  request?: Request;
};

export async function buildAuthVerificationEmail({
  verificationUrl,
  request,
}: BuildAuthVerificationEmailInput): Promise<{ subject: string; text: string; html: string }> {
  const locale = resolveEmailLocale(verificationUrl, request);
  const messages = await getVerificationEmailMessages(locale);
  const interpolationValues = {
    appName: APP_NAME,
    verificationUrl,
  };

  const subject = interpolate(messages.subject, interpolationValues);
  const text = interpolate(messages.text, interpolationValues);
  const intro = interpolate(messages.intro, interpolationValues);
  const cta = interpolate(messages.cta, interpolationValues);
  const fallback = interpolate(messages.fallback, interpolationValues);
  const escapedUrl = escapeHtml(verificationUrl);

  return {
    subject,
    text,
    html: `<p>${escapeHtml(intro)}</p><p><a href="${escapedUrl}">${escapeHtml(cta)}</a></p><p>${escapeHtml(fallback)} <a href="${escapedUrl}">${escapedUrl}</a></p>`,
  };
}
