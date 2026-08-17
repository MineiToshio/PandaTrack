import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Money-modules guard: the coverage axis never touches the money axis (invariant I1).
 *
 * `OrderItem.paidDeclaredAt` is the collector's claim that a product is paid, with no amount
 * attached. The whole model rests on that claim moving NOTHING: not `Order.allocatedAmountMinor`,
 * not a store's debt, not a dashboard figure, not the set of orders that earn a payment reminder.
 * The day it does, an amount nobody ever recorded starts closing the books.
 *
 * A unit test cannot state that. Those figures are computed in other modules, so a test asserting
 * "this mutation did not call `order.update`" stays green forever while somebody teaches the
 * dashboard to read the column. This scan is the shape that CAN go red: the modules that produce
 * every money figure are enumerated below, and none of them may so much as name the column, and
 * none of them may reach it indirectly by importing `resolveProductPaymentState` /
 * `resolveOrderMarkReconciliation` from `@/lib/orders/productPaymentState` — the one module that IS
 * allowed to read the mark, and whose whole contract is to never let it move money.
 *
 * If a genuine need ever arises to read it in one of these files, that is a decision to argue in an
 * ADR and the entry comes out of the list deliberately. Do not relax the pattern.
 *
 * WHAT IT CANNOT SEE, by design:
 *
 *   - Two deliberately excluded money producers that DO read `paidDeclaredAt`, on the coverage
 *     axis, not the money one: `src/lib/data/orders/orderQueries.ts` (`OrderItemWithDeliveryState`
 *     carries `paidDeclared` so the detail can render the mark) and
 *     `src/lib/data/orders/storePaymentAssignableOrdersQueries.ts` (same field, same reason, for the
 *     allocation sheet). Both also compute real money figures in the same file — `paidAmount` /
 *     `remainingAmount` / `hasUnpaidBalance` / `paymentPercentage` in the first,
 *     `assignableMinor` / `restCeilingMinor` in the second — but those figures are derived from
 *     `PaymentAllocation.amountMinor` alone, never from the mark. They stay off {@link
 *     MONEY_MODULES} because a UI-facing query module legitimately reads and relays a dozen fields
 *     for its DTO, coverage included; the list below is only the narrower set of modules whose SOLE
 *     job is producing a money figure, where the mark has no reason to appear at all.
 *   - Any other file this scan was never pointed at. A green run proves these {@link MONEY_MODULES}
 *     stayed clean, not that the invariant holds everywhere.
 */

const MONEY_MODULES = [
  "src/lib/data/dashboard/dashboardRollup.ts",
  "src/lib/data/dashboard/dashboardAggregation.ts",
  "src/lib/data/dashboard/dashboardQueries.ts",
  "src/lib/data/orders/storePaymentQueries.ts",
  "src/lib/data/orders/orderPaymentAllocations.ts",
  "src/lib/data/notifications/reminderCandidateQueries.ts",
  "src/lib/orders/paymentSummary.ts",
  "src/lib/orders/storePaymentPresentation.ts",
  // Splits one payment into the amounts written against each product. Its sole job is producing a
  // money figure, and the mark carries no amount, so weighing a split by it would invent one.
  "src/lib/orders/splitPaymentAmount.ts",
] as const;

/** Both spellings, and both the field and its DTO alias: the Prisma field, the SQL column a raw
 *  query would reach for, and `paidDeclared` (no `At`), the name every DTO in this codebase uses
 *  for `paidDeclaredAt !== null` (`orderQueries.ts`, `pendingProductsByStoreQueries.ts`,
 *  `storePaymentAssignableOrdersQueries.ts`, `buildAllocationLines.ts`). */
const COVERAGE_REFERENCE = /paidDeclared(?:At)?|paid_declared_at/;

/** The one module allowed to read the mark; a money module reaching it indirectly defeats the scan
 *  above exactly as if it had named the column itself. Matches the module by its filename alone
 *  (not anchored to the `@/` alias), so a relative import (`../../orders/productPaymentState`)
 *  cannot dodge the scan the alias-only pattern used to miss. */
const COVERAGE_RESOLVER_IMPORT = /from\s+["'][^"']*productPaymentState["']/;

describe("money modules guard", () => {
  it("still points at files that exist", () => {
    // An entry that silently stops matching a real path turns this whole guard green forever.
    const missing = MONEY_MODULES.filter((relative) => !existsSync(join(process.cwd(), relative)));
    expect(missing, `Renamed or moved money modules; update the list rather than dropping them:\n${missing}`).toEqual(
      [],
    );
  });

  it("keeps the paid mark out of every module that produces a money figure (I1)", () => {
    const violations: string[] = [];

    for (const relative of MONEY_MODULES) {
      const source = readFileSync(join(process.cwd(), relative), "utf8");
      source.split("\n").forEach((line, index) => {
        if (COVERAGE_REFERENCE.test(line)) violations.push(`${relative}:${index + 1} — ${line.trim()}`);
      });
    }

    expect(
      violations,
      "A paid mark carries no amount, so any money figure derived from it is invented. These modules " +
        "compute the collector's debts, dashboard totals and payment reminders and must not read it:\n" +
        `${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("names the modules that actually own the money figures", () => {
    // Asserted against the shipped files, not a fixture: the list is only protection while it is
    // still pointed at the code that computes debt, dashboard totals and reminders.
    const debt = readFileSync(join(process.cwd(), "src/lib/data/orders/storePaymentQueries.ts"), "utf8");
    expect(debt).toContain("debtMinor");

    const reminders = readFileSync(
      join(process.cwd(), "src/lib/data/notifications/reminderCandidateQueries.ts"),
      "utf8",
    );
    expect(reminders).toContain("allocatedAmountMinor");
  });

  it("keeps every money module from reaching the mark indirectly through productPaymentState (I1)", () => {
    // The direct-reference scan above cannot see a money module that never types `paidDeclared`
    // itself but imports the one module that already resolves it — `resolveProductPaymentState`
    // or `resolveOrderMarkReconciliation` — and calls that instead. Same invariant, a second door.
    const violations: string[] = [];

    for (const relative of MONEY_MODULES) {
      const source = readFileSync(join(process.cwd(), relative), "utf8");
      if (COVERAGE_RESOLVER_IMPORT.test(source)) violations.push(relative);
    }

    expect(
      violations,
      "A money module importing @/lib/orders/productPaymentState reaches the paid mark without ever " +
        "naming the column, which the direct-reference scan cannot catch:\n" +
        `${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("still recognizes the shapes it was written to catch", () => {
    // Locks both patterns against a refactor that quietly stops matching: the DTO alias with no
    // `At` (the shape the direct scan used to miss) and the indirect import (the second door).
    expect(COVERAGE_REFERENCE.test("paidDeclaredAt: true,")).toBe(true);
    expect(COVERAGE_REFERENCE.test("paidDeclared: item.paidDeclaredAt !== null,")).toBe(true);
    expect(COVERAGE_REFERENCE.test("paid_declared_at")).toBe(true);
    expect(COVERAGE_REFERENCE.test("const paid = true;")).toBe(false);

    expect(
      COVERAGE_RESOLVER_IMPORT.test(`import { resolveProductPaymentState } from "@/lib/orders/productPaymentState";`),
    ).toBe(true);
    expect(
      COVERAGE_RESOLVER_IMPORT.test(`import { calculatePaymentSummary } from "@/lib/orders/paymentSummary";`),
    ).toBe(false);
  });
});
