import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import OrderItemStatePill from "../OrderItemStatePill";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      "detail.items.statusPending": "Pendiente en tienda",
      "detail.items.statusArrived": "Listo en tienda",
      "detail.items.statusInTransit": "En camino",
      "detail.items.statusDelivered": "Entregado",
      "detail.items.markAsArrived": "Mark as ready at store",
      "detail.items.revertToPending": "Mark as pending again",
      "detail.items.arrivedToggleDisabledLive": "Locked by delivery",
      "detail.items.arrivedToggleDisabledCancelled": "Order cancelled",
    };
    return map[key] ?? key;
  },
}));

const actionMock = vi.fn();
vi.mock("../../_actions/orderItemActions", () => ({
  setOrderItemArrivedAction: (...args: unknown[]) => actionMock(...args),
}));

describe("OrderItemStatePill", () => {
  beforeEach(() => {
    actionMock.mockReset();
  });

  it("renders a static span when locked by a live delivery", () => {
    render(
      <OrderItemStatePill
        orderId="o1"
        itemId="i1"
        initialState="in_transit"
        lockedByDelivery
        lockedByCancellation={false}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("En camino")).toBeTruthy();
  });

  it("renders a static span when the order is cancelled", () => {
    render(
      <OrderItemStatePill orderId="o1" itemId="i1" initialState="open" lockedByDelivery={false} lockedByCancellation />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Pendiente en tienda")).toBeTruthy();
  });

  it("flips open → arrived optimistically when tapped", async () => {
    actionMock.mockResolvedValue({ ok: true, arrived: true });
    render(
      <OrderItemStatePill
        orderId="o1"
        itemId="i1"
        initialState="open"
        lockedByDelivery={false}
        lockedByCancellation={false}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    // Optimistic flip — pill content becomes the "arrived" label immediately.
    expect(screen.getByText("Listo en tienda")).toBeTruthy();

    await waitFor(() => expect(actionMock).toHaveBeenCalledWith("o1", "i1", true));
  });

  it("reverts when the server action fails", async () => {
    actionMock.mockResolvedValue({ ok: false, error: "ITEM_HAS_LIVE_DELIVERY" });
    render(
      <OrderItemStatePill
        orderId="o1"
        itemId="i1"
        initialState="open"
        lockedByDelivery={false}
        lockedByCancellation={false}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      // pill reverted back to "pending" content
      expect(screen.getByText("Pendiente en tienda")).toBeTruthy();
    });
  });
});
