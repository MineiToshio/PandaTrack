import type { MetadataRoute } from "next";
import { buildCanonicalPath, getSiteUrl, type PageCanonicalSegment } from "@/lib/seo";
import { routing } from "@/i18n/routing";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const now = new Date();
  const locales = routing.locales;

  const entries: MetadataRoute.Sitemap = [];

  const localePages: Array<{
    segment: PageCanonicalSegment;
    changeFrequency: "weekly" | "monthly";
    priority: number;
  }> = [
    { segment: "", changeFrequency: "weekly", priority: 1 },
    { segment: "terms", changeFrequency: "monthly", priority: 0.5 },
    { segment: "privacy", changeFrequency: "monthly", priority: 0.5 },
  ];

  for (const locale of locales) {
    const localeEntries = localePages.map((page) => ({
      url: `${baseUrl}${buildCanonicalPath(locale, page.segment)}`,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    }));
    entries.push(...localeEntries);
  }

  return entries;
}
