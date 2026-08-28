import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOW_IT_WORKS_BLOCK_KEYS } from "../howItWorksBlocks";

/**
 * The editorial contract of the rules explainer, as a test rather than as a memo.
 *
 * The owner's decision is that the page publishes the RULES and the reason for each one, and never
 * the price list: no point value, no cap figure, no anti-split threshold, no secret medal
 * condition. A figure is the part that can be optimised against, and once it is published it cannot
 * be recalled. Prose review does not catch a number added six months from now, so the check is
 * mechanical: nothing under `progress.howItWorks` may carry a digit or a percent sign.
 *
 * The block coverage half is the other risk: copy that exists in one language only, or a seventh
 * block added to the catalogue with nothing to render.
 */

const LOCALES = ["es", "en"] as const;
const REQUIRED_FIELDS = ["title", "body", "why"] as const;

type Catalog = Record<string, unknown>;

function loadHowItWorks(locale: string): Catalog {
  const path = join(process.cwd(), "src/i18n/locales", locale, "progress.json");
  const catalog = JSON.parse(readFileSync(path, "utf8")) as Record<string, Catalog>;
  return catalog.howItWorks;
}

/** Every leaf string under a node, with the dotted path that reaches it. */
function flatten(node: unknown, prefix: string): Array<[string, string]> {
  if (typeof node === "string") return [[prefix, node]];
  if (!node || typeof node !== "object") return [];
  return Object.entries(node as Catalog).flatMap(([key, value]) => flatten(value, prefix ? `${prefix}.${key}` : key));
}

describe("progression rules explainer copy", () => {
  it.each(LOCALES)("covers every block with a rule and its reason in %s", (locale) => {
    const blocks = loadHowItWorks(locale).blocks as Record<string, Record<string, string>>;

    expect(Object.keys(blocks).sort()).toEqual([...HOW_IT_WORKS_BLOCK_KEYS].sort());

    for (const key of HOW_IT_WORKS_BLOCK_KEYS) {
      for (const field of REQUIRED_FIELDS) {
        expect(blocks[key]?.[field], `${locale} · howItWorks.blocks.${key}.${field}`).toBeTruthy();
      }
    }
  });

  it.each(LOCALES)("publishes no figure of the point table in %s", (locale) => {
    const offenders = flatten(loadHowItWorks(locale), "howItWorks").filter(([, value]) => /[\d%]/.test(value));

    expect(
      offenders.map(([path, value]) => `${path}: ${value}`),
      "The explainer states rules and reasons, never point values, caps or thresholds",
    ).toEqual([]);
  });

  it.each(LOCALES)("keeps the entry link and the page title in %s", (locale) => {
    const path = join(process.cwd(), "src/i18n/locales", locale, "progress.json");
    const catalog = JSON.parse(readFileSync(path, "utf8")) as Record<string, Record<string, string>>;

    expect(catalog.summary.howItWorksLink).toBeTruthy();
    expect(catalog.section.howItWorks).toBeTruthy();
    expect(catalog.meta.howItWorksTitle).toBeTruthy();
  });
});
