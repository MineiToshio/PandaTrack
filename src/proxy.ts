import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { ROUTES } from "@/lib/constants";
import { AUTH_RETURN_TO_PARAM } from "@/lib/auth/authRedirect";
import { routing } from "./i18n/routing";

const LEGACY_PURCHASES_ROUTE_PREFIX = "/purchases";

const handleI18nRouting = createMiddleware({
  ...routing,
  localeDetection: true,
});

const PRIVATE_ROUTE_PREFIXES = [
  ROUTES.dashboard,
  ROUTES.orders,
  ROUTES.deliveries,
  ROUTES.payments,
  ROUTES.budget,
  ROUTES.stores,
  ROUTES.settings,
] as const;

function getLocalizedPath(pathname: string): { locale: string; localizedPath: string } | null {
  const localeMatch = pathname.match(/^\/(es|en)(\/.*)?$/);

  if (!localeMatch) {
    return null;
  }

  return {
    locale: localeMatch[1],
    localizedPath: localeMatch[2] ?? "/",
  };
}

function isPrivateLocalizedPath(localizedPath: string) {
  return PRIVATE_ROUTE_PREFIXES.some((privatePath) => {
    return localizedPath === privatePath || localizedPath.startsWith(`${privatePath}/`);
  });
}

export default function proxy(request: NextRequest) {
  const localizedPathData = getLocalizedPath(request.nextUrl.pathname);

  if (
    localizedPathData &&
    (localizedPathData.localizedPath === LEGACY_PURCHASES_ROUTE_PREFIX ||
      localizedPathData.localizedPath.startsWith(`${LEGACY_PURCHASES_ROUTE_PREFIX}/`))
  ) {
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = `/${localizedPathData.locale}${localizedPathData.localizedPath.replace(
      LEGACY_PURCHASES_ROUTE_PREFIX,
      ROUTES.orders,
    )}`;
    return NextResponse.redirect(redirectUrl, 308);
  }

  if (localizedPathData && isPrivateLocalizedPath(localizedPathData.localizedPath)) {
    const sessionToken = getSessionCookie(request.headers);

    if (!sessionToken) {
      const signInUrl = new URL(`/${localizedPathData.locale}${ROUTES.signIn}`, request.url);
      const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
      signInUrl.searchParams.set(AUTH_RETURN_TO_PARAM, returnTo);
      return NextResponse.redirect(signInUrl);
    }
  }

  return handleI18nRouting(request);
}

export const config = {
  // Match only internationalized pathnames
  matcher: ["/", "/(es|en)/:path*"],
};
