import type { MetadataRoute } from "next";
import { ROUTES } from "@/lib/constants";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/seo";

const NO_CRAWL_ROUTE_PREFIXES = [
  ROUTES.dashboard,
  ROUTES.orders,
  ROUTES.deliveries,
  ROUTES.stores,
  ROUTES.settings,
  ROUTES.progress,
  ROUTES.admin,
  ROUTES.payments,
  ROUTES.budget,
  "/purchases",
  ROUTES.signIn,
  ROUTES.signUp,
  ROUTES.forgotPassword,
  ROUTES.resetPassword,
  // Prefix matching also covers confirmation and verify-email-required routes.
  ROUTES.verifyEmailStatus,
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["", ...routing.locales.map((locale) => `/${locale}`)].flatMap((prefix) =>
        NO_CRAWL_ROUTE_PREFIXES.map((path) => `${prefix}${path}`),
      ),
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
