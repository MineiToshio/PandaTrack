import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
import { routing } from "@/i18n/routing";

/**
 * Base URL for the site. Used for canonical URLs, Open Graph, and sitemap.
 * Prefer NEXT_PUBLIC_SITE_URL in production (e.g. https://pandatrack.com).
 */
export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl;
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
}

export type PageCanonicalSegment =
  | ""
  | "terms"
  | "privacy"
  | "dashboard"
  | "stores"
  | "purchases"
  | "purchases/pre-orders"
  | "shipments"
  | "settings";

/**
 * Builds the path segment for a canonical URL (no leading slash for home, e.g. "" or "/en", "/terms", "/en/terms").
 */
export function buildCanonicalPath(locale: string, segment: PageCanonicalSegment): string {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  if (segment === "") return prefix;
  return `${prefix}/${segment}`;
}

export type BuildPageMetadataOptions = {
  locale: string;
  namespace: "terms" | "privacy" | "landing" | "dashboard" | "appLayout" | "stores" | "storeListing";
  pathSegment: PageCanonicalSegment;
  titleKey: string;
  descriptionKey?: string;
};

/**
 * Absolute URL for this page's dynamic OG image (opengraph-image.tsx).
 * Required so social crawlers receive a full URL; relative paths often fail.
 */
function getOgImageUrl(baseUrl: string, locale: string, pathSegment: PageCanonicalSegment): string {
  const path = pathSegment === "" ? `/${locale}/opengraph-image` : `/${locale}/${pathSegment}/opengraph-image`;
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

/**
 * Builds Next.js metadata (title, description, canonical, openGraph) for a page.
 * Use in generateMetadata to avoid repeating the same structure across pages.
 */
export async function buildPageMetadata({
  locale,
  namespace,
  pathSegment,
  titleKey,
  descriptionKey,
}: BuildPageMetadataOptions): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace });
  const baseUrl = getSiteUrl();
  const path = buildCanonicalPath(locale, pathSegment);
  const canonical = path ? `${baseUrl}${path}` : baseUrl;
  const title = t(titleKey);
  const description = descriptionKey ? t(descriptionKey) : undefined;

  return {
    title,
    ...(description && { description }),
    alternates: { canonical },
    openGraph: {
      title,
      ...(description && { description }),
      url: canonical,
      siteName: APP_NAME,
      locale: locale === "es" ? "es" : "en",
      type: "website",
      // Explicit URL so Facebook gets a clear og:image (not inferred from other tags).
      images: [getOgImageUrl(baseUrl, locale, pathSegment)],
    },
  };
}

/**
 * Builds metadata for the public store detail page.
 * When noindex is true (e.g. PENDING stores), search engines are asked not to index the page.
 */
export async function buildStoreDetailMetadata({
  locale,
  storeName,
  slug,
  noindex,
}: {
  locale: string;
  storeName: string;
  slug: string;
  noindex: boolean;
}): Promise<Metadata> {
  const baseUrl = getSiteUrl();
  const path = buildCanonicalPath(locale, "stores") + `/${slug}`;
  const canonical = `${baseUrl}${path}`;

  return {
    title: storeName,
    alternates: { canonical },
    ...(noindex && {
      robots: { index: false, follow: false },
    }),
    openGraph: {
      title: storeName,
      url: canonical,
      siteName: APP_NAME,
      locale: locale === "es" ? "es" : "en",
      type: "website",
    },
  };
}
