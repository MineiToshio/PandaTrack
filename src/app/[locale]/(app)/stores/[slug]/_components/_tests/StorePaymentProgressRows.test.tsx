import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StoreDebtRow } from "@/lib/data/orders/storePaymentQueries";
import StorePaymentProgressRows from "../StorePaymentProgressRows";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, vars?: Record<string, unknown>) =>
      vars ? `${namespace}.${key}:${JSON.stringify(vars)}` : `${namespace}.${key}`;
    t.has = () => true;
    return t;
  },
}));

const storeDebtByCurrency: { rows: StoreDebtRow[] } = { rows: [] };

vi.mock("../StorePaymentStateProvider", () => ({
  useStorePaymentState: () => ({ storeDebtByCurrency: storeDebtByCurrency.rows }),
}));

const openReconciliationSheet = vi.fn();

vi.mock("../StoreReconciliationProvider", () => ({
  useStoreReconciliationState: () => ({ openReconciliationSheet }),
}));

function debtRow(overrides: Partial<StoreDebtRow> = {}): StoreDebtRow {
  return {
    storeId: "store-1",
    currencyCode: "PEN",
    committedMinor: 0,
    paidMinor: 0,
    debtMinor: 0,
    lostMinor: 0,
    activeCommittedMinor: 0,
    activePaidMinor: 0,
    openOrderDebtMinor: 0,
    unrecordedPaymentsMinor: 0,
    unassignedMinor: 0,
    ...overrides,
  };
}

function renderRows(
  rows: StoreDebtRow[],
  totalSpent: Array<{ currencyCode: string; totalMinorUnits: number }> = [],
  storeName = "Akiba Records",
) {
  storeDebtByCurrency.rows = rows;
  return render(<StorePaymentProgressRows totalSpentByCurrency={totalSpent} storeName={storeName} />);
}

