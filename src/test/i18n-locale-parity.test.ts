import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Locale parity guard.
 *
 * Every namespace file must exist for both locales and expose exactly the same
 * key paths. A key present in `es` but missing in `en` is invisible until an
 * English user reaches that screen, where next-intl renders the raw key path
 * instead of copy. Nothing else in the repo checks this.
 *
 * This guard is a pure set comparison over the JSON on disk: it makes no
 * inference about which keys the code uses, so it cannot produce a false
 * positive. Deciding whether a key is *used* is a separate, heuristic problem
 * handled advisorily by `scripts/find-unused-i18n-keys.mjs`.
 */

const LOCALES_DIR = join(process.cwd(), "src", "i18n", "locales");
const LOCALES = ["es", "en"] as const;

/** Every key path in a parsed catalog, e.g. `detail.payments.addCta`. */
function collectKeyPaths(value: unknown, prefix: string, out: Set<string>): Set<string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectKeyPaths(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.add(prefix);
  }
  return out;
}

function catalogFiles(locale: string): string[] {
  const dir = join(LOCALES_DIR, locale);
  return readdirSync(dir)
    .filter((entry) => entry.endsWith(".json") && statSync(join(dir, entry)).isFile())
    .sort();
}

function keyPathsFor(locale: string, file: string): Set<string> {
  const raw = readFileSync(join(LOCALES_DIR, locale, file), "utf8");
  return collectKeyPaths(JSON.parse(raw), "", new Set<string>());
}

describe("i18n locale parity", () => {
  it("ships the same namespace files for every locale", () => {
    const [reference, ...others] = LOCALES;
    const expected = catalogFiles(reference);
    for (const locale of others) {
      expect(
        catalogFiles(locale),
        `src/i18n/locales/${locale}/ must contain exactly the same namespace files as ` +
          `src/i18n/locales/${reference}/. Add or remove the catalog in both locales together.`,
      ).toEqual(expected);
    }
  });

  it("defines exactly the same key paths in every locale", () => {
    const [reference, ...others] = LOCALES;
    const drift: string[] = [];

    for (const file of catalogFiles(reference)) {
      const referenceKeys = keyPathsFor(reference, file);
      for (const locale of others) {
        const localeKeys = keyPathsFor(locale, file);
        for (const key of referenceKeys) {
          if (!localeKeys.has(key)) drift.push(`${file} → "${key}" missing in ${locale}`);
        }
        for (const key of localeKeys) {
          if (!referenceKeys.has(key)) drift.push(`${file} → "${key}" missing in ${reference}`);
        }
      }
    }

    expect(
      drift,
      `Locale catalogs drifted. A key must be added, renamed, and deleted in every locale in the ` +
        `same change, otherwise next-intl renders the raw key path for the locale that lacks it.\n` +
        `${drift.join("\n")}`,
    ).toEqual([]);
  });
});
