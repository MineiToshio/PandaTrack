import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Single-source guard for "how many whole days past its due date is this?".
 *
 * That arithmetic existed THREE times, and the third had drifted: `OrderDetailContent` wrapped it in
 * `Math.max(1, …)`, so an order due today read "Atrasado 1 día" there and "Atrasado" everywhere else.
 * All three are now one definition — `getOverdueDays` in `src/lib/arrivalWindow.ts`, which
 * `getDeliveryOverdueDays` delegates to.
 *
 * THE EXEMPTION IS A MAP OF COUNTS, NOT A LIST OF NAMES, and that is the whole design. Run against
 * all of `src/`, the pattern legitimately matches two files, and two of its three hits are not
 * lateness at all: `DeliveryDetailHero` counts FORWARD to an arrival (`windowStartsIn` /
 * `windowEndsIn`), which has nothing to unify with. A name-based exemption would either have gone
 * permanently red over correct code, or would have tolerated the very regression it exists to catch.
 * Counting fixes both: the budget outside the map is ZERO, so re-pasting a deleted copy cannot stay
 * green (a budget of 1 would have let it).
 *
 * THE EXEMPTION EXPIRED ON ITS OWN, AS DESIGNED, and that is worth recording because it is the part
 * of this scan people are tempted to weaken. `OrderDetailContent` carried an entry of 1 while its
 * copy was still tracked debt; when the follow-up removed that copy its count dropped to 0, the
 * self-verification below went red over the stale entry, and the entry was RETIRED rather than the
 * assertion loosened. Its `today` and its floor had to go in the same pass: fixing the wall-clock
 * instant while keeping `Math.max(1, …)` would still have printed "Atrasado 1 día" on an order due
 * today. The civil-day half is guarded by `src/test/civil-day-guard.test.ts`.
 *
 * WHAT IT CANNOT SEE, by design:
 *
 *   - the same arithmetic spelled differently: a division by a variable computed elsewhere, a
 *     `differenceInDays` from a date library, or a `Math.floor` variant. The pattern covers the
 *     shapes this repo has actually written.
 *   - whether a hit inside the map is still CORRECT. It fixes the count, not the semantics.
 *
 * FIXING A HIT: import `getOverdueDays` from `@/lib/arrivalWindow` and delete the local copy. Never
 * add the file to the map to make the scan pass.
 */

const SRC_DIR = join(process.cwd(), "src");

/**
 * Crosses nested parentheses (the operands are `x.getTime() - y.getTime()`, so a `[^)]*` stops at
 * the first inner `)` and never reaches the divisor) and accepts the divisor as a NAMED CONSTANT,
 * which is how the canonical implementation writes it. A pattern that missed either shape would see
 * only the copy this change deletes, and would then pass trivially forever.
 */
const OVERDUE_FORMULA =
  /Math\.ceil\([\s\S]{0,160}?\/\s*(?:MS_PER_DAY|86_400_000|86400000|24\s*\*\s*60\s*\*\s*60\s*\*\s*1000)/g;

const EXPECTED_HITS: Record<string, number> = {
  "src/lib/arrivalWindow.ts": 1,
  // NOT lateness: `daysToWindow` / `daysToEnd` count forward to an arrival that has not happened.
  "src/app/[locale]/(app)/deliveries/[id]/_components/DeliveryDetailHero.tsx": 2,
};

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function countHits(absolutePath: string): number {
  return (readFileSync(absolutePath, "utf8").match(OVERDUE_FORMULA) ?? []).length;
}

/** Repo-relative, POSIX-shaped, so the map keys read like the paths people write in review. */
function toKey(absolutePath: string): string {
  return relative(process.cwd(), absolutePath).split(sep).join("/");
}

describe("overdue formula single-source guard", () => {
  /**
   * The pattern proves it still matches the real text of every exempt file BEFORE anything is
   * counted. Both previous drafts of this scan were born red because the pattern silently matched
   * nothing, and a structural red like that pushes the next reader to weaken the assertion rather
   * than repair it.
   */
  it.each(Object.entries(EXPECTED_HITS))("still recognises the arithmetic in %s", (path, expected) => {
    expect(countHits(join(process.cwd(), path))).toBe(expected);
  });

  it("has no copy of the formula anywhere outside the map", () => {
    const offenders = listSourceFiles(SRC_DIR)
      .map((file) => [toKey(file), countHits(file)] as const)
      .filter(([key, hits]) => hits > 0 && EXPECTED_HITS[key] === undefined)
      .map(([key, hits]) => `${key} → ${hits}`);

    expect(offenders).toEqual([]);
  });

  it("keeps the orders list chip out of the business of computing days", () => {
    const chip = readFileSync(
      join(process.cwd(), "src/app/[locale]/(app)/orders/_components/share/orderListStatusChip.tsx"),
      "utf8",
    );

    expect(chip).not.toContain("export function describeOverdueDays");
  });

  /**
   * The order detail was the fourth place deciding lateness for itself, and it decided it twice
   * over: it compared `order.expectedDeliveryTo` directly — so an order whose window is open at its
   * start ("a partir del 15", `to` null) was flagged by the list, by the dashboard and by the
   * "Entrega atrasada" filter and raised no banner here — and it knew nothing about the products,
   * so an order whose only product was already on the shelf opened with a `role="alert"` counting a
   * delay above that product's own "Listo en tienda" pill.
   *
   * A static scan rather than a render, because the subject is an async Server Component and the
   * regression is a call site: what can come back is someone re-deriving the answer locally, which
   * is precisely what this file already watches for in the days arithmetic.
   *
   * KNOWN DEBT, NOT CLOSED HERE (named 2026-08-17). A text match like `toMatch(/isOrderOverdue\(
   * order, today\)/)` proves the call site is present, never that it is the ONLY thing deciding
   * whether the banner shows — `isOrderOverdue(order, today) || someOtherCondition` would leave this
   * assertion green while reintroducing exactly the double-decision bug this test exists to catch.
   * Nothing in the suite renders `OrderOverdueBanner` itself and asserts it appears/is absent by
   * `isOrderOverdue`'s own answer. **Documented trigger:** the day `OrderDetailContent` or
   * `OrderOverdueBanner` next changes, add a component-level render test alongside this static one.
   */
  it("has the order detail deciding lateness through the shared predicate", () => {
    const detail = readFileSync(
      join(process.cwd(), "src/app/[locale]/(app)/orders/[id]/_components/OrderDetailContent.tsx"),
      "utf8",
    );

    expect(detail).toMatch(/isOrderOverdue\(order, today\)/);
    expect(detail).not.toMatch(/getOverdueDays\(order\.expectedDeliveryTo/);
    // The banner has to STATE the date the count was made against, or "Atrasado 40 días · Estimado
    // el " ends with nothing after it on exactly the open-ended windows above.
    expect(detail).toMatch(/const dueDate = resolveOrderArrivalDueDate\(order\)/);
  });

  it("has both order-list surfaces importing the canonical helper", () => {
    for (const file of ["OrderCard.tsx", "OrdersTable.tsx"]) {
      const source = readFileSync(join(process.cwd(), "src/app/[locale]/(app)/orders/_components", file), "utf8");

      expect(source).toMatch(/import \{[^}]*getOverdueDays[^}]*\} from "@\/lib\/arrivalWindow"/);
    }
  });
});
