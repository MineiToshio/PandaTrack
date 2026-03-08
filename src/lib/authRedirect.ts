import { ROUTES } from "@/lib/constants";

export const AUTH_RETURN_TO_PARAM = "returnTo";

function getLocaleSegment(pathname: string): string | null {
  const localeMatch = pathname.match(/^\/(es|en)(\/|$)/);
  return localeMatch?.[1] ?? null;
}

function toLocalizedPath(pathname: string, locale: string): string {
  const localeInPath = getLocaleSegment(pathname);

  if (localeInPath && localeInPath !== locale) {
    return `/${locale}${ROUTES.dashboard}`;
  }

  if (localeInPath) {
    return pathname;
  }

  if (pathname === "/") {
    return `/${locale}`;
  }

  return `/${locale}${pathname}`;
}

export function resolveAuthCallbackURL(locale: string, returnTo?: string | null) {
  const defaultPath = `/${locale}${ROUTES.dashboard}`;

  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return defaultPath;
  }

  let parsedReturnTo: URL;
  try {
    parsedReturnTo = new URL(returnTo, "https://pandatrack.local");
  } catch {
    return defaultPath;
  }

  const localizedPath = toLocalizedPath(parsedReturnTo.pathname, locale);
  const localizedPathWithoutLocale = localizedPath.replace(/^\/(es|en)/, "") || "/";

  if (localizedPathWithoutLocale === ROUTES.signIn || localizedPathWithoutLocale === ROUTES.signUp) {
    return defaultPath;
  }

  return `${localizedPath}${parsedReturnTo.search}`;
}

export function buildAuthAlternativeHref(basePath: string, locale: string, returnTo?: string | null) {
  const hrefBase = `/${locale}${basePath}`;
  const callbackURL = resolveAuthCallbackURL(locale, returnTo);

  if (callbackURL === `/${locale}${ROUTES.dashboard}`) {
    return hrefBase;
  }

  const href = new URL(hrefBase, "https://pandatrack.local");
  href.searchParams.set(AUTH_RETURN_TO_PARAM, callbackURL);

  return `${href.pathname}${href.search}`;
}
