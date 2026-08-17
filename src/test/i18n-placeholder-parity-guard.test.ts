import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LOCALES,
  SRC_DIR,
  catalogTextsFor,
  collectSourceFiles,
  literalCallSites,
  maskComments,
  type LiteralCallSite,
} from "./i18nGuardParsing";

/**
 * Placeholder-parity guard.
 *
 * `i18n-referenced-keys-guard` proves a literal key EXISTS in both catalogs. It says nothing about
 * whether the vars object the call site passes actually FEEDS the placeholders that key's copy asks
 * for. That gap shipped: `StorePaymentAllocationPanel.tsx` calls
 * `t("allocations.totalsAssigned", { assigned, payment })`, but the catalog text read
 * `"Asignado: {amount}"` — a placeholder name from an earlier draft of the copy that the batch which
 * added the other 48 keys never reconciled against the call site. next-intl has no static check for
 * this: it throws `FORMATTING_ERROR` at render time, and the component's own tests stayed green
 * because they mock `next-intl` and assert against the key text, never against real ICU formatting.
 *
 * The check: for every literal `t("key", { ... })` call whose second argument is an inline object
 * literal (see {@link LiteralCallSite}), extract the ICU `{placeholder}` names the resolved catalog
 * text uses, in BOTH locales, and require every one of them to be a key of the object literal. The
 * call site is the source of truth — copy is written to fit the data the component already computed,
 * never the other way around.
 *
 * WHAT IT CANNOT SEE, by design:
 *
 *   - Any call whose second argument is not a statically-readable inline object literal:
 *     a variable reference (`t(key, vars)`), a spread (`{ ...rest }`), a computed key (`{ [k]: v }`),
 *     or a ternary/logical expression in argument position. `literalCallSites` marks these `varNames:
 *     null` and this guard skips them rather than fake a verdict. The live example before this guard
 *     shipped was NONE of these: `totalsAssigned`'s call sites are both plain inline objects, which is
 *     exactly the shape this guard exists to cover.
 *   - `t.rich(...)` / `t.markup(...)` calls. Their second argument holds tag-RENDER FUNCTIONS
 *     (`strong: (chunks) => <strong>{chunks}</strong>`), not ICU format values, so the object's keys
 *     are never comparable to a `{placeholder}` name — `t.rich("key", { strong: fn })` is correct
 *     copy for text with no `{strong}` placeholder at all.
 *   - A key resolved through a `t` variable bound to more than one namespace whose candidates land on
 *     DIFFERENT texts with different placeholder needs in different scopes. Every resolvable candidate
 *     is checked, same widen-not-narrow policy as `i18n-referenced-keys-guard`.
 *   - ICU placeholders reached only through `unionMembers`-style dynamic templates
 *     (`` t(`error.${code}`) ``): those calls have no literal key at all, so `literalCallSites` never
 *     sees them. In this codebase every dynamic error surface renders with no second argument, so the
 *     gap is theoretical today; `i18n-referenced-keys-guard`'s `REFUSAL_UNIONS` is where existence for
 *     that family is enforced.
 *
 * A green run is not proof every `t(...)` call is safe: it is proof every STATICALLY READABLE one has
 * a catalog entry, in both locales, whose placeholders are exactly covered by what the call passes.
 */

const IDENT_CHAR = /[A-Za-z0-9_$]/;
const SPACE_CHAR = /\s/;
const PLURAL_FORMATS = new Set(["plural", "select", "selectordinal"]);

/**
 * Every top-level `{name}` argument an ICU message text references, including the argument of a
 * `{name, plural, ...}` / `{name, select, ...}` construct.
 *
 * A flat regex over `\{identifier` is not enough: `{count, plural, one {producto} other {productos}}`
 * has to yield only `count`, but a regex that just matches `{word` also fires on `{producto}` and
 * `{productos}` — those are the LITERAL branch bodies of the plural construct, not placeholders, and
 * a bare `#` inside a branch body (`{# line}`) is the ICU pound sign, not an identifier either. This
 * is a small brace-depth-aware parser instead: it reads the argument name, and when the format is
 * `plural`/`select`/`selectordinal` it walks `selector {body}` pairs by depth rather than by content,
 * recursing into each body (so a body that legitimately re-uses or introduces further placeholders is
 * still covered) instead of treating the body's first word as a name.
 */