describe("StorePaymentProgressRows", () => {
  it("names what is still owed on open orders, with the active-orders pair beside the percentage", () => {
    // Pop Dealer Store, the collector's heaviest, as the DB reads it today: 139,17.30 paid of
    // 162,72.30 across its whole history, but only 1,519.60 of 3,874.60 on the 17 orders still in
    // flight. The headline reads `openOrderDebtMinor` (ADR 0033); the bar is the active slice.
    renderRows([
      debtRow({
        committedMinor: 1627230,
        paidMinor: 1391730,
        debtMinor: 235500,
        openOrderDebtMinor: 235500,
        activeCommittedMinor: 387460,
        activePaidMinor: 151960,
      }),
    ]);

    expect(
      screen.getByText('stores.redesign.detail.aside.paymentProgress.openOrderDebt:{"amount":"2,355.00 PEN"}'),
    ).toBeInTheDocument();
    // 39%, not the 85% the lifetime ratio produces. The lifetime figure converges on 100% in any
    // store with history, which is what made the collector's biggest debt look almost settled.
    expect(screen.getByText('stores.redesign.detail.aside.paymentProgress.percent:{"pct":39}')).toBeInTheDocument();
    // The pair is never dropped in favour of the percentage alone, and it names its own scope so
    // it cannot be read as the store's lifetime total.
    expect(
      screen.getByText(
        'stores.redesign.detail.aside.paymentProgress.paidOfCommitted:{"paid":"1,519.60 PEN","committed":"3,874.60 PEN"}',
      ),
    ).toBeInTheDocument();
  });

  it("announces the bar as a sentence naming the active-orders pair, not as a bare percentage", () => {
    renderRows([
      debtRow({
        committedMinor: 1627230,
        paidMinor: 1391730,
        debtMinor: 235500,
        openOrderDebtMinor: 235500,
        activeCommittedMinor: 387460,
        activePaidMinor: 151960,
      }),
    ]);

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      'stores.redesign.detail.aside.paymentProgress.barValueText:{"paid":"1,519.60 PEN","committed":"3,874.60 PEN","pct":39}',
    );
  });

  it("names the money sunk in cancelled orders, which no other figure on the page carries", () => {
    // Baúl Jare: the payments list under this block adds up to 410.00, but 160.00 of it died with
    // ORD-20230130-01. The debt nets it out, the bar's pair never counted it, and the list shows
    // the payment at face value, so without this line those 160.00 appear in no total at all.
    renderRows([
      debtRow({
        committedMinor: 25000,
        paidMinor: 25000,
        debtMinor: 0,
        lostMinor: 16000,
        activeCommittedMinor: 25000,
        activePaidMinor: 25000,
      }),
    ]);

    expect(
      screen.getByText('stores.redesign.detail.aside.paymentProgress.lostOnCancelled:{"amount":"160.00 PEN"}'),
    ).toBeInTheDocument();
  });

  it("says nothing about cancelled money when there is none", () => {
    renderRows([
      debtRow({
        committedMinor: 25000,
        paidMinor: 25000,
        debtMinor: 0,
        activeCommittedMinor: 25000,
        activePaidMinor: 25000,
      }),
    ]);

    expect(screen.queryByText(/lostOnCancelled/)).not.toBeInTheDocument();
  });

  it("reads settled at 100% when the active orders are fully covered", () => {
    renderRows([
      debtRow({
        committedMinor: 25000,
        paidMinor: 25000,
        debtMinor: 0,
        activeCommittedMinor: 25000,
        activePaidMinor: 25000,
      }),
    ]);

    expect(screen.getByText("stores.redesign.detail.aside.paymentProgress.settled")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("gives each currency its own block, live debt first", () => {
    // Vaulted Store, as the debt query orders it today: USD settled with nothing active left, PEN
    // still owing on two orders in flight.
    renderRows([
      debtRow({ currencyCode: "USD", committedMinor: 42000, paidMinor: 42000, debtMinor: 0 }),
      debtRow({
        currencyCode: "PEN",
        committedMinor: 440000,
        paidMinor: 301100,
        debtMinor: 138900,
        openOrderDebtMinor: 138900,
        activeCommittedMinor: 173900,
        activePaidMinor: 35000,
      }),
    ]);

    const bars = screen.getAllByRole("progressbar");
    // Only PEN draws one: the USD side has nothing in flight to measure.
    expect(bars).toHaveLength(1);
    expect(bars[0]).toHaveAttribute(
      "aria-label",
      'stores.redesign.detail.aside.paymentProgress.barLabel:{"currency":"PEN"}',
    );
    expect(screen.getByText('stores.redesign.detail.aside.paymentProgress.percent:{"pct":20}')).toBeInTheDocument();
    // The USD block still gets to say it is settled (it has real history: a fully paid order), but
    // it must NOT claim "no te queda nada abierto con Vaulted Store" while PEN still has 1,389.00
    // open right there in the sibling block. The nudge is a STORE-level claim, so it is gated on the
    // whole store having zero open orders across every rendered row, not on this pair alone.
    expect(screen.queryByText(/reconciliation\.nudge/)).not.toBeInTheDocument();
    expect(screen.getAllByText("stores.redesign.detail.reconciliation.trigger")).toHaveLength(2);
  });

  it("names the cancelled slice only when it actually differs from what is committed", () => {
    const { rerender } = renderRows(
      [
        debtRow({
          committedMinor: 25000,
          paidMinor: 25000,
          debtMinor: 0,
          activeCommittedMinor: 25000,
          activePaidMinor: 25000,
        }),
      ],
      [{ currencyCode: "PEN", totalMinorUnits: 219000 }],
    );

    // Baúl Jare again: "Total facturado" says 2,190.00 because it counts the cancelled order, while
    // the debt the headline comes from does not. The gap gets a name rather than being left as a
    // discrepancy.
    expect(screen.getByText("stores.redesign.detail.aside.cancelledLabel")).toBeInTheDocument();
    expect(screen.getByText("1,940.00 PEN")).toBeInTheDocument();

    storeDebtByCurrency.rows = [
      debtRow({
        committedMinor: 219000,
        paidMinor: 219000,
        debtMinor: 0,
        activeCommittedMinor: 219000,
        activePaidMinor: 219000,
      }),
    ];
    rerender(
      <StorePaymentProgressRows
        totalSpentByCurrency={[{ currencyCode: "PEN", totalMinorUnits: 219000 }]}
        storeName="Akiba Records"
      />,
    );
    expect(screen.queryByText("stores.redesign.detail.aside.cancelledLabel")).not.toBeInTheDocument();
  });

  it("names the cancelled slice when it is the WHOLE of what was billed", () => {
    // Every order in this currency was cancelled and nothing was ever paid there, so the debt query
    // emits no row for it at all. Reading "no row" as "nothing cancelled" leaves "Total facturado
    // $500.00" standing alone with no bar and no explanation.
    renderRows([], [{ currencyCode: "USD", totalMinorUnits: 50000 }]);

    expect(screen.getByText("stores.redesign.detail.aside.cancelledLabel")).toBeInTheDocument();
    expect(screen.getByText("500.00 USD")).toBeInTheDocument();
  });
});

describe("StorePaymentProgressRows - a store with nothing in flight", () => {
  /** Kyle Mendoza's USD side and 111 other rows: settled, and nothing left to wait for. */
  const SETTLED_NOTHING_ACTIVE = debtRow({ committedMinor: 733500, paidMinor: 733500, debtMinor: 0 });

  it("keeps the block and confirms the collector is square, without drawing a bar over nothing", () => {
    // 112 of the collector's 122 store/currency pairs are here, so this is the ordinary case. The
    // block has to keep answering "am I square with this store?"; what it must not do is fill a
    // track whose denominator is zero, which reads as progress and is a measurement of nothing.
    renderRows([SETTLED_NOTHING_ACTIVE]);

    expect(screen.getByText("stores.redesign.detail.aside.paymentProgress.settled")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/paymentProgress\.percent/)).not.toBeInTheDocument();
  });

  it("says why there is no bar instead of leaving a bare chip", () => {
    renderRows([SETTLED_NOTHING_ACTIVE]);

    expect(screen.getByText("stores.redesign.detail.aside.paymentProgress.noActiveOrders")).toBeInTheDocument();
    expect(screen.queryByText(/paymentProgress\.paidOfCommitted/)).not.toBeInTheDocument();
  });

  it("reads settled even when an already-delivered order still carries an unregistered balance (ADR 0033, WO-09)", () => {
    // The exact scenario this work order exists to fix: a COMPLETED order left a balance behind
    // (`unrecordedPaymentsMinor`, a diagnostic, never debt) that still inflates the lifetime
    // `debtMinor` (30000). Before this change the headline read that lifetime figure ("Falta
    // 300.00"). `openOrderDebtMinor` excludes it (no order is still active), so the block now reads
    // "Al día" instead — the store's OPEN orders are square, even though the lifetime figure is not.
    renderRows([
      debtRow({
        committedMinor: 60000,
        paidMinor: 30000,
        debtMinor: 30000,
        openOrderDebtMinor: 0,
        unrecordedPaymentsMinor: 30000,
      }),
    ]);

    expect(screen.getByText("stores.redesign.detail.aside.paymentProgress.settled")).toBeInTheDocument();
    expect(screen.queryByText(/paymentProgress\.openOrderDebt/)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    // The retired reconciliation line stays retired: nothing in this block ever prints
    // "outsideActiveOrders" again.
    expect(screen.queryByText(/outsideActiveOrders/)).not.toBeInTheDocument();
  });
});

describe("StorePaymentProgressRows - openOrderDebtMinor diverges from the lifetime debtMinor (ADR 0033, WO-09)", () => {
  it("prints the OPEN figure on the headline, not the lifetime one, when the two disagree", () => {
    // 3,874.60 - 1,519.60 = 2,355.00 still owed on the orders in flight, plus 270.00 left behind by
    // an order that was already delivered (a registration gap, not debt). The lifetime `debtMinor`
    // (2,625.00) is the sum of both; `openOrderDebtMinor` (2,355.00) excludes the second. Before this
    // work order the headline printed the lifetime figure via the retired `outsideActiveOrders` gap
    // line ("Fuera de pedidos activos 270.00"); that line is gone, and the headline itself now
    // prints the smaller, open-only number directly.
    renderRows([
      debtRow({
        committedMinor: 1654230,
        paidMinor: 1391730,
        debtMinor: 262500,
        openOrderDebtMinor: 235500,
        activeCommittedMinor: 387460,
        activePaidMinor: 151960,
      }),
    ]);

    expect(
      screen.getByText('stores.redesign.detail.aside.paymentProgress.openOrderDebt:{"amount":"2,355.00 PEN"}'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/2,625\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/outsideActiveOrders/)).not.toBeInTheDocument();
  });

  it("stays silent on the retired gap line even when the whole debt sits in the active orders", () => {
    renderRows([
      debtRow({
        committedMinor: 1627230,
        paidMinor: 1391730,
        debtMinor: 235500,
        openOrderDebtMinor: 235500,
        activeCommittedMinor: 387460,
        activePaidMinor: 151960,
      }),
    ]);

    expect(screen.queryByText(/outsideActiveOrders/)).not.toBeInTheDocument();
  });

  it("never clamps a negative openOrderDebtMinor: it renders the raw figure, not zero or nothing (BR-05-32)", () => {
    // Unreachable through the derivation by construction (`openBalanceMinor` cannot itself go
    // negative), but the type is not narrowed to non-negative, so the component must not paper over
    // it either: a negative reading here can only mean a ceiling elsewhere was bypassed, and hiding
    // or clamping it would convert that loud symptom into silence. `debtMinor` (lifetime) is
    // deliberately kept POSITIVE here, so this exercises the "owing" branch on its own terms rather
    // than accidentally falling into "credit" (which reads `debtMinor`, unchanged, `FR-05-63`).
    renderRows([
      debtRow({
        committedMinor: 25000,
        paidMinor: 20000,
        debtMinor: 5000,
        openOrderDebtMinor: -1000,
        activeCommittedMinor: 25000,
        activePaidMinor: 20000,
      }),
    ]);

    expect(
      screen.getByText('stores.redesign.detail.aside.paymentProgress.openOrderDebt:{"amount":"-10.00 PEN"}'),
    ).toBeInTheDocument();
    expect(screen.queryByText("stores.redesign.detail.aside.paymentProgress.settled")).not.toBeInTheDocument();
    expect(screen.queryByText(/debtCredit/)).not.toBeInTheDocument();
  });
});

describe("StorePaymentProgressRows - money already paid that no order has claimed yet", () => {
  it("names money handed over unassigned, so the headline and the bar's pair still add up", () => {
    // The gap the new sheet can create in one submit: an active order of 250.00 with nothing
    // declared against it, plus a payment of 100.00 left unassigned. `openOrderDebtMinor` sums
    // `openBalanceMinor` per active order (allocations only, `BR-05-32`) and is NOT reduced by
    // unassigned money, so it reads the order's full 250.00 here — not the lifetime `debtMinor`
    // (150.00), which nets the unassigned payment out. Zero stores are in exactly this shape today.
    renderRows([
      debtRow({
        committedMinor: 25000,
        paidMinor: 10000,
        debtMinor: 15000,
        openOrderDebtMinor: 25000,
        activeCommittedMinor: 25000,
        activePaidMinor: 0,
        unassignedMinor: 10000,
      }),
    ]);

    expect(
      screen.getByText('stores.redesign.detail.aside.paymentProgress.openOrderDebt:{"amount":"250.00 PEN"}'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'stores.redesign.detail.aside.paymentProgress.paidOfCommitted:{"paid":"0.00 PEN","committed":"250.00 PEN"}',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('stores.redesign.detail.aside.paymentProgress.unassignedMoney:{"amount":"100.00 PEN"}'),
    ).toBeInTheDocument();
  });

  it("says nothing when there is no unassigned money to name", () => {
    renderRows([
      debtRow({
        committedMinor: 25000,
        paidMinor: 25000,
        debtMinor: 0,
        openOrderDebtMinor: 0,
        activeCommittedMinor: 25000,
        activePaidMinor: 25000,
        unassignedMinor: 0,
      }),
    ]);

    expect(screen.queryByText(/unassignedMoney/)).not.toBeInTheDocument();
  });

  it("still names unassigned money on a store with no active orders left (independent of the bar)", () => {
    // Every order in this currency is COMPLETED or CANCELLED (no bar, `showBar` false), but a
    // payment still sits unassigned. Folding this line behind the bar's own gate would hide it
    // exactly in this case, so it renders regardless of whether a bar is drawn.
    //
    // Deliberately NOT in credit (`debtMinor: 10000 >= 0`, a registration gap rather than an
    // overpayment): FIX B suppresses this line for a store in credit (see below), and this test is
    // about the bar's own gate, not that one.
    renderRows([
      debtRow({
        committedMinor: 60000,
        paidMinor: 50000,
        debtMinor: 10000,
        openOrderDebtMinor: 0,
        activeCommittedMinor: 0,
        activePaidMinor: 0,
        unassignedMinor: 10000,
      }),
    ]);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(
      screen.getByText('stores.redesign.detail.aside.paymentProgress.unassignedMoney:{"amount":"100.00 PEN"}'),
    ).toBeInTheDocument();
  });

  it("stays silent on a store in credit even when there IS unassigned money (BR-05-27, FIX B)", () => {
    // The old fixture here (`unassignedMinor: 0` with `paidMinor: 41000 > committedMinor: 25000`)
    // was arithmetically unreachable: `unassignedMinor = paidMinor - Σ allocated`, and no order can
    // be allocated past its own `totalCost`, so `Σ allocated <= committedMinor` and therefore
    // `unassignedMinor >= paidMinor - committedMinor = 16000 > 0`. It can never read 0 here.
    //
    // The REACHABLE shape is the one that actually matters: a store in credit almost always has
    // money sitting unassigned too (that is what makes it a credit). The credit headline
    // ("A favor 160.00") already answers "am I owed money"; a second, differently-shaped positive
    // figure beside it ("100.00 sin asignar") is two answers to the same question, so the unassigned
    // line stays suppressed whenever the store itself is in credit (`debt.debtMinor < 0`), regardless
    // of `unassignedMinor` (ADR 0033's consequence note).
    renderRows([
      debtRow({
        committedMinor: 25000,
        paidMinor: 41000,
        debtMinor: -16000,
        openOrderDebtMinor: 0,
        activeCommittedMinor: 25000,
        activePaidMinor: 25000,
        unassignedMinor: 10000,
      }),
    ]);

    expect(screen.getByText('stores.redesign.detail.aside.debtCredit:{"amount":"160.00 PEN"}')).toBeInTheDocument();
    expect(screen.queryByText(/unassignedMoney/)).not.toBeInTheDocument();
    expect(screen.queryByText(/outsideActiveOrders/)).not.toBeInTheDocument();
  });

  it("still names unassigned money when the store is NOT in credit (positive control, FIX B)", () => {
    // The suppression above is gated on credit specifically, not on "unassigned money exists": a
    // store that owes money (or is exactly settled) still gets the line.
    renderRows([
      debtRow({
        committedMinor: 25000,
        paidMinor: 15000,
        debtMinor: 10000,
        openOrderDebtMinor: 10000,
        activeCommittedMinor: 25000,
        activePaidMinor: 5000,
        unassignedMinor: 10000,
      }),
    ]);

    expect(screen.queryByText(/debtCredit/)).not.toBeInTheDocument();
    expect(
      screen.getByText('stores.redesign.detail.aside.paymentProgress.unassignedMoney:{"amount":"100.00 PEN"}'),
    ).toBeInTheDocument();
  });
});

describe("StorePaymentProgressRows - a currency with no activity left in it", () => {
  it("draws nothing at all rather than claiming a state the store no longer has", () => {
    // Cancel a store's last standing order and keep its payment as lost (BR-05-15) and this is what
    // is left: nothing committed, nothing counting as paid. Distinct from a settled store with no
    // active orders, which does keep its "Al día" chip: here there is no standing left to be square
    // about, so a chip claiming one would be inventing a relationship.
    renderRows([debtRow({ committedMinor: 0, paidMinor: 0, debtMinor: 0, lostMinor: 41000 })]);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/paymentProgress\.settled/)).not.toBeInTheDocument();
    expect(screen.queryByText(/paymentProgress\.percent/)).not.toBeInTheDocument();
    expect(screen.queryByText(/paymentProgress\.paidOfCommitted/)).not.toBeInTheDocument();
    expect(screen.queryByText(/paymentProgress\.noActiveOrders/)).not.toBeInTheDocument();
  });

  it("still names the money that was sunk, so it is not silently dropped from the page", () => {
    renderRows([debtRow({ committedMinor: 0, paidMinor: 0, debtMinor: 0, lostMinor: 41000 })]);

    expect(
      screen.getByText('stores.redesign.detail.aside.paymentProgress.lostOnCancelled:{"amount":"410.00 PEN"}'),
    ).toBeInTheDocument();
  });

  it("renders nothing when there is no money to name either", () => {
    const { container } = renderRows([debtRow({ committedMinor: 0, paidMinor: 0, debtMinor: 0, lostMinor: 0 })]);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('StorePaymentProgressRows - "cuadrar cuenta" trigger and nudge (WO-11, ADR 0034)', () => {
  it("offers the reconciliation trigger even while the store still owes money on this currency", () => {
    renderRows([
      debtRow({
        committedMinor: 18000,
        paidMinor: 0,
        debtMinor: 18000,
        openOrderDebtMinor: 18000,
        activeCommittedMinor: 18000,
        activePaidMinor: 0,
      }),
    ]);

    expect(screen.getByText("stores.redesign.detail.reconciliation.trigger")).toBeInTheDocument();
    // The nudge is reserved for a store with nothing left open; it must not appear here.
    expect(screen.queryByText(/reconciliation\.nudge/)).not.toBeInTheDocument();
  });

  it("surfaces the proactive nudge only once the currency has NO open orders left at all", () => {
    // Every order in this currency is CANCELLED or COMPLETED: `activeCommittedMinor` is 0, so there
    // is nothing left open to settle and the nudge's own question ("are we square?") is honest.
    renderRows([
      debtRow({
        committedMinor: 25000,
        paidMinor: 25000,
        debtMinor: 0,
        openOrderDebtMinor: 0,
        activeCommittedMinor: 0,
        activePaidMinor: 0,
      }),
    ]);

    expect(
      screen.getByText('stores.redesign.detail.reconciliation.nudge:{"store":"Akiba Records"}'),
    ).toBeInTheDocument();
    expect(screen.getByText("stores.redesign.detail.reconciliation.trigger")).toBeInTheDocument();
  });

  it("does not surface the nudge while the currency still has open orders, even if they are already fully paid (MINOR-8)", () => {
    // Three OPEN orders, all prepaid: `openOrderDebtMinor` reads 0 (nothing OWED), but
    // `activeCommittedMinor > 0` means the store still has open orders in flight. The old predicate
    // (`resolveProgressState(debt) === "settled"`, true whenever `openOrderDebtMinor === 0`) could
    // not tell this apart from the true "nothing left open" case above and showed the nudge here too
    // — "No te queda nada abierto" while three orders are, in fact, still open.
    renderRows([
      debtRow({
        committedMinor: 25000,
        paidMinor: 25000,
        debtMinor: 0,
        openOrderDebtMinor: 0,
        activeCommittedMinor: 25000,
        activePaidMinor: 25000,
      }),
    ]);

    expect(screen.queryByText(/reconciliation\.nudge/)).not.toBeInTheDocument();
    // The plain trigger must stay reachable regardless: "last resort, not first offer" (`ADR 0034`
    // §6) is about the NUDGE, not about the collector's own ability to open the sheet.
    expect(screen.getByText("stores.redesign.detail.reconciliation.trigger")).toBeInTheDocument();
  });

  it("never surfaces the nudge for a store in credit, even though the bar draws no track there either", () => {
    renderRows([
      debtRow({
        committedMinor: 25000,
        paidMinor: 41000,
        debtMinor: -16000,
        openOrderDebtMinor: 0,
        activeCommittedMinor: 25000,
        activePaidMinor: 25000,
      }),
    ]);

    // `activeCommittedMinor > 0` here too: the store still has an open order, credit or not, so
    // `!hasActiveOrderCommitment` already keeps the nudge quiet without needing to special-case
    // credit at all.
    expect(screen.queryByText(/reconciliation\.nudge/)).not.toBeInTheDocument();
  });

  it("opens the sheet scoped to this row's own currency when the trigger is pressed", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    openReconciliationSheet.mockClear();
    renderRows([
      debtRow({
        currencyCode: "USD",
        committedMinor: 25000,
        paidMinor: 25000,
        debtMinor: 0,
        openOrderDebtMinor: 0,
        activeCommittedMinor: 25000,
        activePaidMinor: 25000,
      }),
    ]);

    await userEvent.click(screen.getByText("stores.redesign.detail.reconciliation.trigger"));
    expect(openReconciliationSheet).toHaveBeenCalledWith("USD");
  });

  it("renders exactly one block and no nudge when the sibling currency row is genuinely empty", () => {
    // PEN has an order in flight; USD has never had an order or a payment at all (a row this
    // component only ever sees synthetically here - the debt query itself would not emit one, see
    // `getStoreDebtByCurrency`). A row with nothing on it must render nothing, not a settled chip
    // and a nudge that contradict the PEN block right beside it.
    renderRows([
      debtRow({ currencyCode: "USD" }),
      debtRow({
        currencyCode: "PEN",
        committedMinor: 150000,
        paidMinor: 30000,
        debtMinor: 120000,
        openOrderDebtMinor: 120000,
        activeCommittedMinor: 150000,
        activePaidMinor: 30000,
      }),
    ]);

    expect(screen.queryByText(/reconciliation\.nudge/)).not.toBeInTheDocument();
    expect(screen.getAllByText("stores.redesign.detail.reconciliation.trigger")).toHaveLength(1);
    expect(
      screen.getByText('stores.redesign.detail.aside.paymentProgress.openOrderDebt:{"amount":"1,200.00 PEN"}'),
    ).toBeInTheDocument();
  });

  it("surfaces the nudge once on a genuinely zero-open store with a single currency", () => {
    // The plain single-row case: nothing owed, nothing active anywhere in the store, so the nudge's
    // own claim is true and shows exactly once.
    renderRows([
      debtRow({
        committedMinor: 25000,
        paidMinor: 25000,
        debtMinor: 0,
        openOrderDebtMinor: 0,
        activeCommittedMinor: 0,
        activePaidMinor: 0,
      }),
    ]);

    expect(screen.getAllByText(/reconciliation\.nudge/)).toHaveLength(1);
  });

  it("never renders the trigger as the FIRST control of the block: the unassigned-money line renders above it", () => {
    renderRows([
      debtRow({
        committedMinor: 25000,
        paidMinor: 15000,
        debtMinor: 10000,
        openOrderDebtMinor: 10000,
        activeCommittedMinor: 25000,
        activePaidMinor: 5000,
        unassignedMinor: 10000,
      }),
    ]);

    const unassignedLine = screen.getByText(
      'stores.redesign.detail.aside.paymentProgress.unassignedMoney:{"amount":"100.00 PEN"}',
    );
    const trigger = screen.getByText("stores.redesign.detail.reconciliation.trigger");
    // DOM order is document order here (no CSS `order` used on this block), so comparing node
    // position is a direct check of what renders first.
    expect(unassignedLine.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
