import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { quickArrivalActionMock, addToastMock, refreshMock, captureMock } = vi.hoisted(() => ({
  quickArrivalActionMock: vi.fn(),
  addToastMock: vi.fn(),
  refreshMock: vi.fn(),
  captureMock: vi.fn(),
}));

vi.mock("@/app/[locale]/(app)/_actions/quickArrivalAction", () => ({
  quickArrivalAction: quickArrivalActionMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh: refreshMock }),
}));

vi.mock("@/contexts/ToastContext", () => ({ useToast: () => ({ addToast: addToastMock }) }));

vi.mock("posthog-js", () => ({ default: { capture: captureMock } }));

vi.mock("next-intl", () => ({
  useLocale: () => "es",
  useTranslations: () => {
    const t = (key: string) => key;
    t.rich = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

import OrderListRowActions from "../OrderListRowActions";
import type { OrdersListPageItem } from "@/lib/data/orders/orderQueries";

type ListItem = OrdersListPageItem["items"][number];

function makeItem(overrides: Partial<ListItem> = {}): ListItem {
  return {
    id: "item-1",
    name: "Set de 6 mistery box de One Piece",
    quantity: 1,
    productTypeKey: null,
    unitPrice: null,
    deliveryState: "open",
    ...overrides,
  };
}

function makeOrder(overrides: Partial<OrdersListPageItem> = {}): OrdersListPageItem {
  return {
    id: "order-1",
    humanReadableId: "ORD-20260730-01",
    orderDate: new Date("2026-07-20T00:00:00.000Z"),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    currencyCode: "PEN",
    exchangeRate: null,
    totalCost: 32990,
    status: "OPEN",
    store: { id: "store-1", name: "Pop Dealer Store", slug: "pop-dealer", status: "APPROVED", removalReason: null },
    itemCount: 1,
    items: [makeItem()],
    paidAmount: 0,
    paymentPercentage: 0,
    hasUnpaidBalance: true,
    ...overrides,
  } as OrdersListPageItem;
}

function renderActions(order: OrdersListPageItem, surface: "table" | "card" = "table") {
  render(
    <OrderListRowActions
      order={order}
      baseCurrencyCode="PEN"
      locale="es"
      detailHref="/es/orders/order-1"
      surface={surface}
    />,
  );
}

describe("OrderListRowActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quickArrivalActionMock.mockResolvedValue({ ok: true, deliveryId: "delivery-1" });
  });

  it("offers both delivery affordances while a product can still join a delivery", () => {
    renderActions(makeOrder());

    expect(screen.getByRole("button", { name: "rowActions.quickArrivalAriaLabel" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "rowActions.createDeliveryAriaLabel" })).toBeInTheDocument();
  });

  it("always keeps the detail link, which is the row's escape hatch", () => {
    renderActions(makeOrder({ items: [makeItem({ deliveryState: "delivered" })], status: "COMPLETED" }));

    expect(screen.getByRole("link", { name: /card.openDetail/ })).toHaveAttribute("href", "/es/orders/order-1");
  });

  it("retires both delivery affordances once every product is delivered", () => {
    renderActions(makeOrder({ items: [makeItem({ deliveryState: "delivered" })], status: "COMPLETED" }));

    expect(screen.queryByRole("button", { name: "rowActions.quickArrivalAriaLabel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "rowActions.createDeliveryAriaLabel" })).not.toBeInTheDocument();
  });

  it("retires them for a product already in transit inside another delivery", () => {
    renderActions(makeOrder({ items: [makeItem({ deliveryState: "in_transit" })], status: "IN_TRANSIT" }));

    expect(screen.queryByRole("button", { name: "rowActions.quickArrivalAriaLabel" })).not.toBeInTheDocument();
  });

  it("retires them on a cancelled order even when its products look eligible", () => {
    renderActions(makeOrder({ status: "CANCELLED" }));

    expect(screen.queryByRole("button", { name: "rowActions.quickArrivalAriaLabel" })).not.toBeInTheDocument();
  });

  it("offers only the still-eligible products to the modal", async () => {
    // Two eligible products so the modal takes its picker path; the delivered one must not appear,
    // since the list would otherwise hand `createDelivery` a product it would refuse.
    renderActions(
      makeOrder({
        items: [
          makeItem({ id: "open-item", name: "Sigue pendiente" }),
          makeItem({ id: "at-store-item", name: "Listo en tienda", deliveryState: "arrived_at_store" }),
          makeItem({ id: "gone-item", name: "Ya entregado", deliveryState: "delivered" }),
        ],
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "rowActions.quickArrivalAriaLabel" }));

    expect(screen.getByRole("checkbox", { name: "Sigue pendiente" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Listo en tienda" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Ya entregado" })).not.toBeInTheDocument();
  });


  it("drops the detail link on a card, whose whole surface is already that link", () => {
    renderActions(makeOrder(), "card");

    expect(screen.getByRole("button", { name: "rowActions.quickArrivalAriaLabel" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /card.openDetail/ })).not.toBeInTheDocument();
  });

  it("renders nothing on a card with no action left, instead of an empty seam", () => {
    const { container } = render(
      <OrderListRowActions
        order={makeOrder({ items: [makeItem({ deliveryState: "delivered" })], status: "COMPLETED" })}
        baseCurrencyCode="PEN"
        locale="es"
        detailHref="/es/orders/order-1"
        surface="card"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("gives the primary action the row's only accent, so the card keeps the emphasis", () => {
    // Hierarchy is carried by colour alone: no fill, no taller control. A tonal pill here
    // outranked the card it belongs to.
    renderActions(makeOrder());

    const primary = screen.getByRole("button", { name: "rowActions.quickArrivalAriaLabel" });
    const secondary = screen.getByRole("link", { name: "rowActions.createDeliveryAriaLabel" });

    expect(primary.className).toContain("[color:var(--accent)]");
    expect(secondary.className).toContain("[color:var(--text-secondary)]");
    expect(primary.className).not.toContain("background");
  });

  it("logs the arrival through the shared action and refreshes the list", async () => {
    renderActions(makeOrder());

    await userEvent.click(screen.getByRole("button", { name: "rowActions.quickArrivalAriaLabel" }));
    await userEvent.click(screen.getByRole("button", { name: "detail.quickArrival.confirm" }));

    expect(quickArrivalActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", productIds: ["item-1"] }),
    );
    // List membership is server-derived (filters, sort, pagination), so it refreshes rather than
    // guessing what the row should become.
    expect(refreshMock).toHaveBeenCalled();
  });

  it("records which surface the flow was opened from", async () => {
    renderActions(makeOrder());

    await userEvent.click(screen.getByRole("button", { name: "rowActions.quickArrivalAriaLabel" }));

    expect(captureMock).toHaveBeenCalledWith(
      "delivery_quick_arrival_opened",
      expect.objectContaining({ order_id: "order-1", source: "order_list", list: "table" }),
    );
  });
});
