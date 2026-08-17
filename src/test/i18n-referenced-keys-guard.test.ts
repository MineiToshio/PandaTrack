import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  boundNamespaces,
  catalogFor,
  collectSourceFiles,
  LOCALES,
  maskComments,
  referencedKeyCandidates,
  SRC_DIR,
  unionMembers,
} from "./i18nGuardParsing";

/**
 * Referenced-key guard.
 *
 * `i18n-locale-parity` compares `es` against `en`, so a key the CODE asks for and NEITHER locale
 * defines is symmetric drift and passes silently. Without `onError`/`getMessageFallback` in
 * `src/i18n/request.ts`, use-intl then renders the raw key PATH on screen, inside `aria-label`s and
 * inside button labels. That shipped: the store payment sheet's whole allocation panel referenced 46
 * keys no catalog defined, and the store detail's report banner two more, and every test stayed
 * green because the component tests mock `next-intl` and assert against the key text itself.
 *
 * This scan covers the two shapes a key reaches a catalog through:
 *
 *   1. A LITERAL key resolved against the namespace its `t` was bound to
 *      (`const t = useTranslations("orders")` → `t("detail.items.title")` → `orders.detail.items.title`).
 *   2. A REFUSAL CODE reaching a catalog through a template (`` t(`error.${result.error}`) ``). The
 *      key is not literal anywhere, so form 1 is blind to exactly the family whose absence is the
 *      loudest: the user reads "Ocurrió un error inesperado" for a refusal the server named
 *      precisely. The union that feeds each such surface IS statically derivable, so it is read from
 *      its declaration and every member is required to have copy.
 *
 * WHAT IT CANNOT SEE, by design:
 *
 *   - A key held in a lookup table rather than written at the call site. The live example is
 *     `FILL_DISABLED_KEY` in `StorePaymentAllocationRow.tsx`: a `Record<FillDisabledReason, string>`
 *     of key paths indexed at render time. Its three keys were missing too and were found by hand,
 *     not by this scan. Recognizing that shape generically means guessing which string literals are
 *     key paths, which produces false positives on ordinary strings.
 *   - A `t` variable whose namespace is not a string literal (`useTranslations(namespace)`), and
 *     every key resolved through it.
 *   - Refusal surfaces OUTSIDE the `orders` namespace tree (`deliveries.error.*`,
 *     `stores.*.error.*`). Their unions are relayed through actions that widen `error` to `string`,
 *     so each needs its own hand-traced registry entry; they are listed as unregistered rather than
 *     silently treated as covered. Extending {@link REFUSAL_UNIONS} to them is the way in.
 *
 * A green run is not proof that every key exists. It is proof that these two shapes do.
 *
 * A key existing is a different question from its copy taking the right ARGUMENTS: see the sibling
 * `i18n-placeholder-parity-guard.test.ts` for that check. The scanning primitives both files share
 * (`maskComments`, `boundNamespaces`, catalog loading) live in `./i18nGuardParsing`, a plain module
 * rather than a third spec file, so importing it never re-runs another file's `describe` blocks.
 */

const CATALOGS: Record<string, Set<string>> = Object.fromEntries(LOCALES.map((locale) => [locale, catalogFor(locale)]));

/**
 * Refusal-code unions and the catalog node their codes are rendered under.
 *
 * Each entry is hand-traced from a `` t(`<prefix>.${code}`) `` call site back to the union that can
 * produce that code, because every action in between widens `error` to `string`. Adding a dynamic
 * error surface under `orders` without adding an entry here fails the coverage test below.
 */
const REFUSAL_UNIONS: Array<{ file: string; type: string; prefix: string }> = [
  { file: "src/lib/data/orders/orderMutations.ts", type: "CreateOrderResult", prefix: "orders.error" },
  { file: "src/lib/data/orders/orderMutations.ts", type: "EditOrderResult", prefix: "orders.error" },
  {
    file: "src/lib/data/orders/storePaymentMutations.ts",
    type: "CreateStorePaymentError",
    prefix: "orders.detail.storePayment.error",
  },
  {
    file: "src/lib/data/deliveries/deliveryMutations.ts",
    type: "CreateDeliveryResult",
    prefix: "orders.detail.quickArrival.error",
  },
];