export function placeholdersIn(text: string): Set<string> {
  const out = new Set<string>();
  const n = text.length;
  let i = 0;

  function skipSpaces() {
    while (i < n && SPACE_CHAR.test(text[i])) i += 1;
  }

  function readIdentifier(): string {
    const start = i;
    while (i < n && IDENT_CHAR.test(text[i])) i += 1;
    return text.slice(start, i);
  }

  /** Index of the `}` that closes the single outstanding `{` already consumed before the call. */
  function matchingBraceEnd(from: number): number {
    let depth = 1;
    let j = from;
    while (j < n && depth > 0) {
      if (text[j] === "{") depth += 1;
      else if (text[j] === "}") depth -= 1;
      if (depth > 0) j += 1;
    }
    return j;
  }

  function parseMessage(limit: number) {
    while (i < limit) {
      if (text[i] !== "{") {
        i += 1;
        continue;
      }
      i += 1; // consume '{'
      skipSpaces();
      const name = readIdentifier();
      skipSpaces();

      if (name && text[i] === "}") {
        out.add(name);
        i += 1;
        continue;
      }

      if (name && text[i] === ",") {
        out.add(name); // the argument itself is a real placeholder either way
        i += 1;
        skipSpaces();
        const formatType = readIdentifier();
        skipSpaces();

        if (PLURAL_FORMATS.has(formatType)) {
          if (text[i] === ",") i += 1;
          const constructEnd = matchingBraceEnd(i);
          while (i < constructEnd) {
            while (i < constructEnd && text[i] !== "{") i += 1; // walk past the selector token
            if (i >= constructEnd) break;
            i += 1; // consume the branch body's '{'
            const bodyEnd = matchingBraceEnd(i);
            parseMessage(bodyEnd); // `#` and stray text are inert; nested placeholders still count
            i = bodyEnd + 1;
          }
          i = constructEnd + 1;
          continue;
        }

        // `number` / `date` / `time` / an unrecognized format: the style keyword that follows is
        // never a placeholder, so just skip to this construct's own closing brace.
        i = matchingBraceEnd(i) + 1;
        continue;
      }

      // Not `{name}` and not `{name, ...}`: not a placeholder shape (e.g. the `#` inside a plural
      // branch). The `{` already consumed is treated as inert text and scanning continues from here.
    }
  }

  parseMessage(n);
  return out;
}

const CATALOG_TEXTS: Record<string, Map<string, string>> = Object.fromEntries(
  LOCALES.map((locale) => [locale, catalogTextsFor(locale)]),
);

/** Call sites this guard can actually verify: inline object literal, not a `.rich`/`.markup` call. */
function checkableSites(masked: string): LiteralCallSite[] {
  return literalCallSites(masked).filter((site) => !site.isRich && site.varNames !== null);
}

describe("i18n placeholder parity", () => {
  it("passes every ICU placeholder the resolved catalog copy needs, in both locales", () => {
    const missing: string[] = [];

    for (const file of collectSourceFiles(SRC_DIR)) {
      const source = readFileSync(file, "utf8");
      const masked = maskComments(source);
      const relative = file.slice(file.indexOf("src/"));

      for (const site of checkableSites(masked)) {
        const callVars = new Set(site.varNames);

        for (const candidate of site.candidates) {
          for (const locale of LOCALES) {
            const text = CATALOG_TEXTS[locale].get(candidate);
            if (text === undefined) continue; // existence is i18n-referenced-keys-guard's job.

            for (const name of placeholdersIn(text)) {
              if (callVars.has(name)) continue;
              const passed = [...callVars].sort().join(", ") || "nothing";
              missing.push(
                `${relative} → t("${site.key}") needs {${name}} for ${locale} "${candidate}" ` +
                  `("${text}"), but the call site only passes: ${passed}`,
              );
            }
          }
        }
      }
    }

    expect(
      [...new Set(missing)].sort(),
      "A catalog placeholder with no matching call-site variable throws next-intl's FORMATTING_ERROR " +
        "at render time. Fix the CATALOG text to use the call site's variable names, never the other " +
        "way: the call site already computed the data it has, and renaming its variables to match a " +
        "typo in copy is backwards.\n" +
        `${[...new Set(missing)].sort().join("\n")}`,
    ).toEqual([]);
  });

  it("still recognizes the shapes it was written to catch", () => {
    const fixture = `
      const t = useTranslations("orders.detail.storePayment");
      function Panel() {
        return t("allocations.totalsAssigned", {
          assigned: formatAmountWithSymbol(x, y, z),
          payment: formatAmountWithSymbol(a, b, c),
        });
      }
    `;
    const masked = maskComments(fixture);
    const sites = checkableSites(masked);
    const totalsAssigned = sites.find((site) => site.key === "allocations.totalsAssigned");
    expect(totalsAssigned?.varNames?.sort()).toEqual(["assigned", "payment"]);
    expect(totalsAssigned?.candidates).toEqual(["orders.detail.storePayment.allocations.totalsAssigned"]);

    expect([...placeholdersIn("Asignado: {amount}")]).toEqual(["amount"]);
    expect([...placeholdersIn("{count, plural, one {# line} other {# lines}} · {amount}")]).toEqual([
      "count",
      "amount",
    ]);

    const opaqueFixture = `
      const t = useTranslations("orders");
      function Row() {
        return [
          t("detail.storePayment.title", vars),
          t.rich("detail.items.title", { strong: (chunks) => chunks }),
          t("detail.storePayment.title", { ...rest }),
        ];
      }
    `;
    const opaqueSites = literalCallSites(maskComments(opaqueFixture));
    expect(opaqueSites.every((site) => site.varNames === null || site.isRich)).toBe(true);
  });
});
