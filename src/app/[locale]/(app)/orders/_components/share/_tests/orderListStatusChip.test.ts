import { describe, expect, it } from "vitest";
import {
  describeArrivalOverdueLabel,
  describeOrderListBalanceChip,
  describeOrderListChip,
  describeOverdueLabel,
} from "../orderListStatusChip";

/**
 * `FR-05-35`: a pedido that is finished but still owes money has to say so in the LIST, not only in
 * the detail. Before this chip existed, a completed pedido rendered one green "Completado" and
 * nothing else, which is how a set of delivered pedidos carrying real debt stayed invisible.
 */
describe("describeOrderListBalanceChip", () => {
  it("flags a completed order that still has money outstanding", () => {
    expect(describeOrderListBalanceChip({ status: "COMPLETED", hasUnpaidBalance: true })).toMatchObject({
      toneKey: "warning",
      labelKey: "card.outstandingBalance",
    });
  });

  it("stays silent on a completed order with nothing left to pay", () => {
    expect(describeOrderListBalanceChip({ status: "COMPLETED", hasUnpaidBalance: false })).toBeNull();
  });

  it("stays silent on an active order, where a balance is the ordinary state", () => {
    expect(describeOrderListBalanceChip({ status: "OPEN", hasUnpaidBalance: true })).toBeNull();
    expect(describeOrderListBalanceChip({ status: "PARTIALLY_DELIVERED", hasUnpaidBalance: true })).toBeNull();
  });

  it("stays silent on a cancelled order, which owes nothing whatever its total says", () => {
    expect(describeOrderListBalanceChip({ status: "CANCELLED", hasUnpaidBalance: true })).toBeNull();
  });

  it("is a SECOND chip: the status chip beside it keeps saying Completado", () => {
    // Per `docs/design/interface-patterns.md` §8, a derived state renders beside the primary
    // status chip, never in place of it. Recolouring the status chip would have been the other
    // way to make the debt visible, and it would have made the list lie about fulfilment.
    const status = describeOrderListChip({
      status: "COMPLETED",
      paymentPercentage: 40,
      hasUnpaidBalance: true,
      isOverdue: false,
    });
    expect(status).toMatchObject({ toneKey: "success", labelKey: "status.COMPLETED" });
  });
});

/**
 * T11 — the overdue label has ONE definition, so the same order cannot read "Atrasado 228d" in the
 * "Por pedido" list and "Atrasado 7 meses" in "Por tienda".
 *
 * The zero case is the one worth spelling out: it is the branch the existing chip already takes when
 * the caller has an overdue order but no day count to state, and it survives the extraction.
 */
describe("describeOverdueLabel", () => {
  it("states plain lateness when there is no day count to give", () => {
    expect(describeOverdueLabel(0)).toEqual({ labelKey: "card.overdue" });
  });

  it("counts days below the months threshold", () => {
    expect(describeOverdueLabel(47)).toEqual({ labelKey: "card.overdueDays", labelVars: { days: 47 } });
  });

  it("switches to months at exactly 60 days", () => {
    expect(describeOverdueLabel(60)).toEqual({ labelKey: "card.overdueMonths", labelVars: { months: 2 } });
  });

  it("floors the month count instead of rounding it, so it never overstates the delay", () => {
    // 228 / 30 = 7.6. Rounding would announce 8 months of lateness on a 7-month delay.
    expect(describeOverdueLabel(228)).toEqual({ labelKey: "card.overdueMonths", labelVars: { months: 7 } });
  });

  /**
   * The "Por tienda" row states the same delay as a LINE of text rather than as a pill, so it takes
   * the same buckets and the same numbers out of a different namespace. Both halves are asserted:
   * that the arithmetic is genuinely shared (a threshold changed in one place must move both), and
   * that the namespaces stay apart (a chip abbreviating to "47d" must not follow the sentence into
   * the row, and the row's spelled-out form must not widen the chip).
   */
  it("hands the arrival line the same buckets under its own namespace", () => {
    expect(describeArrivalOverdueLabel(0)).toEqual({ labelKey: "storeView.arrival.overdue" });
    expect(describeArrivalOverdueLabel(47)).toEqual({
      labelKey: "storeView.arrival.overdueDays",
      labelVars: { days: 47 },
    });
    expect(describeArrivalOverdueLabel(60)).toEqual({
      labelKey: "storeView.arrival.overdueMonths",
      labelVars: { months: 2 },
    });
    expect(describeArrivalOverdueLabel(228)).toEqual({
      labelKey: "storeView.arrival.overdueMonths",
      labelVars: { months: 7 },
    });
  });

  it("keeps the two namespaces distinct on the very same delay", () => {
    expect(describeArrivalOverdueLabel(47).labelKey).not.toBe(describeOverdueLabel(47).labelKey);
    expect(describeArrivalOverdueLabel(47).labelVars).toEqual(describeOverdueLabel(47).labelVars);
  });

  it("is the same label the orders-list chip renders", () => {
    expect(
      describeOrderListChip({
        status: "OPEN",
        paymentPercentage: 0,
        hasUnpaidBalance: true,
        isOverdue: true,
        overdueDays: 228,
      }),
    ).toMatchObject({ toneKey: "warning", labelKey: "card.overdueMonths", labelVars: { months: 7 } });
  });
});
