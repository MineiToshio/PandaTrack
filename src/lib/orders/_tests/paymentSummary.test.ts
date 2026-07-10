import { describe, expect, it } from "vitest";
import { calculatePaymentSummary } from "../paymentSummary";

describe("calculatePaymentSummary", () => {
  it("returns zero values when there are no payments", () => {
    const result = calculatePaymentSummary(10000, []);
    expect(result).toEqual({ paidAmount: 0, remainingAmount: 10000, paymentPercentage: 0 });
  });

  it("returns correct values for one partial payment", () => {
    const result = calculatePaymentSummary(10000, [{ amount: 3000 }]);
    expect(result).toEqual({ paidAmount: 3000, remainingAmount: 7000, paymentPercentage: 30 });
  });

  it("returns correct values for multiple partial payments", () => {
    const result = calculatePaymentSummary(10000, [{ amount: 5000 }, { amount: 2000 }]);
    expect(result).toEqual({ paidAmount: 7000, remainingAmount: 3000, paymentPercentage: 70 });
  });

  it("returns 100% and zero remaining when fully paid", () => {
    const result = calculatePaymentSummary(10000, [{ amount: 10000 }]);
    expect(result).toEqual({ paidAmount: 10000, remainingAmount: 0, paymentPercentage: 100 });
  });

  it("uses floor division — does not round up percentage", () => {
    const result = calculatePaymentSummary(10000, [{ amount: 7350 }]);
    expect(result.paymentPercentage).toBe(73);
  });

  it("returns 0% when paidAmount is 0", () => {
    const result = calculatePaymentSummary(10000, [{ amount: 0 }]);
    expect(result.paymentPercentage).toBe(0);
  });

  it("returns 0 for all fields when totalCost is 0", () => {
    const result = calculatePaymentSummary(0, []);
    expect(result).toEqual({ paidAmount: 0, remainingAmount: 0, paymentPercentage: 0 });
  });

  it("clamps remaining at 0 when payments exceed the total (overpayment)", () => {
    const result = calculatePaymentSummary(10000, [{ amount: 15000 }]);
    expect(result.paidAmount).toBe(15000);
    expect(result.remainingAmount).toBe(0);
  });

  it("clamps percentage at 100 when payments exceed the total (overpayment)", () => {
    const result = calculatePaymentSummary(10000, [{ amount: 15000 }]);
    expect(result.paymentPercentage).toBe(100);
  });

  it("never returns a negative remaining amount", () => {
    const result = calculatePaymentSummary(5000, [{ amount: 3000 }, { amount: 4000 }]);
    expect(result.remainingAmount).toBeGreaterThanOrEqual(0);
    expect(result.paymentPercentage).toBeLessThanOrEqual(100);
  });
});
