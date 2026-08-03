import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OrderItemWithDeliveryState } from "@/lib/data/orders/orderQueries";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
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
    ...overrides,
  };
}

async function renderList(items: OrderItemWithDeliveryState[], isOrderCancelled = false) {
  const jsx = await OrderItemsReadOnlyList({
    orderId: "order-1",
    items,
    currencyCode: "PEN",
    locale: "es",
    isOrderCancelled,
    showCreateDeliveryLink: true,
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
