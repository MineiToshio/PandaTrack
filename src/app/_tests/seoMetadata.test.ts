/** @vitest-environment node */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import robots from "../robots";
import sitemap from "../sitemap";
import { buildCanonicalPath, buildPageMetadata, buildStoreDetailMetadata } from "@/lib/seo";
import LandingJsonLd from "../[locale]/(landing)/_components/LandingJsonLd";

vi.mock("next-intl/server", () => ({ getTranslations: vi.fn(async () => (key: string) => key) }));

const SITE_URL = "https://pandatrack.example";
const LOCALES = ["es", "en"] as const;
const PUBLIC_SEGMENTS = ["", "privacy", "terms"] as const;

function pagePaths(directory: string, prefix = ""): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) return pagePaths(join(directory, entry.name), path);
    return entry.name === "page.tsx" ? [prefix.replace(/\[[^\]]+\]/g, "fixture")] : [];
  });
}

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE_URL));
afterEach(() => vi.unstubAllEnvs());

describe("crawler metadata", () => {
  it("keeps public pages and Open Graph images crawlable", () => {
    const result = robots();
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(result.rules).toMatchObject({ userAgent: "*", allow: "/" });
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = [rule.disallow ?? []].flat();
    const publicPaths = [
      "/",
      ...LOCALES.flatMap((locale) =>
        PUBLIC_SEGMENTS.flatMap((segment) => {
          const path = `/${locale}${segment ? `/${segment}` : ""}`;
          return [path, `${path}/opengraph-image`];
        }),
      ),
    ];
    for (const path of publicPaths) {
      expect(
        disallow.some((blocked) => path.startsWith(blocked)),
        path,
      ).toBe(false);
    }
  });

  it("excludes every private and access page, including descendants and prefix-free aliases", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = [rule.disallow ?? []].flat();
    const privatePaths = ["(app)", "(auth)"].flatMap((group) =>
      pagePaths(join(process.cwd(), "src/app/[locale]", group)),
    );
    privatePaths.push("/payments", "/budget", "/purchases/legacy", "/verify-email-new-state");
    expect(privatePaths.length).toBeGreaterThan(30);
    for (const prefix of ["", ...LOCALES.map((locale) => `/${locale}`)]) {
      for (const path of privatePaths) {
        const url = `${prefix}${path}`;
        expect(
          disallow.some((blocked) => url.startsWith(blocked)),
          url,
        ).toBe(true);
      }
    }
  });

  it("lists exactly six canonical prefixed public URLs", async () => {
    const entries = sitemap();
    const expected = LOCALES.flatMap((locale) =>
      PUBLIC_SEGMENTS.map((segment) => `${SITE_URL}/${locale}${segment ? `/${segment}` : ""}`),
    );
    expect(entries.map((entry) => entry.url).sort()).toEqual(expected.sort());
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(6);
    for (const locale of LOCALES) {
      for (const segment of PUBLIC_SEGMENTS) {
        const path = `/${locale}${segment ? `/${segment}` : ""}`;
        expect(buildCanonicalPath(locale, segment)).toBe(path);
        const metadata = await buildPageMetadata({
          locale,
          namespace: segment || "landing",
          pathSegment: segment,
          titleKey: "title",
        });
        expect(metadata.alternates?.canonical).toBe(`${SITE_URL}${path}`);
        expect(metadata.openGraph).toMatchObject({ url: `${SITE_URL}${path}` });
      }
      const jsonLd = LandingJsonLd({ locale, name: "PandaTrack", description: "Fixture" });
      const schemas = JSON.parse(jsonLd.props.dangerouslySetInnerHTML.__html) as Array<{ url: string }>;
      expect(schemas.map((schema) => schema.url)).toEqual([`${SITE_URL}/${locale}`, `${SITE_URL}/${locale}`]);
      const storeMetadata = await buildStoreDetailMetadata({
        locale,
        storeName: "Fixture",
        slug: "fixture",
        noindex: false,
      });
      expect(storeMetadata.alternates?.canonical).toBe(`${SITE_URL}/${locale}/stores/fixture`);
    }
  });
});
