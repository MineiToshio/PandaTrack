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
    ...overrides,
  };
}

function renderRows(rows: StoreDebtRow[], totalSpent: Array<{ currencyCode: string; totalMinorUnits: number }> = []) {
  storeDebtByCurrency.rows = rows;
  return render(<StorePaymentProgressRows totalSpentByCurrency={totalSpent} />);
}

describe("StorePaymentProgressRows", () => {
  it("names what is still owed, with the active-orders pair beside the percentage", () => {
    // Pop Dealer Store, the collector's heaviest, as the DB reads it today: 139,17.30 paid of
    // 162,72.30 across its whole history, but only 1,519.60 of 3,874.60 on the 17 orders still in
    // flight. The headline is the store's debt; the bar is the active slice.
    renderRows([
      debtRow({
        committedMinor: 1627230,
        paidMinor: 1391730,
        debtMinor: 235500,
        activeCommittedMinor: 387460,
        activePaidMinor: 151960,
      }),
    ]);

    expect(
      screen.getByText('stores.redesign.detail.aside.paymentProgress.remaining:{"amount":"2,355.00 PEN"}'),
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
    rerender(<StorePaymentProgressRows totalSpentByCurrency={[{ currencyCode: "PEN", totalMinorUnits: 219000 }]} />);
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

  it("still names a debt left on orders that are already delivered", () => {
    // Zero rows today (the cleanup settled the last 16 completed orders carrying a balance), and
    // one "Ya me llegó" on a half-paid order away from coming back. "Sin pedidos activos" carries
    // the reconciliation on its own here: with no bar there is no pair for the headline to
    // contradict, so no second line is needed.
    renderRows([debtRow({ committedMinor: 60000, paidMinor: 30000, debtMinor: 30000 })]);

    expect(
      screen.getByText('stores.redesign.detail.aside.paymentProgress.remaining:{"amount":"300.00 PEN"}'),
    ).toBeInTheDocument();
    expect(screen.getByText("stores.redesign.detail.aside.paymentProgress.noActiveOrders")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/outsideActiveOrders/)).not.toBeInTheDocument();
  });
});

describe("StorePaymentProgressRows - debt that the bar's pair does not account for", () => {
  it("names the gap so the headline and the pair under the bar cannot contradict each other", () => {
    // 3,874.60 - 1,519.60 = 2,355.00 in flight, plus 270.00 owed on an order already delivered.
    // Without this line the headline says 2,625.00 over a pair that adds up to 2,355.00 and the
    // 270.00 is nowhere on the page.
    renderRows([
      debtRow({
        committedMinor: 1654230,
        paidMinor: 1391730,
        debtMinor: 262500,
        activeCommittedMinor: 387460,
        activePaidMinor: 151960,
      }),
    ]);

    expect(
      screen.getByText('stores.redesign.detail.aside.paymentProgress.outsideActiveOrders:{"amount":"270.00 PEN"}'),
    ).toBeInTheDocument();
  });

  it("stays silent when the whole debt is in the active orders, which is every store today", () => {
    renderRows([
      debtRow({
        committedMinor: 1627230,
        paidMinor: 1391730,
        debtMinor: 235500,
        activeCommittedMinor: 387460,
        activePaidMinor: 151960,
      }),
    ]);

    expect(screen.queryByText(/outsideActiveOrders/)).not.toBeInTheDocument();
  });

  it("names money handed over on account, so the headline and the bar's pair still add up", () => {
    // The gap in the other direction, and the one the new sheet can create in one submit: an active
    // order of 250.00 with nothing declared, plus a payment of 100.00 on account. The headline says
    // 150.00 is missing while the bar's own arithmetic says 250.00 is. Zero stores are here today.
    renderRows([
      debtRow({
        committedMinor: 25000,
        paidMinor: 10000,
        debtMinor: 15000,
        activeCommittedMinor: 25000,
        activePaidMinor: 0,
      }),
    ]);

    expect(
      screen.getByText('stores.redesign.detail.aside.paymentProgress.remaining:{"amount":"150.00 PEN"}'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'stores.redesign.detail.aside.paymentProgress.paidOfCommitted:{"paid":"0.00 PEN","committed":"250.00 PEN"}',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('stores.redesign.detail.aside.paymentProgress.onAccount:{"amount":"100.00 PEN"}'),
    ).toBeInTheDocument();
  });

  it("stays silent on a store in credit, the one direction still deliberately unnamed", () => {
    // The only direction still suppressed: with the debt already negative, "A favor 160.00" is the
    // headline, and an "A cuenta" line beside it would be a second credit-shaped figure rather than
    // a reconciliation. The positive-debt case above is the one that needed naming.
    renderRows([
      debtRow({
        committedMinor: 25000,
        paidMinor: 41000,
        debtMinor: -16000,
        activeCommittedMinor: 25000,
        activePaidMinor: 25000,
      }),
    ]);

    expect(screen.getByText('stores.redesign.detail.aside.debtCredit:{"amount":"160.00 PEN"}')).toBeInTheDocument();
    expect(screen.queryByText(/outsideActiveOrders/)).not.toBeInTheDocument();
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
