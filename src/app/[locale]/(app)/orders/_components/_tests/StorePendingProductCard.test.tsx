import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PendingProductRow } from "@/lib/data/orders/pendingProductsByStoreQueries";
import { addUtcDays, utcMidnightToday } from "@/test/domainDateFixtures";
import StorePendingProductCard from "../StorePendingProductCard";

/**
 * Interpolating mock, deliberately, and the same one the desktop row's test uses. The key-only stub
 * this file started with made any assertion about a rendered DATE unfalsifiable: the key alone would
 * satisfy it whatever window the component chose to print. Every accessible name that carries an ICU
 * var is therefore matched by prefix here.
 */
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${Object.values(vars).join(" ")}` : key,
}));

vi.mock("@/components/core/ViewTransitionLink", () => ({
  default: ({ children, ...props }: { children?: React.ReactNode }) => <a {...props}>{children}</a>,
}));

/** Resolves like the real action: the toggle awaits it, and `undefined` would throw in the stub. */
const arrivedActionMock = vi.fn(async (..._args: unknown[]): Promise<{ ok: boolean }> => ({ ok: true }));
// `../../_actions`: see the desktop row's test. The old path resolved to nothing.
vi.mock("../../_actions/orderItemActions", () => ({
  setOrderItemArrivedAction: (...args: unknown[]) => arrivedActionMock(...args),
  setOrderItemPaidDeclaredAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function buildProduct(overrides: Partial<PendingProductRow> = {}): PendingProductRow {
  return {
    itemId: "item-1",
    name: "Brook (Wanted) #2220 - Pop! Album / Cover Deluxe (One Piece)",
    quantity: 1,
    deliveryState: "open",
    unitPrice: 27990,
    allocatedMinor: 0,
    paidDeclared: false,
    orderId: "order-1",
    orderHumanReadableId: "PED-1",
    orderDate: new Date("2026-02-11T00:00:00.000Z"),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    orderAllocatedAmountMinor: 0,
    orderHasUndetailedMoney: false,
    orderTotalCost: 27990,
    orderItemCount: 1,
    currencyCode: "PEN",
    basePagableMinor: 27990,
    ...overrides,
  };
}

function renderCard(overrides: Partial<PendingProductRow> = {}, props: { isFlaggedIneligible?: boolean } = {}) {
  const { container } = render(
    <StorePendingProductCard
      product={buildProduct(overrides)}
      locale="es"
      returnTo="/es/orders"
      isSelectable={false}
      isSelected={false}
      isFlaggedIneligible={props.isFlaggedIneligible ?? false}
      today={utcMidnightToday()}
      onPaidMarkError={() => {}}
      onToggleSelect={vi.fn()}
    />,
  );
  return container;
}

describe("StorePendingProductCard", () => {
  it("pins the state chip so the product name is what gives up the width, not the pill", () => {
    // The chip is a pill with a background: squeezed, it wraps into a two- or three-line blob
    // instead of getting shorter. Measured before this wrapper existed: 54 of 67 rows wrapped at
    // 375px and 63 of 67 at 320px, with row heights ranging 66-135px. The class lives HERE and not
    // in `OrderItemStateChip` because it is only correct where something else on the line can
    // absorb the width — in `OrderCard` the same pin overflowed 40px under the quantity column.
    const container = renderCard();
    const chipWrapper = container.querySelector("li > div > div > span:last-of-type") as HTMLElement;

    expect(chipWrapper.className).toContain("shrink-0");
    expect(chipWrapper.className).toContain("whitespace-nowrap");
  });

  it("asks the chip to go quiet in the default state, because the list is already about it", () => {
    // `labelDisplay="exceptional"`: below `md` a pending row keeps the control and drops the words
    // ("Pendiente en tienda" was 131.3px of a 309px line, on 61 of 67 rows), while a row that
    // deviates keeps its full pill. See `docs/design/interface-patterns.md` §8.
    renderCard();

    expect(screen.getByText("card.itemDelivery.open").className).toContain("hidden md:inline");
  });

  it("keeps the words on a row whose state deviates from the list's subject", () => {
    renderCard({ deliveryState: "arrived_at_store" });

    expect(screen.getByText("card.itemDelivery.arrived_at_store").className).not.toContain("hidden");
  });
});

describe("StorePendingProductCard payment coverage", () => {
  /**
   * The one deduction that costs nothing: `Order.totalCost` is mandatory, so an order at zero
   * balance PROVES every product of it is covered. On the collector's real data this settles 17 of
   * the 42 products that would otherwise show a control asking them to declare by hand what the
   * app already knows.
   */
  it("shows a settled chip and no control when the whole ORDER owes nothing", () => {
    renderCard({ orderTotalCost: 27990, orderAllocatedAmountMinor: 27990, basePagableMinor: null });

    expect(screen.getByText("storeView.settled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Aria$/ })).toBeNull();
  });

  it("shows the settled chip on a fully paid ORDER even with no mark on the product", () => {
    renderCard({ paidDeclared: false, orderTotalCost: 27990, orderAllocatedAmountMinor: 27990 });

    expect(screen.getByText("storeView.settled")).toBeInTheDocument();
  });

  it("lets the order's proof outrank a mark that is also present", () => {
    // The mark still exists in the database and the order detail still shows it. Here the proven
    // fact is the whole answer, so two products of the same fully paid order never look different
    // depending on whether a button was ever pressed.
    renderCard({ paidDeclared: true, orderTotalCost: 27990, orderAllocatedAmountMinor: 27990 });

    expect(screen.getByText("storeView.settled")).toBeInTheDocument();
    expect(screen.queryByText("marked")).toBeNull();
  });

  it("announces the collector's own mark when the arithmetic does not settle it", () => {
    renderCard({ paidDeclared: true, orderTotalCost: 60000, orderAllocatedAmountMinor: 0 });

    expect(screen.getByText("marked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^unmarkAria/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("offers the mark on an unmarked product of an order that still owes", () => {
    renderCard({ paidDeclared: false, orderTotalCost: 60000, orderAllocatedAmountMinor: 0, basePagableMinor: null });

    expect(screen.getByRole("button", { name: /^markAria/ })).toHaveAttribute("aria-pressed", "false");
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

/** The same shape two months AHEAD: an overdue row states its delay instead of its window. */
function wholeFutureMonth() {
  const today = utcMidnightToday();
  return {
    expectedDeliveryFrom: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 2, 1)),
    expectedDeliveryTo: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 3, 0)),
  };
}

/**
 * T8 — the mobile card gets its OWN test, not a shared one with the desktop row.
 *
 * They are two files, and one passing says nothing about the other: applying the change to the row
 * alone leaves the desktop green and this suite red, which is the entire point of duplicating the
 * assertions rather than parameterising them.
 */
describe("StorePendingProductCard arrival window (T8)", () => {
  it("renders the expected-arrival window collapsed to its month", () => {
    const window = wholeFutureMonth();
    renderCard(window);

    const monthLabel = window.expectedDeliveryTo.toLocaleDateString("es", { month: "short", timeZone: "UTC" });
    expect(screen.getByText(/storeView\.arrival\.arrives/)).toHaveTextContent(monthLabel);
  });

  it("does not render the order date in any form", () => {
    const container = renderCard(wholePastMonth());

    expect(screen.queryByText(/storeView\.orderedOn/)).toBeNull();
    expect(container.textContent).not.toContain("11 feb 2026");
  });

  it("states the delay INSTEAD of the estimate, in the same slot", () => {
    const window = wholePastMonth();
    const container = renderCard(window);
    const monthLabel = window.expectedDeliveryTo.toLocaleDateString("es", { month: "short", timeZone: "UTC" });

    expect(screen.getByText(/storeView\.arrival\.overdue/)).toBeInTheDocument();
    expect(screen.queryByText(/storeView\.arrival\.expected/)).toBeNull();
    expect(container.textContent).not.toContain(monthLabel);
  });

  it("keeps the delay on the window's own line, never beside the name as a chip", () => {
    renderCard(wholePastMonth());

    expect(screen.getByText(/storeView\.arrival\.overdue/).closest("p")).toBeNull();
  });

  it("moves the order link onto the product name, which is now the card's only route in", () => {
    renderCard(wholePastMonth());

    expect(screen.getByRole("link", { name: /Brook \(Wanted\)/ })).toHaveAttribute(
      "href",
      "/es/orders/order-1?returnTo=%2Fes%2Forders",
    );
  });
});

/** T7b on the mobile card. See the row's own note for why the suppression it replaces is gone. */
describe("StorePendingProductCard with a flagged row (T7b)", () => {
  it("shows the ineligible chip AND the delay, which now live on different lines", () => {
    renderCard(wholePastMonth(), { isFlaggedIneligible: true });

    expect(screen.getByText("storeView.selection.ineligibleRow")).toBeInTheDocument();
    expect(screen.getByText(/storeView\.arrival\.overdue/)).toBeInTheDocument();
  });
});

/** T9 on the mobile card. */
describe("StorePendingProductCard with no expected window (T9)", () => {
  it("states that there is no estimated date, and states no delay", () => {
    renderCard({ expectedDeliveryFrom: null, expectedDeliveryTo: null });

    expect(screen.getByText("storeView.arrival.noDate")).toBeInTheDocument();
    expect(screen.queryByText(/storeView\.arrival\.overdue/)).toBeNull();
  });
});

/**
 * T5's component half: an observed delivery event silences both the chip and the future tense, on
 * the two rows of the collector's data whose window is still AHEAD of today.
 */
describe("StorePendingProductCard does not predict a resolved arrival (T5)", () => {
  it("drops the delay on a product already at the store whose window closed", () => {
    renderCard({ ...wholePastMonth(), deliveryState: "arrived_at_store" });

    expect(screen.queryByText(/storeView\.arrival\.overdue/)).toBeNull();
  });

  /**
   * T5b — the same rule reached through the CONTROL instead of through the prop, and the case no
   * component test in this suite exercised: the state chip's optimistic flip is local, so an arrival
   * line resolving on `product.deliveryState` alone kept a delay counter running over a product the
   * collector had just marked as waiting at the store.
   */
  it("swaps the delay for the neutral form when the state chip is pressed, before the server answers", async () => {
    renderCard(wholePastMonth());

    expect(screen.getByText(/storeView\.arrival\.overdue/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "detail.items.markAsArrived" }));

    expect(screen.getByText("card.itemDelivery.arrived_at_store")).toBeInTheDocument();
    expect(screen.queryByText(/storeView\.arrival\.overdue/)).toBeNull();
    // The replacement is now the EVENT, not the neutral window it used to be: "Esperada 12 jun"
    // was the reading the collector filed as a defect.
    expect(screen.getByText("storeView.arrival.resolvedAtStore")).toBeInTheDocument();
    await waitFor(() => expect(arrivedActionMock).toHaveBeenCalled());
  });

  it("brings the delay back when the server refuses the mark", async () => {
    arrivedActionMock.mockResolvedValueOnce({ ok: false });
    renderCard(wholePastMonth());

    fireEvent.click(screen.getByRole("button", { name: "detail.items.markAsArrived" }));

    await waitFor(() => expect(screen.getByText(/storeView\.arrival\.overdue/)).toBeInTheDocument());
  });

  it("names the arrival instead of the window it already beat, and prints no window at all", () => {
    const today = utcMidnightToday();
    renderCard({
      deliveryState: "arrived_at_store",
      expectedDeliveryFrom: addUtcDays(today, 16),
      expectedDeliveryTo: addUtcDays(today, 45),
    });

    expect(screen.getByText("storeView.arrival.resolvedAtStore")).toBeInTheDocument();
    // Both of the window sentences, because this is the row shape that made the defect worst: its
    // window is still AHEAD, so it read as a live promise ("Esperada oct") about a product already
    // on the shelf. Two of the collector's four resolved rows are this shape.
    expect(screen.queryByText(/storeView\.arrival\.arrives/)).toBeNull();
    expect(screen.queryByText(/storeView\.arrival\.expected/)).toBeNull();
  });

  it("says the same thing about a product with no window at all", () => {
    // The three dateless at-the-store rows used to fall to "Sin fecha estimada" while their four
    // dated siblings said something else, which is a difference the collector cannot account for.
    renderCard({ deliveryState: "arrived_at_store", expectedDeliveryFrom: null, expectedDeliveryTo: null });

    expect(screen.getByText("storeView.arrival.resolvedAtStore")).toBeInTheDocument();
    expect(screen.queryByText("storeView.arrival.noDate")).toBeNull();
  });

  it("says it has shipped, not that it is at the store, once a delivery has taken it", () => {
    renderCard({ ...wholePastMonth(), deliveryState: "in_transit" });

    expect(screen.getByText("storeView.arrival.resolvedInTransit")).toBeInTheDocument();
    expect(screen.queryByText("storeView.arrival.resolvedAtStore")).toBeNull();
  });
});
