import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Progression money guard: no point rule may read money.
 *
 * A progression system that can see what a collector spent stops being a reward for recordkeeping
 * and becomes a nudge to buy. The rule is therefore absolute: the modules that decide what a
 * recorded fact is WORTH may never touch an amount, a price, a currency or a rate, directly or
 * through an import that would fetch one for them.
 *
 * This is the same shape as `src/test/money-modules-guard.test.ts`, pointed the other way. That one
 * keeps a coverage mark out of the modules that produce money figures; this one keeps money out of
 * the modules that produce points. Both exist because the invariant lives ACROSS files: a unit test
 * asserting "this rule returned 5" stays green forever while somebody teaches the catalogue to read
 * `totalCost`, and only a scan over the source can go red for that.
 *
 * Two independent scans, because there are two ways in:
 *
 *   1. NAMING a monetary field (`order.totalCost`, `allocation.amountMinor`, anything `*Minor`).
 *   2. IMPORTING anything at all. The guarded modules are supposed to be leaves: they import
 *      nothing, so there is no module they could reach a figure through. An allowlist per module
 *      makes that explicit rather than implied.
 *
 * Money-derived conditions reach these modules as booleans that `moneyPredicateAdapter.ts` computed
 * (`"order-settled"` is a condition name, not a balance). The adapter is deliberately NOT scanned:
 * it is the one place allowed to look, and concentrating the exception in a single reviewable file
 * is the entire design.
 *
 * WHAT IT CANNOT SEE, by design:
 *
 *   - A monetary identifier that only ever appears inside a string or a comment. Literals and
 *     comments are masked first, so prose explaining the rule is never read as a breach of it. That
 *     would be a real hole if a guarded module could run raw SQL, which is exactly why the import
 *     allowlist below is empty: with no Prisma import there is no query to hide a column name in.
 *   - A monetary field renamed to something this list was never told about. The rule is the
 *     contract; the scan only catches the vocabulary it is given. Add to the list, never relax it.
 */

/**
 * The dependency-light modules that decide what a fact is worth. `allowedImports` is the complete
 * set of module specifiers each may import, and every one of them is empty on purpose.
 */
const GUARDED_MODULES: ReadonlyArray<{ path: string; allowedImports: readonly string[]; anchors: readonly string[] }> =
  [
    {
      path: "src/lib/data/progression/pointRules.ts",
      allowedImports: [],
      anchors: ["POINT_RULES", "order-settled", "capUnit"],
    },
    {
      path: "src/lib/data/progression/rankLadder.ts",
      allowedImports: [],
      anchors: ["deriveRank"],
    },
    {
      path: "src/lib/data/progression/medalCatalogue.ts",
      allowedImports: [],
      anchors: ["MEDAL_CATALOGUE", "getShippedMedalCount", "getMeritLockDenominator"],
    },
    {
      // The evaluator is NOT a leaf: a medal's condition is a fact about rows, so it has to read
      // them. It is scanned anyway, with an explicit allowlist, because the one route to a figure it
      // may ever use is `moneyPredicateAdapter.ts`, which answers in booleans. Naming a monetary
      // column here, or reaching the money tables through any other import, fails the build.
      path: "src/lib/data/progression/medalEvaluation.ts",
      allowedImports: [
        "../../../../generated/prisma/client",
        "@/lib/prisma",
        "@/lib/data/dashboard/dashboardPeriods",
        "@/lib/imageIntake/imageIntakeMarker",
        "./moneyPredicateAdapter",
        "./medalCatalogue",
        // The shared `BR-12-07` store gate. Money-free by construction: it names three columns of
        // `Store`, none of them monetary, and imports nothing but the Prisma enums it compares to.
        "./storeCreditEligibility",
      ],
      anchors: ["evaluateUnlocks", "resolveMedalConditions", "resolveStatefulMedalCurrency"],
    },
  ];

