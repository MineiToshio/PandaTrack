import * as Sentry from "@sentry/nextjs";
import { routing } from "@/i18n/routing";
import { getLocaleSegment } from "@/lib/auth/authRedirect";
import { captureUserLocaleIfUnset } from "@/lib/data/auth/userMutations";
import { isLocale, type Locale } from "@/types/locale";

const LOCALE_COOKIE_PATTERN = /(?:^|;\s*)NEXT_LOCALE=([^;]+)/;
const PATH_PARSE_BASE = "https://pandatrack.local";

/**
 * The request-scoped signals a completed sign-in carries about the locale the collector is
 * actively browsing with.
 *
 * Every sign-in surface builds its callback URL through `resolveAuthCallbackURL`, so the
 * callback is always locale-prefixed and is the most reliable signal. Email sign-in and
 * sign-up carry it in the request body; the OAuth callback endpoint carries neither a body
 * nor a query callback, but it redirects to that same locale-prefixed URL, so its redirect
 * location is read as the equivalent signal. The `NEXT_LOCALE` cookie is the fallback.
 *
 * The raw `Accept-Language` header is deliberately not a source: what must be stored is the
 * locale the collector is reading the app in, not what their browser advertises.
 */
export type BrowsingLocaleSources = {
  bodyCallbackURL?: unknown;
  queryCallbackURL?: unknown;
  redirectLocation?: string | null;
  cookieHeader?: string | null;
};

function readLocaleFromPathLike(value: unknown): Locale | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  try {
    const { pathname } = new URL(value, PATH_PARSE_BASE);
    const segment = getLocaleSegment(pathname);
    return segment && isLocale(segment) ? segment : null;
  } catch {
    return null;
  }
}

function readLocaleFromCookieHeader(cookieHeader: string | null | undefined): Locale | null {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader.match(LOCALE_COOKIE_PATTERN);
  if (!match?.[1]) {
    return null;
  }

  const value = decodeURIComponent(match[1]);
  return isLocale(value) ? value : null;
}

/**
 * Resolves the locale the collector is browsing with: the locale prefix of the sign-in
 * callback URL first, then the `NEXT_LOCALE` cookie, then the default locale.
 */
export function resolveBrowsingLocale(sources: BrowsingLocaleSources): Locale {
  return (
    readLocaleFromPathLike(sources.bodyCallbackURL) ??
    readLocaleFromPathLike(sources.queryCallbackURL) ??
    readLocaleFromPathLike(sources.redirectLocation) ??
    readLocaleFromCookieHeader(sources.cookieHeader) ??
    routing.defaultLocale
  );
}

/**
 * Stores the browsing locale of a collector who has none yet. Once a locale is stored, the
 * collector's own explicit language choice owns the value and is never overwritten here.
 *
 * The capture is best-effort: a failure is reported once and never propagates, so sign-in
 * can never break because the locale could not be persisted.
 */
export async function captureBrowsingLocaleOnSignIn(userId: string, sources: BrowsingLocaleSources): Promise<void> {
  try {
    await captureUserLocaleIfUnset(userId, resolveBrowsingLocale(sources));
  } catch (error) {
    Sentry.captureException(error);
  }
}
