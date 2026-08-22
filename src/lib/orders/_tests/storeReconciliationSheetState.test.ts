import { describe, expect, it } from "vitest";
import {
  buildReconciliationLines,
  canSubmitReconciliation,
  computeOpenGroupWriteOffMinor,
  computeReconciliationReadOutMinor,
  hasInvalidRemainingMark,
  isInvalidRemainingMinor,
  markAllSettled,
  resolveLineAmountMinor,
  sumOpenGroupLinesMinor,
  type ReconciliationRowInput,
} from "../storeReconciliationSheetState";

describe("storeReconciliationSheetState", () => {
  describe("resolveLineAmountMinor", () => {
    it("writes off the difference between the balance and the typed remainder", () => {
      expect(resolveLineAmountMinor(10000, 4000)).toBe(6000);
    });

    it("returns null when the typed remainder equals the balance (no line)", () => {
      expect(resolveLineAmountMinor(10000, 10000)).toBeNull();
    });

    it("returns 0-remainder as the whole balance written off (settled)", () => {
      expect(resolveLineAmountMinor(10000, 0)).toBe(10000);
    });

    it("rejects a remainder above the order's own balance", () => {
      expect(resolveLineAmountMinor(10000, 10001)).toBeNull();
    });

    it("rejects a negative remainder", () => {
      expect(resolveLineAmountMinor(10000, -1)).toBeNull();
    });

    it("rejects a non-integer remainder", () => {
      expect(resolveLineAmountMinor(10000, 50.5)).toBeNull();
    });
  });

  describe("buildReconciliationLines", () => {
    const rows: ReconciliationRowInput[] = [
      { orderId: "order-a", openBalanceMinor: 18000 },
      { orderId: "order-b", openBalanceMinor: 20000 },
    ];

    it("builds one line per marked order, skipping untouched ones", () => {
      const lines = buildReconciliationLines(rows, { "order-a": 0 });
      expect(lines).toEqual([{ orderId: "order-a", amountMinor: 18000 }]);
    });

    it("never derives a line for an order the collector did not mark (ADR 0025/0028)", () => {
      expect(buildReconciliationLines(rows, {})).toEqual([]);
    });

    it("builds a partial line from a typed remainder", () => {
      const lines = buildReconciliationLines(rows, { "order-b": 5000 });
      expect(lines).toEqual([{ orderId: "order-b", amountMinor: 15000 }]);
    });
  });

  describe('markAllSettled — "todo saldado"', () => {
    it("marks every listed row's remainder at 0, one line per order once built", () => {
      const rows: ReconciliationRowInput[] = [
        { orderId: "order-a", openBalanceMinor: 18000 },
        { orderId: "order-b", openBalanceMinor: 20000 },
      ];
      const marks = markAllSettled(rows);
      const lines = buildReconciliationLines(rows, marks);
      // MUTATION CHECK (per WO-11 task spec): if "mark settled" ever sent `totalCost` (or any
      // figure other than the row's own `openBalanceMinor`) instead of the balance, this assertion
      // is exactly the one that would catch it — a `totalCost` of, say, 25000 on order-a would
      // produce a line of 25000 here, not 18000.
      expect(lines).toEqual([
        { orderId: "order-a", amountMinor: 18000 },
        { orderId: "order-b", amountMinor: 20000 },
      ]);
    });
  });

  describe("computeOpenGroupWriteOffMinor / computeReconciliationReadOutMinor", () => {
    const openOrders: ReconciliationRowInput[] = [
      { orderId: "open-1", openBalanceMinor: 18000 },
      { orderId: "open-2", openBalanceMinor: 20000 },
    ];
    it("sums only the OPEN group's lines, never the delivered group's", () => {
      const marks = { "open-1": 0, "delivered-1": 0 };
      expect(computeOpenGroupWriteOffMinor(openOrders, marks)).toBe(18000);
    });

    it("the read-out is the open-order debt minus exactly the open-group lines being written", () => {
      const marks = { "open-1": 0 };
      const readOut = computeReconciliationReadOutMinor(38000, openOrders, marks);
      expect(readOut).toBe(38000 - 18000);
    });

    it("a delivered-order mark never moves the read-out (it is already outside the figure)", () => {
      const marks = { "delivered-1": 0 };
      expect(computeReconciliationReadOutMinor(38000, openOrders, marks)).toBe(38000);
    });

    // MUTATION CHECK (per WO-11 task spec): a read-out implementation that ignored `marks`
    // entirely (returning the raw `openOrderDebtMinor` unconditionally) would still pass the
    // "no marks" case above but fails this one, where marking open-1 settled must lower the figure.
    it("fails if the read-out ignores the marks (regression guard)", () => {
      const withNoMarks = computeReconciliationReadOutMinor(38000, openOrders, {});
      const withOneMarked = computeReconciliationReadOutMinor(38000, openOrders, { "open-1": 0 });
      expect(withOneMarked).not.toBe(withNoMarks);
      expect(withOneMarked).toBeLessThan(withNoMarks);
    });
  });

  describe("canSubmitReconciliation", () => {
    it("requires at least one line and a non-empty reason", () => {
      expect(canSubmitReconciliation([], "")).toBe(false);
      expect(canSubmitReconciliation([{ orderId: "a", amountMinor: 100 }], "")).toBe(false);
      expect(canSubmitReconciliation([], "no identificado")).toBe(false);
      expect(canSubmitReconciliation([{ orderId: "a", amountMinor: 100 }], "no identificado")).toBe(true);
    });

    it("treats a whitespace-only reason as empty", () => {
      expect(canSubmitReconciliation([{ orderId: "a", amountMinor: 100 }], "   ")).toBe(false);
    });
  });

  describe("sumOpenGroupLinesMinor (FIX 1, WO-11 review)", () => {
    it("sums only the lines whose orderId is in the open-orders set", () => {
      const lines = [
        { orderId: "open-1", amountMinor: 18000 },
        { orderId: "delivered-1", amountMinor: 7000 },
      ];
      expect(sumOpenGroupLinesMinor(lines, new Set(["open-1"]))).toBe(18000);
    });

    it("returns 0 when no line belongs to the open group", () => {
      const lines = [{ orderId: "delivered-1", amountMinor: 7000 }];
      expect(sumOpenGroupLinesMinor(lines, new Set(["open-1"]))).toBe(0);
    });

    it("returns 0 for an empty declaration", () => {
      expect(sumOpenGroupLinesMinor([], new Set(["open-1"]))).toBe(0);
    });
  });

  describe("isInvalidRemainingMinor (MINOR-7, WO-11 review)", () => {
    it("flags a remainder above the order's own balance", () => {
      expect(isInvalidRemainingMinor(10000, 10001)).toBe(true);
    });

    it("flags a negative remainder", () => {
      expect(isInvalidRemainingMinor(10000, -1)).toBe(true);
    });

    it("does not flag the remainder equal to the balance (that is 'no line', not an error)", () => {
      expect(isInvalidRemainingMinor(10000, 10000)).toBe(false);
    });

    it("does not flag a valid partial or full write-off", () => {
      expect(isInvalidRemainingMinor(10000, 4000)).toBe(false);
      expect(isInvalidRemainingMinor(10000, 0)).toBe(false);
    });
  });

  describe("hasInvalidRemainingMark (MINOR-7, WO-11 review)", () => {
    const rows: ReconciliationRowInput[] = [
      { orderId: "order-a", openBalanceMinor: 18000 },
      { orderId: "order-b", openBalanceMinor: 20000 },
    ];

    it("is true when one marked row's remainder is out of range, even while another row is valid", () => {
      // MUTATION CHECK: a gate computed only from `buildReconciliationLines`'s surviving lines would
      // miss this entirely, because the invalid row simply produces no line at all rather than one
      // that fails validation — this is exactly the row that must still block submit.
      expect(hasInvalidRemainingMark(rows, { "order-a": 0, "order-b": 20001 })).toBe(true);
    });

    it("is false when every marked row is within range", () => {
      expect(hasInvalidRemainingMark(rows, { "order-a": 0, "order-b": 5000 })).toBe(false);
    });

    it("is false when no row is marked at all", () => {
      expect(hasInvalidRemainingMark(rows, {})).toBe(false);
    });

    it("is false for a row marked back to its own balance (no line, not an error)", () => {
      expect(hasInvalidRemainingMark(rows, { "order-a": 18000 })).toBe(false);
    });
  });
});
