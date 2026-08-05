import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      "card.itemDelivery.open": "Pendiente en tienda",
      "card.itemDelivery.arrived_at_store": "Listo en tienda",
      "card.itemDelivery.in_transit": "En camino",
      "card.itemDelivery.delivered": "Entregado",
      "detail.items.markAsArrived": "Marcar como listo en tienda",
      "detail.items.revertToPending": "Volver a pendiente",
      "detail.items.arrivedToggleDisabledLive": "Este producto está vinculado a una entrega activa.",
      "detail.items.arrivedToggleDisabledCancelled": "El pedido está cancelado.",
    };
    return map[key] ?? key;
  },
}));

const actionMock = vi.fn();
vi.mock("../../../_actions/orderItemActions", () => ({
  setOrderItemArrivedAction: (...args: unknown[]) => actionMock(...args),
}));

import OrderItemStateChip from "../OrderItemStateChip";

const ORDER_ID = "order-1";
const ITEM_ID = "item-1";

function renderChip(props: Partial<React.ComponentProps<typeof OrderItemStateChip>> = {}) {
  return render(
    <OrderItemStateChip
      orderId={ORDER_ID}
      itemId={ITEM_ID}
      initialState="open"
      lockedByCancellation={false}
      {...props}
    />,
  );
}

beforeEach(() => {
  actionMock.mockReset();
  actionMock.mockResolvedValue({ ok: true, arrived: true });
});

describe("OrderItemStateChip", () => {
  it("is a button, so the state can be changed from the list without opening the order", () => {
    renderChip();
    expect(screen.getByRole("button", { name: "Marcar como listo en tienda" })).toBeTruthy();
  });

  it("flips to arrived before the server answers, and tells the server what it did", async () => {
    renderChip();

    fireEvent.click(screen.getByRole("button"));

    // Optimistic: the new label is on screen without waiting for the round trip, which is what
    // makes flipping several products in a row usable.
    expect(screen.getByText("Listo en tienda")).toBeTruthy();
    await waitFor(() => expect(actionMock).toHaveBeenCalledWith(ORDER_ID, ITEM_ID, true));
  });

  it("flips back to pending from arrived", async () => {
    renderChip({ initialState: "arrived_at_store" });

    fireEvent.click(screen.getByRole("button", { name: "Volver a pendiente" }));

    expect(screen.getByText("Pendiente en tienda")).toBeTruthy();
    await waitFor(() => expect(actionMock).toHaveBeenCalledWith(ORDER_ID, ITEM_ID, false));
  });

  it("puts the old state back when the server refuses", async () => {
    actionMock.mockResolvedValue({ ok: false, error: "server_error" });
    renderChip();

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByText("Pendiente en tienda")).toBeTruthy());
  });

  it("never navigates: the card underneath is one big link", () => {
    renderChip();
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    screen.getByRole("button").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("stays static text for an item a delivery owns", () => {
    renderChip({ initialState: "in_transit" });

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("En camino")).toBeTruthy();
  });

  it("stays static text for a delivered item", () => {
    renderChip({ initialState: "delivered" });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("stays static text on a cancelled order, whatever the item state says", () => {
    renderChip({ lockedByCancellation: true });

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Pendiente en tienda")).toBeTruthy();
  });

  it("carries pointer events, so it works inside the card's inert item rows", () => {
    const { container } = renderChip();
    expect(container.firstElementChild?.className).toContain("pointer-events-auto");
  });

  it("grows its tap area with an overlay instead of padding, so the pill keeps the row's density", () => {
    renderChip();
    const className = screen.getByRole("button").className;
    // 19px pill + 2 × 14px of transparent overlay ≈ 47px of reachable target. Padding would have
    // worked too and would have made the pill itself taller, which the list row has no room for.
    expect(className).toContain("after:-inset-y-3.5");
    expect(className).toContain("relative");
  });
});