/**
 * Every spelling of a monetary read this codebase actually uses. `cost` and `amount` are listed bare
 * as well as suffixed because both forms exist on real models (`Delivery.cost`,
 * `StorePayment.amount`), and a rule has no business naming either.
 */
const FORBIDDEN_IDENTIFIERS: ReadonlySet<string> = new Set([
  "amount",
  "amountMinor",
  "allocatedAmountMinor",
  "openBalanceMinor",
  "paidAmountMinor",
  "totalCost",
  "unitPrice",
  "cost",
  "currencyCode",
  "exchangeRate",
  "exchangeRateBaseCode",
  "budgetAmount",
  "price",
]);

/** Every minor-unit column in this schema ends this way; the suffix catches the ones not yet named. */
const MINOR_SUFFIX = /Minor$/;

const IDENTIFIER = /[A-Za-z_$][A-Za-z0-9_$]*/g;

/**
 * Blanks out comments and the contents of string/template literals, preserving offsets and
 * newlines, so this file's own prose about `totalCost` (and the guarded modules' explanations of
 * why they may not read it) is never counted as a violation.
 */
function maskLiteralsAndComments(source: string): string {
  const out = source.split("");
  let index = 0;
  const blank = (from: number, to: number): void => {
    for (let cursor = from; cursor < to && cursor < out.length; cursor += 1) {
      if (out[cursor] !== "\n") out[cursor] = " ";
    }
  };

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "/" && next === "/") {
      const end = source.indexOf("\n", index);
      const stop = end === -1 ? source.length : end;
      blank(index, stop);
      index = stop;
      continue;
    }
    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(index, stop);
      index = stop;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      let cursor = index + 1;
      while (cursor < source.length) {
        if (source[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (source[cursor] === char) break;
        cursor += 1;
      }
      blank(index + 1, cursor);
      index = cursor + 1;
      continue;
    }
    index += 1;
  }

  return out.join("");
}

function lineNumberAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

/** Every monetary identifier named in real code (not in a comment or a string), with its line. */
function findMoneyIdentifiers(source: string): string[] {
  const masked = maskLiteralsAndComments(source);
  const hits: string[] = [];

  for (const match of masked.matchAll(IDENTIFIER)) {
    const identifier = match[0];
    if (FORBIDDEN_IDENTIFIERS.has(identifier) || MINOR_SUFFIX.test(identifier)) {
      hits.push(`line ${lineNumberAt(masked, match.index)}: ${identifier}`);
    }
  }

  return hits;
}

