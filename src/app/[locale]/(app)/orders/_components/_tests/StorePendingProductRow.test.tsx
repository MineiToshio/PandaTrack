import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PendingProductRow } from "@/lib/data/orders/pendingProductsByStoreQueries";
import { utcMidnightToday } from "@/test/domainDateFixtures";
import StorePendingProductRow from "../StorePendingProductRow";

/**
 * Interpolating mock, deliberately. The usual key-only stub would make "the amount is on screen"
 * unfalsifiable: any state that renders the key would satisfy it. Here the formatted figure has to
 * actually reach the DOM.
 */
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${Object.values(vars).join(" ")}` : key,
}));

vi.mock("@/components/core/ViewTransitionLink", () => ({
  default: ({ children, ...props }: { children?: React.ReactNode }) => <a {...props}>{children}</a>,
}));

/**
 * Resolves like the real action, because the toggle awaits it: a `vi.fn()` returning `undefined`
 * throws inside the transition, which is a failure mode of the STUB and would be read as one of the
 * component.
 */
const arrivedActionMock = vi.fn(async (..._args: unknown[]): Promise<{ ok: boolean }> => ({ ok: true }));
// `../../_actions`, not `../_actions`: this file sits in `_components/_tests/`, and the path the
// suite carried before pointed at a module that does not exist, so the server action was never
// stubbed at all. Nothing caught it because no test had ever pressed the toggle.
vi.mock("../../_actions/orderItemActions", () => ({
  setOrderItemArrivedAction: (...args: unknown[]) => arrivedActionMock(...args),
  setOrderItemPaidDeclaredAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

/**
 * ORD-20260305-01 as it really stands: a 244.90 order carrying 199.90 that names no product, and a
 * 59.90 product with 4.89 of item-level money on it after a proportional 20.00 payment.
 */
function buildProduct(overrides: Partial<PendingProductRow> = {}): PendingProductRow {
  return {
    itemId: "item-1",
    name: "Kingdom 23",
    quantity: 1,
    deliveryState: "open",
    unitPrice: 5990,
    allocatedMinor: 489,
    paidDeclared: false,
    orderId: "order-1",
    orderHumanReadableId: "ORD-20260305-01",
    orderDate: new Date("2026-03-05T00:00:00.000Z"),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    orderTotalCost: 24490,
    orderAllocatedAmountMinor: 21990,
    orderHasUndetailedMoney: true,
    orderItemCount: 2,
    currencyCode: "PEN",
    basePagableMinor: 5990,
    ...overrides,
  };
}

function renderRow(overrides: Partial<PendingProductRow> = {}, props: { isFlaggedIneligible?: boolean } = {}) {
  return render(
    <StorePendingProductRow
      product={buildProduct(overrides)}
      locale="es"
      returnTo="/es/orders"
      isSelected={false}
      isArmed={false}
      isFlaggedIneligible={props.isFlaggedIneligible ?? false}
      today={utcMidnightToday()}
      onToggleSelect={vi.fn()}
      onPaidMarkError={() => {}}
    />,
  );
}

/**
 * D7b — with money sitting unattributed on the order, this row states the FIGURE and draws no bar.
 *
 * Both halves are asserted, and the second is the one that needs saying. Suppressing the bar comes
 * free from the shape of the existing ternary (an unknown state falls into the `else` and renders
 * nothing), so a test that only checked for the absence of a progressbar would pass against a
 * component nobody touched, while the collector went from reading a wrong "8%" to reading nothing at
 * all about a product that does carry money. That is worse than the bad ratio, not better.
 */
describe("StorePendingProductRow with unattributed money on the order (D7b)", () => {
  it("draws no bar and no percentage", () => {
    renderRow();

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText(/card\.paymentPercentage/)).toBeNull();
  });

  it("still states the amount declared against the product", () => {
    renderRow();

    // The figure itself, not just the key: 4.89 in PEN.
    expect(screen.getByText(/detail\.payments\.declaredAgainst/)).toHaveTextContent("4.89");
  });

  it("goes back to the bar and the percentage once the order's money is fully attributed", () => {
    // Same product, same 4.89, same 59.90 base. The only change is that nothing sits on the order
    // unattributed, which is exactly when a ratio is honest again.
    renderRow({ orderHasUndetailedMoney: false });

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText(/card\.paymentPercentage/)).toBeInTheDocument();
    expect(screen.queryByText(/detail\.payments\.declaredAgainst/)).toBeNull();
  });

  it("keeps the settled chip when the order owes nothing, pozo or not", () => {
    renderRow({ orderAllocatedAmountMinor: 24490 });

    expect(screen.getByText("storeView.settled")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

/** A window covering a whole calendar month that closed months ago, built off today so it stays past. */
function wholePastMonth() {
  const today = utcMidnightToday();
  return {
    expectedDeliveryFrom: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 2, 1)),
    expectedDeliveryTo: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 0)),
  };
}

/**
 * The same shape two months AHEAD. The window is only printed while it is still ahead: an overdue
 * row states its delay instead, so the month-collapse assertion needs a row that is not late.
 */
function wholeFutureMonth() {
  const today = utcMidnightToday();
  return {
    expectedDeliveryFrom: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 2, 1)),
    expectedDeliveryTo: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 3, 0)),
  };
}

/**
 * T7 — the row SUBSTITUTES the order date with the arrival window. It does not add a third line.
 *
 * The substitution is the request, so the absence half is asserted as hard as the presence half: an
 * implementation that renders both passes every "the window is on screen" check and still ships the
 * thing the collector asked to remove.
 */
describe("StorePendingProductRow arrival window (T7)", () => {
  it("renders the expected-arrival window collapsed to its month", () => {
    const window = wholeFutureMonth();
    renderRow(window);

    // The month name is derived here independently of the formatter under test.
    const monthLabel = window.expectedDeliveryTo.toLocaleDateString("es", { month: "short", timeZone: "UTC" });
    expect(screen.getByText(/storeView\.arrival\.arrives/)).toHaveTextContent(monthLabel);
  });

  it("does not render the order date in any form", () => {
    const { container } = renderRow(wholePastMonth());

    expect(screen.queryByText(/storeView\.orderedOn/)).toBeNull();
    // And not the formatted value either, in case the key is ever swapped for another one.
    expect(container.textContent).not.toContain("5 mar 2026");
  });

  it("states the delay INSTEAD of the estimate, in the same slot", () => {
    // The substitution the collector asked for: a late row does not print "Esperada jun" AND
    // "Atrasado 48 días", it prints only the second. Asserting the presence alone would pass on an
    // implementation that appends the delay to the window, which is the shape this replaced.
    const window = wholePastMonth();
    const { container } = renderRow(window);
    const monthLabel = window.expectedDeliveryTo.toLocaleDateString("es", { month: "short", timeZone: "UTC" });

    expect(screen.getByText(/storeView\.arrival\.overdue/)).toBeInTheDocument();
    expect(screen.queryByText(/storeView\.arrival\.expected/)).toBeNull();
    expect(container.textContent).not.toContain(monthLabel);
  });

  it("keeps the delay on the window's own line, never beside the name as a chip", () => {
    // `closest("p")` and not a `data-testid`: neither component has one, and asking for a test
    // handle would mean adding production markup to satisfy a test. Line 1 is the only `<p>` here,
    // so a delay that climbs back up finds it and this dies.
    renderRow(wholePastMonth());

    expect(screen.getByText(/storeView\.arrival\.overdue/).closest("p")).toBeNull();
  });

  it("moves the order link onto the product name, which is now the row's only route in", () => {
    renderRow(wholePastMonth());

    expect(screen.getByRole("link", { name: /Kingdom 23/ })).toHaveAttribute(
      "href",
      "/es/orders/order-1?returnTo=%2Fes%2Forders",
    );
  });
});

/**
 * T7b — a flagged row still states its delay, because the two no longer compete for a line.
 *
 * This assertion is the INVERSE of the one it replaces, and the inversion is the point. While the
 * arrival state was a pill it had to be suppressed here: line 1's `truncate` sits on the name's
 * `<span>` and not on the `<p>`, so two non-shrinkable pills pushed the name to zero width and then
 * left the box (~333px in Spanish against 311px at 375px). Now the ineligible chip is the only pill
 * line 1 can hold and the delay is line 2's text, so the arithmetic that forced the suppression is
 * gone and suppressing would just hide a true fact. Kept rather than deleted because it is also this
 * component's only coverage that the ineligible flag renders at all.
 */
describe("StorePendingProductRow with a flagged row (T7b)", () => {
  it("shows the ineligible chip AND the delay, which now live on different lines", () => {
    renderRow(wholePastMonth(), { isFlaggedIneligible: true });

    expect(screen.getByText("storeView.selection.ineligibleRow")).toBeInTheDocument();
    expect(screen.getByText(/storeView\.arrival\.overdue/)).toBeInTheDocument();
  });
});

/**
 * T5b — the line stops counting as soon as the row's OWN control says the product is at the store,
 * without waiting for the server round trip or the revalidation behind it.
 *
 * This is the gap the whole suite had: no component test ever PRESSED the toggle, so `resolved` was
 * only ever exercised against a `deliveryState` handed in as a prop. Pressed, the row held both
 * facts at once — `card.itemDelivery.arrived_at_store` on the state chip (the optimistic state) and
 * a growing delay counter (resolved from the server prop) — which is the reading ADR 0030 §3 calls
 * blocking, produced by the row's primary control.
 *
 * With one slot instead of a chip, the assertion gains a half it could not have before: the delay
 * must be REPLACED by the neutral past-tense form, not merely removed. A slot that goes blank would
 * satisfy the old absence check and leave the row saying nothing at all about its arrival.
 */
describe("StorePendingProductRow stops predicting the moment the collector marks the product (T5b)", () => {
  it("swaps the delay for the neutral form when the state chip is pressed, before the server answers", async () => {
    renderRow(wholePastMonth());

    // The delay has to be there first: without this the assertion below would also pass on a row
    // that never had one.
    expect(screen.getByText(/storeView\.arrival\.overdue/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "detail.items.markAsArrived" }));

    expect(screen.getByText("card.itemDelivery.arrived_at_store")).toBeInTheDocument();
    expect(screen.queryByText(/storeView\.arrival\.overdue/)).toBeNull();
    // The replacement names the EVENT. It used to be the window in the neutral past tense
    // ("Esperada 12 jun"), which is the row the collector opened a defect about: on the desktop
    // grid the chip that explains it sits three columns away, so the line said a prediction and
    // nothing about the thing that answered it.
    expect(screen.getByText("storeView.arrival.resolvedAtStore")).toBeInTheDocument();
    await waitFor(() => expect(arrivedActionMock).toHaveBeenCalled());
  });

  it("brings the delay back when the server refuses the mark", async () => {
    arrivedActionMock.mockResolvedValueOnce({ ok: false });
    renderRow(wholePastMonth());

    fireEvent.click(screen.getByRole("button", { name: "detail.items.markAsArrived" }));

    // The rollback is the state the row must not be left out of: the product is pending again, so
    // the delay it carries is true again.
    await waitFor(() => expect(screen.getByText(/storeView\.arrival\.overdue/)).toBeInTheDocument());
  });
});

/**
 * T9 — a product with no window says so, instead of rendering nothing.
 *
 * The realistic failure here is not an inverted condition but a branch nobody wrote:
 * `formatExpectedArrival` returns `null` for this input, and `{null}` renders silently.
 */
describe("StorePendingProductRow with no expected window (T9)", () => {
  it("states that there is no estimated date, and states no delay", () => {
    renderRow({ expectedDeliveryFrom: null, expectedDeliveryTo: null });

    expect(screen.getByText("storeView.arrival.noDate")).toBeInTheDocument();
    expect(screen.queryByText(/storeView\.arrival\.overdue/)).toBeNull();
  });
});

/**
 * T5c — the reported row, on the surface it was reported from, reconstructed field for field.
 *
 * `ORD-20260509-02` at Palmito Store: one product, a single stated day (12 jun) rather than a month
 * range, and the product already `arrived_at_store`. The desktop grid puts the chip that accounts
 * for it in the third column, ~270px from this line, so the line had to carry the explanation
 * itself and did not: it printed the window in the neutral past tense and the collector read a
 * defect ("why does it say expected 12 jun and not overdue?").
 *
 * Asserted on the DESKTOP row specifically, and not left to the card's coverage of the shared
 * component, because the distance between the two facts is a property of THIS grid.
 */
describe("StorePendingProductRow on the reported at-the-store row (T5c)", () => {
  function reportedRow() {
    const today = utcMidnightToday();
    return {
      deliveryState: "arrived_at_store" as const,
      // A single stated day, both endpoints equal, 66 days back: the exact shape of 12 jun.
      expectedDeliveryFrom: new Date(today.getTime() - 66 * 86_400_000),
      expectedDeliveryTo: new Date(today.getTime() - 66 * 86_400_000),
    };
  }

  it("accounts for itself on its own line instead of printing the window it beat", () => {
    renderRow(reportedRow());

    expect(screen.getByText("storeView.arrival.resolvedAtStore")).toBeInTheDocument();
    // None of the three sentences that made the row unreadable: no delay counter, no future tense,
    // and no bare past window either.
    expect(screen.queryByText(/storeView\.arrival\.overdue/)).toBeNull();
    expect(screen.queryByText(/storeView\.arrival\.arrives/)).toBeNull();
    expect(screen.queryByText(/storeView\.arrival\.expected/)).toBeNull();
  });

  it("still counts the delay on the identical row that has NOT arrived", () => {
    // The control, and the one that matters most here: the fix must not have silenced the delay
    // for everyone. Six rows of that same Palmito group are exactly this.
    renderRow({ ...reportedRow(), deliveryState: "open" });

    expect(screen.getByText(/storeView\.arrival\.overdue/)).toBeInTheDocument();
    expect(screen.queryByText("storeView.arrival.resolvedAtStore")).toBeNull();
  });

  /**
   * H8 — the majority shape of "at the store" in the real data (3 of the collector's 7 rows), and
   * the one case the reported-row test above does not cover: no window at all, not merely a past
   * one. `resolveArrivalState` already answers this input correctly (see `resolves a product at the
   * store that never had a window at all` in `arrivalWindow.test.ts`), but nothing at the component
   * level had pressed it before — a regression that made `resolved` require a window again would
   * have gone unnoticed here, having fallen to `noDate` ("Sin fecha estimada") instead.
   */
  it("still resolves a product at the store with no window to speak of", () => {
    renderRow({ deliveryState: "arrived_at_store", expectedDeliveryFrom: null, expectedDeliveryTo: null });

    expect(screen.getByText("storeView.arrival.resolvedAtStore")).toBeInTheDocument();
    expect(screen.queryByText("storeView.arrival.noDate")).toBeNull();
    expect(screen.queryByText(/storeView\.arrival\.overdue/)).toBeNull();
  });
});
