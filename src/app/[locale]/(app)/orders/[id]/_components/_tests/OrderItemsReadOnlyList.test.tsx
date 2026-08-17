import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OrderItemWithDeliveryState } from "@/lib/data/orders/orderQueries";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock("../OrderItemPaidMark", () => ({
  default: ({ proven, locked, offersMark }: { proven: boolean; locked: boolean; offersMark: boolean }) => (
    <span
      data-testid="paid-mark"
      data-proven={String(proven)}
      data-locked={String(locked)}
      data-offers={String(offersMark)}
    >
      paid-mark
    </span>
  ),
}));

vi.mock("../OrderItemStatePill", () => ({
  default: ({ lockedByDelivery }: { lockedByDelivery: boolean }) => (
    <span data-testid="state-pill" data-locked={String(lockedByDelivery)}>
      state-pill
    </span>
  ),
}));

import OrderItemsReadOnlyList from "../OrderItemsReadOnlyList";

function buildItem(overrides: Partial<OrderItemWithDeliveryState> = {}): OrderItemWithDeliveryState {
  return {
    id: "item-1",
    name: "One Piece 1",
    quantity: 1,
    unitPrice: 1000,
    productTypeKey: null,
    position: 1,
    deliveryState: "open",
    paidDeclared: false,
    allocatedMinor: 0,
    basePagableMinor: 1000,
    ...overrides,
  };
}

async function renderList(
  items: OrderItemWithDeliveryState[],
  isOrderCancelled = false,
  balance: { totalCost?: number; allocatedAmountMinor?: number; undetailedPaidMinor?: number } = {},
) {
  const jsx = await OrderItemsReadOnlyList({
    orderId: "order-1",
    items,
    currencyCode: "PEN",
    locale: "es",
    isOrderCancelled,
    showCreateDeliveryLink: true,
    totalCost: balance.totalCost ?? 10000,
    allocatedAmountMinor: balance.allocatedAmountMinor ?? 0,
    undetailedPaidMinor: balance.undetailedPaidMinor ?? 0,
  });
  render(jsx);
}

describe("OrderItemsReadOnlyList", () => {
  it("renders one row per item with its state pill", async () => {
    await renderList([buildItem({ id: "a", name: "One Piece 1" }), buildItem({ id: "b", name: "One Piece 2" })]);

    expect(screen.getByText("One Piece 1")).toBeTruthy();
    expect(screen.getByText("One Piece 2")).toBeTruthy();
    expect(screen.getAllByTestId("state-pill")).toHaveLength(2);
  });

  it("marks the pill locked for an item already inside a live delivery", async () => {
    await renderList([buildItem({ id: "a", deliveryState: "in_transit" })]);

    expect(screen.getByTestId("state-pill").getAttribute("data-locked")).toBe("true");
  });

  it("renders the empty warning with the edit link when the order has no products", async () => {
    await renderList([]);

    expect(screen.getByText("detail.items.emptyWarning")).toBeTruthy();
    expect(screen.getByRole("link", { name: "detail.items.emptyWarningCta" })).toBeTruthy();
  });
});

describe("OrderItemsReadOnlyList paid mark", () => {
  it("offers the mark on every product, delivered ones included", async () => {
    // Arriving and being paid are different axes. The detail is the ONLY surface where a delivered
    // product can still be audited for payment, so the coverage control never retires with delivery.
    await renderList([buildItem({ id: "a" }), buildItem({ id: "b", deliveryState: "delivered" })]);

    expect(screen.getAllByTestId("paid-mark")).toHaveLength(2);
  });

  it("hands the control the order's own proof, so a fully paid order needs no marking", async () => {
    await renderList([buildItem()], false, { totalCost: 10000, allocatedAmountMinor: 10000 });

    expect(screen.getByTestId("paid-mark").dataset.proven).toBe("true");
  });

  it("proves an item on its OWN allocations even while the order still owes money (case 1)", async () => {
    // The order is far from fully paid, but this item's own price base is fully covered by
    // item-level allocations — the resolver's case 1, which the old inline calc could never see.
    await renderList(
      [buildItem({ id: "a", unitPrice: 1000, quantity: 1, allocatedMinor: 1000, basePagableMinor: 1000 })],
      false,
      { totalCost: 10000, allocatedAmountMinor: 1000 },
    );

    expect(screen.getByTestId("paid-mark").dataset.proven).toBe("true");
  });

  it("does not prove an item whose own allocations fall short of its own price base", async () => {
    await renderList(
      [buildItem({ id: "a", unitPrice: 1000, quantity: 1, allocatedMinor: 400, basePagableMinor: 1000 })],
      false,
      { totalCost: 10000, allocatedAmountMinor: 400 },
    );

    expect(screen.getByTestId("paid-mark").dataset.proven).toBe("false");
  });

  it("locks the control on a cancelled order", async () => {
    await renderList([buildItem()], true);

    expect(screen.getByTestId("paid-mark").dataset.locked).toBe("true");
  });

  it("stops offering the mark on a product whose price is known", async () => {
    // The detail adopts the rule the payment sheet already applied: where the exact figure exists,
    // the figure is the answer. This is what takes the contradiction notice from 24 of the
    // collector's open orders down to 3.
    await renderList([buildItem({ id: "a", unitPrice: 1000, basePagableMinor: 1000 })]);

    expect(screen.getByTestId("paid-mark").dataset.offers).toBe("false");
  });

  it("still offers the mark on a product with no price at all", async () => {
    await renderList([buildItem({ id: "a", unitPrice: null, basePagableMinor: null })]);

    expect(screen.getByTestId("paid-mark").dataset.offers).toBe("true");
  });
});

// #10
describe("OrderItemsReadOnlyList unpriced product carrying money", () => {
  it("states the amount and draws no bar and no percentage", async () => {
    // Money declared against a product with no price base. There is no denominator, so there is no
    // ratio to draw: `interface-patterns.md` §15, "No denominator, no bar". The figure itself is
    // the whole honest statement.
    await renderList([buildItem({ id: "a", unitPrice: null, basePagableMinor: null, allocatedMinor: 800 })], false, {
      totalCost: 10000,
      allocatedAmountMinor: 800,
    });

    expect(screen.getByText("detail.payments.unpricedPartial")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    // And with money on it, the mark is no longer offered: a figure beats a claim.
    expect(screen.getByTestId("paid-mark").dataset.offers).toBe("false");
  });

  it("says nothing extra when no money named the unpriced product", async () => {
    await renderList([buildItem({ id: "a", unitPrice: null, basePagableMinor: null, allocatedMinor: 0 })]);

    expect(screen.queryByText("detail.payments.unpricedPartial")).toBeNull();
  });
});

describe("OrderItemsReadOnlyList priced product on an order holding undesglosado money", () => {
  it("states the amount, with no bar and no percentage (ADR 0028 §6)", async () => {
    // The state a breakdown creates: the product carries a declared amount AND its order holds
    // money that names no product, so its own share is a floor and no ratio built on it is honest.
    // This is the third of the three surfaces that resolve this state; the other two ("Por tienda"
    // row and card) already print the figure, and this one printed nothing at all.
    await renderList([buildItem({ id: "a", unitPrice: 5990, basePagableMinor: 5990, allocatedMinor: 1101 })], false, {
      totalCost: 24490,
      allocatedAmountMinor: 21091,
      undetailedPaidMinor: 19990,
    });

    expect(screen.getByText("detail.payments.declaredAgainst")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
