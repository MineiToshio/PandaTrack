import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";
import { routing } from "@/i18n/routing";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const now = new Date();
  const locales = routing.locales;
  const defaultLocale = routing.defaultLocale;

  const entries: MetadataRoute.Sitemap = [];

  const localePages: Array<{
    path: string;
    changeFrequency: "weekly" | "monthly";
    priority: number;
  }> = [
    { path: "", changeFrequency: "weekly", priority: 1 },
    { path: "/terms", changeFrequency: "monthly", priority: 0.5 },
    { path: "/privacy", changeFrequency: "monthly", priority: 0.5 },
  ];

  for (const locale of locales) {
    const prefix = locale === defaultLocale ? "" : `/${locale}`;
    const localeBase = prefix ? `${baseUrl}${prefix}` : baseUrl;

    const localeEntries = localePages.map((page) => ({
      url: page.path ? `${localeBase}${page.path}` : localeBase,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    }));
    entries.push(...localeEntries);
  }

  return entries;
}
