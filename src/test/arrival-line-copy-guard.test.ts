import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Arrival-line copy guard.
 *
 * The "Por tienda" row's arrival state is ONE slot of standalone text — "Llega sep 2026",
 * "Esperada 12 jun", "Atrasado 17 días", "Sin fecha estimada" — so every value under
 * `orderListing.storeView.arrival` starts a line and must start with a capital.
 *
 * This exists because the regression already happened once, on the very first version the collector
 * saw: the keys were copied from `orderListing.table.arrivalArrives` ("llega {window}"), where the
 * phrase is embedded in a sentence and lowercase is right. The two look interchangeable and are not,
 * and nothing else in the suite can tell them apart — `i18n-locale-parity` only compares the two
 * catalogues' SHAPES, and would stay green on a pair that is lowercase in both languages.
 *
 * It also holds the sibling half of the design: the delay is the only value here that may be
 * something other than a window sentence, and it is stated in full words. A chip abbreviates
 * ("Atrasado 47d") because a pill pays for every pixel; a line of text has no such excuse, and the
 * abbreviation reads as a typo there.
 */

const ARRIVAL_PATH = ["storeView", "arrival"] as const;
const LOCALES = ["es", "en"] as const;
/** Unicode-aware: `Á`, `É`, … are capitals too, and a locale may legitimately open with one. */
const STARTS_LOWERCASE = /^\p{Ll}/u;
const STARTS_UPPERCASE = /^\p{Lu}/u;

function readCatalogue(locale: string): Record<string, unknown> {
  const file = join(process.cwd(), "src", "i18n", "locales", locale, "orderListing.json");
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
}

function readArrivalCopy(locale: string): Record<string, string> {
  let node: unknown = readCatalogue(locale);
  for (const segment of ARRIVAL_PATH) {
    node = (node as Record<string, unknown>)?.[segment];
  }
  return node as Record<string, string>;
}

/**
 * The embedded-copy sibling of `readArrivalCopy`: `orderListing.table.arrival*` is the phrase
 * fragment this row's line copy was mistakenly cloned from once already (see the file header), and
 * it is deliberately lowercase because it renders mid-sentence, after a `·`. Read directly off the
 * `table` node rather than a fixed key list, so a fourth `table.arrival*` key added later is covered
 * without anyone remembering to update this file too.
 */
function readTableArrivalCopy(locale: string): Record<string, string> {
  const table = readCatalogue(locale).table as Record<string, string>;
  return Object.fromEntries(Object.entries(table).filter(([key]) => key.startsWith("arrival")));
}

describe("arrival line copy guard", () => {
  it.each(LOCALES)("reads the real catalogue for %s", (locale) => {
    // Self-check: a wrong path or a renamed namespace would otherwise make every assertion below
    // pass vacuously over an empty object, which is the failure mode this whole file exists to
    // prevent in its own subject.
    const copy = readArrivalCopy(locale);

    expect(Object.keys(copy).length).toBeGreaterThanOrEqual(4);
    expect(copy.arrives).toContain("{window}");
    // The answered case names the EVENT and takes no window: the estimate it used to print was the
    // stale one the collector read as a defect. Asserted here as the pair's other half so the file's
    // self-check keeps failing on a renamed namespace rather than passing over an empty object.
    for (const key of ["resolvedAtStore", "resolvedInTransit"] as const) {
      expect(copy[key], `storeView.arrival.${key} is missing`).toBeTypeOf("string");
      expect(copy[key]).not.toContain("{");
    }
  });

  it.each(LOCALES)("starts every arrival string with a capital in %s", (locale) => {
    const offenders = Object.entries(readArrivalCopy(locale))
      .filter(([, value]) => STARTS_LOWERCASE.test(value))
      .map(([key, value]) => `storeView.arrival.${key}: ${JSON.stringify(value)}`);

    expect(
      offenders,
      `Each of these is rendered as a standalone line in the "Por tienda" row, not inside a ` +
        `sentence, so it must open with a capital. Do not copy the casing of ` +
        `orderListing.table.arrival*, which is embedded copy.\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it.each(LOCALES)("spells the delay unit out instead of abbreviating it in %s", (locale) => {
    // The row is text, so "17 días" and not "17d". The chip form lives in `card.overdueDays` and
    // stays abbreviated there; this asserts the two did not converge back into one wording.
    const copy = readArrivalCopy(locale);

    expect(copy.overdueDays).toMatch(/\{days,\s*plural/);
    expect(copy.overdueMonths).toMatch(/\{months,\s*plural/);
  });

  /**
   * The INVERSE guard, for `orderListing.table.arrival*` — the phrase this file's own subject was
   * once mis-cloned FROM (see the file header). Nothing protected that direction: a future edit
   * could capitalise `table.arrivalArrives` to match this file's rule for `storeView.arrival.*` and
   * every other test here would stay green, because none of them read the `table` namespace at all.
   * `i18n-locale-parity` cannot catch it either — it compares catalogue SHAPES, not casing.
   */
  it.each(LOCALES)("keeps every orderListing.table.arrival* key embedded (lowercase) in %s", (locale) => {
    const copy = readTableArrivalCopy(locale);

    // Self-check, the same reason `readArrivalCopy`'s has one: a renamed `table` namespace or a
    // key prefix that no longer matches "arrival" would otherwise make the assertion below pass
    // vacuously over an empty object.
    expect(Object.keys(copy).length).toBeGreaterThanOrEqual(2);

    const offenders = Object.entries(copy)
      .filter(([, value]) => STARTS_UPPERCASE.test(value))
      .map(([key, value]) => `table.${key}: ${JSON.stringify(value)}`);

    expect(
      offenders,
      `Each of these is embedded mid-sentence after a "·" on the orders table row, not a standalone ` +
        `line, so it must stay lowercase. Do not copy the casing of storeView.arrival.*, which is ` +
        `this row's line copy and starts each of its own values with a capital.\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
