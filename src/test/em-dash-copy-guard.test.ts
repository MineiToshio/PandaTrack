import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Em dash copy guard.
 *
 * Hand-rolled, zero-dependency check that keeps the em dash (`—`, U+2014) out of
 * user-facing copy. The rule (`.agents/rules/role-copywriting-marketing.mdc`,
 * `docs/design/ux-copy.md`) is: the em dash never appears inside prose — use a
 * comma, colon, period, parentheses, or the `·` separator instead.
 *
 * The ONE allowed use is as a standalone null / empty placeholder: a value that
 * is exactly `—` (an absent number, name, or date rendered in a summary cell).
 * That is the "nothing here" glyph, not punctuation, so it is permitted.
 *
 * Scope: every string in `src/i18n/locales/**` — the source of truth for copy.
 * Hardcoded separators in components are covered by the rule docs, not here,
 * because the JSON is where copy is supposed to live.
 */

const LOCALES_DIR = join(process.cwd(), "src", "i18n", "locales");
const EM_DASH = "—";

/** Every `*.json` file under the locales tree, repo-relative for readable failures. */
function collectLocaleFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectLocaleFiles(full));
    } else if (entry.endsWith(".json")) {
      files.push(full);
    }
  }
  return files;
}

/** Walk a parsed JSON value, yielding `[keyPath, stringValue]` for every string leaf. */
function* walkStrings(value: unknown, path: string): Generator<[string, string]> {
  if (typeof value === "string") {
    yield [path, value];
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      yield* walkStrings(value[i], `${path}[${i}]`);
    }
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      yield* walkStrings(child, path ? `${path}.${key}` : key);
    }
  }
}

describe("em dash copy guard", () => {
  it("has no em dash in copy except as a standalone null placeholder", () => {
    const offenders: string[] = [];
    for (const file of collectLocaleFiles(LOCALES_DIR)) {
      const rel = file.slice(process.cwd().length + 1);
      const json = JSON.parse(readFileSync(file, "utf8"));
      for (const [keyPath, str] of walkStrings(json, "")) {
        // A value that is exactly `—` (ignoring surrounding whitespace) is the
        // permitted null / empty placeholder. Anything else is prose.
        if (str.includes(EM_DASH) && str.trim() !== EM_DASH) {
          offenders.push(`${rel} → ${keyPath}: ${JSON.stringify(str)}`);
        }
      }
    }
    expect(
      offenders,
      `The em dash (—) is banned in copy. Use a comma, colon, period, parentheses, or the ` +
        `"·" separator — rephrasing usually reads best. It is allowed ONLY as a standalone ` +
        `null/empty placeholder (a value that is exactly "—"). See ` +
        `.agents/rules/role-copywriting-marketing.mdc and docs/design/ux-copy.md.\n` +
        `${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