function findImportSpecifiers(source: string): string[] {
  const masked = maskLiteralsAndComments(source);
  // Specifiers live inside the literals that were just blanked, so they are read from the raw source
  // and only positioned by the masked copy: a `from "x"` inside a comment must not count.
  const specifiers: string[] = [];
  for (const match of masked.matchAll(/(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*)["']/g)) {
    const quoteIndex = match.index + match[0].length - 1;
    const quote = source[quoteIndex];
    const end = source.indexOf(quote, quoteIndex + 1);
    if (end !== -1) specifiers.push(source.slice(quoteIndex + 1, end));
  }
  return specifiers;
}

/** A rule module that reaches for the order's own total, the shape the scan exists to catch. */
const VIOLATING_FIXTURE = `
export const RULE = {
  ruleKey: "order-settled",
  points: 12,
  isEligible: (order: { id: string; totalCost: number }) => order.totalCost > 0,
};
`;

/** The same rule written correctly: the money question arrives already answered, as a boolean. */
const COMPLIANT_FIXTURE = `
export const RULE = {
  ruleKey: "order-settled",
  points: 12,
  conditions: ["order-settled"],
};
`;

/** Names the forbidden token only in prose and in a string, which is not a read of anything. */
const PROSE_ONLY_FIXTURE = `
// A rule must never read totalCost; the adapter answers that question for it.
export const NOTE = "never read totalCost here";
export const RULE = { ruleKey: "order-settled", points: 12 };
`;

describe("progression money guard", () => {
  it("still points at files that exist", () => {
    // An entry that stops matching a real path turns this whole guard green forever.
    const missing = GUARDED_MODULES.map(({ path }) => path).filter((path) => !existsSync(join(process.cwd(), path)));

    expect(
      missing,
      `Renamed or moved progression rule modules; update the list rather than dropping them:\n${missing}`,
    ).toEqual([]);
  });

  it.each(GUARDED_MODULES)("is reading the file it thinks it is reading: $path", ({ path, anchors }) => {
    // A scan whose anchors have been renamed would pass quietly over a file it no longer understands.
    const source = readFileSync(join(process.cwd(), path), "utf8");

    expect(source.length).toBeGreaterThan(0);
    anchors.forEach((anchor) => expect(source).toContain(anchor));
  });

  it.each(GUARDED_MODULES)("names no monetary field in $path", ({ path }) => {
    const violations = findMoneyIdentifiers(readFileSync(join(process.cwd(), path), "utf8"));

    expect(
      violations,
      `A point rule that can see what a collector spent turns recordkeeping points into a reward for ` +
        `buying. Money conditions must arrive as booleans from moneyPredicateAdapter.ts:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it.each(GUARDED_MODULES)("imports nothing outside its allowlist in $path", ({ path, allowedImports }) => {
    // The identifier scan cannot see a figure fetched through a helper. Keeping these modules as
    // leaves is what removes that route entirely, instead of trying to chase it.
    const unexpected = findImportSpecifiers(readFileSync(join(process.cwd(), path), "utf8")).filter(
      (specifier) => !allowedImports.includes(specifier),
    );

    expect(
      unexpected,
      `A rule module must stay dependency-light. Adding an import here is how a monetary figure ` +
        `arrives without the scan above ever seeing its name:\n${unexpected.join("\n")}`,
    ).toEqual([]);
  });

  it("goes red against a fixture that really does read money", () => {
    // The point of the whole file. A guard that has never been shown a violation is not evidence
    // that the real modules are clean, only that the scanner ran.
    const violations = findMoneyIdentifiers(VIOLATING_FIXTURE);

    expect(violations.some((violation) => violation.includes("totalCost"))).toBe(true);
    expect(findMoneyIdentifiers(COMPLIANT_FIXTURE)).toEqual([]);
  });

  it("catches every spelling it was written to catch, and no innocent one", () => {
    expect(findMoneyIdentifiers("const x = order.amountMinor;").length).toBe(1);
    expect(findMoneyIdentifiers("const x = payment.allocatedAmountMinor;").length).toBe(1);
    expect(findMoneyIdentifiers("const x = delivery.cost;").length).toBe(1);
    expect(findMoneyIdentifiers("const x = item.unitPrice;").length).toBe(1);
    expect(findMoneyIdentifiers("const x = order.currencyCode;").length).toBe(1);
    expect(findMoneyIdentifiers("const x = rate.exchangeRate;").length).toBe(1);
    // The suffix rule carries the columns the explicit list was never told about.
    expect(findMoneyIdentifiers("const x = row.somethingNewMinor;").length).toBe(1);
    // Words that merely contain a forbidden one are not reads of it.
    expect(findMoneyIdentifiers("const costlyName = 1; const accounted = 2;")).toEqual([]);
  });

  it("reads code, not prose, so the modules can explain the rule they follow", () => {
    // Documented blind spot: a monetary name mentioned only in a comment or a string is invisible.
    // It is unreachable in practice because the allowlist above forbids the Prisma import a raw
    // query would need, which is the only way a column name in a string could do anything.
    expect(findMoneyIdentifiers(PROSE_ONLY_FIXTURE)).toEqual([]);
    expect(findImportSpecifiers(`// import { prisma } from "@/lib/prisma";\n`)).toEqual([]);
    expect(findImportSpecifiers(`import { prisma } from "@/lib/prisma";\n`)).toEqual(["@/lib/prisma"]);
  });
});