/** `` `error.${x}` `` / `` `detail.quickArrival.error.${x}` `` — the static half of a dynamic key. */
const DYNAMIC_ERROR_TEMPLATE = /`((?:[A-Za-z]\w*\.)*error)\.\$\{/g;

describe("i18n referenced keys", () => {
  it("defines every literal key the code asks for, in both locales", () => {
    const missing: string[] = [];

    for (const file of collectSourceFiles(SRC_DIR)) {
      const source = readFileSync(file, "utf8");
      const masked = maskComments(source);
      const relative = file.slice(file.indexOf("src/"));

      for (const { key, candidates } of referencedKeyCandidates(masked, source)) {
        for (const locale of LOCALES) {
          if (candidates.some((candidate) => CATALOGS[locale].has(candidate))) continue;
          missing.push(`${relative} → "${key}" resolves to ${candidates.join(" | ")}, undefined in ${locale}`);
        }
      }
    }

    expect(
      [...new Set(missing)].sort(),
      "A key the code asks for and no catalog defines renders as its own raw path on screen, " +
        "including inside aria-labels. Locale parity cannot see it: the absence is symmetric.\n" +
        `${[...new Set(missing)].sort().join("\n")}`,
    ).toEqual([]);
  });

  it("defines copy for every member of every refusal union rendered through a template", () => {
    const missing: string[] = [];

    for (const { file, type, prefix } of REFUSAL_UNIONS) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      const members = unionMembers(source, type);
      expect(
        members.length,
        `${file} → ${type} yielded no members; the declaration moved or was renamed`,
      ).toBeGreaterThan(0);

      for (const member of members) {
        for (const locale of LOCALES) {
          if (CATALOGS[locale].has(`${prefix}.${member}`)) continue;
          missing.push(`${prefix}.${member} (from ${type}) undefined in ${locale}`);
        }
      }
    }

    expect(
      [...new Set(missing)].sort(),
      "A refusal code with no copy falls back to the generic error, so the server names the problem " +
        "precisely and the user is told nothing.\n" +
        `${[...new Set(missing)].sort().join("\n")}`,
    ).toEqual([]);
  });

  it("has a registered union behind every dynamic error surface in the orders namespace", () => {
    const registeredPrefixes = new Set(REFUSAL_UNIONS.map((entry) => entry.prefix));
    const unregistered: string[] = [];

    for (const file of collectSourceFiles(SRC_DIR)) {
      const source = readFileSync(file, "utf8");
      const namespaces = [...boundNamespaces(maskComments(source)).values()]
        .filter((value): value is Set<string> => value !== null)
        .flatMap((value) => [...value]);
      if (!namespaces.some((namespace) => namespace === "orders" || namespace.startsWith("orders."))) continue;

      DYNAMIC_ERROR_TEMPLATE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = DYNAMIC_ERROR_TEMPLATE.exec(source)) !== null) {
        const candidates = namespaces.map((namespace) => `${namespace}.${match![1]}`);
        if (candidates.some((candidate) => registeredPrefixes.has(candidate))) continue;
        unregistered.push(`${file.slice(file.indexOf("src/"))} → \`${match[1]}.\${…}\` (${candidates.join(" | ")})`);
      }
    }

    expect(
      [...new Set(unregistered)].sort(),
      "A dynamic error surface with no entry in REFUSAL_UNIONS is copy nobody checks. Trace the " +
        "codes it can render back to their union and register it.\n" +
        `${[...new Set(unregistered)].sort().join("\n")}`,
    ).toEqual([]);
  });

  it("still recognizes the shapes it was written to catch", () => {
    // Locks the scan against a refactor that quietly stops matching. Three shapes, all real:
    // a plain binding, a variable bound twice in one file, and a union declaration.
    const fixture = `
      const t = useTranslations("orders");
      const tOther = useTranslations("orderListing");
      function Inner() {
        const t = useTranslations("stores.detail");
        return t("reportNoticeTitle");
      }
      export default function Outer() {
        return [t("detail.items.title"), tOther("storeView.title")];
      }
    `;
    const masked = maskComments(fixture);

    const bindings = boundNamespaces(masked);
    expect([...(bindings.get("t") as Set<string>)].sort()).toEqual(["orders", "stores.detail"]);
    expect([...(bindings.get("tOther") as Set<string>)]).toEqual(["orderListing"]);

    const referenced = referencedKeyCandidates(masked, fixture);
    // The shadowed `t` yields BOTH candidates for each of its keys, which is what keeps the
    // two-scopes-one-name shape from being reported as missing.
    expect(referenced.find((entry) => entry.key === "reportNoticeTitle")?.candidates.sort()).toEqual([
      "orders.reportNoticeTitle",
      "stores.detail.reportNoticeTitle",
    ]);
    expect(referenced.find((entry) => entry.key === "storeView.title")?.candidates).toEqual([
      "orderListing.storeView.title",
    ]);

    const unionFixture = `
      type SampleResult =
        | { ok: true }
        | { ok: false; error: "ALPHA" | "BETA"; detail?: string };
      const unrelated = "NOT_A_CODE";
    `;
    expect(unionMembers(unionFixture, "SampleResult")).toEqual(["ALPHA", "BETA"]);
  });

  it("reads the real refusal unions, not only fixtures", () => {
    // Asserted against the shipped files for the same reason the transaction-refusal guard does it:
    // a fixture that parses while the code it stands for does not proves nothing. If a union is
    // renamed, update REFUSAL_UNIONS — never drop the entry.
    const editOrder = readFileSync(join(process.cwd(), "src/lib/data/orders/orderMutations.ts"), "utf8");
    expect(unionMembers(editOrder, "EditOrderResult")).toContain("ITEM_HAS_ALLOCATION");

    const storePayment = readFileSync(join(process.cwd(), "src/lib/data/orders/storePaymentMutations.ts"), "utf8");
    expect(unionMembers(storePayment, "CreateStorePaymentError")).toContain("EXCEEDS_ITEM_BASE");
  });
});
