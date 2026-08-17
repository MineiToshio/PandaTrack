import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "es",
  useTranslations: () => {
    const t = (key: string) => key;
    t.rich = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

vi.mock("@/contexts/ToastContext", () => ({ useToast: () => ({ addToast: vi.fn() }) }));

vi.mock("../../_actions/orderLifecycleActions", () => ({ reactivateOrderAction: vi.fn() }));

import OrderActionsCard from "../OrderActionsCard";

const BASE_PROPS = {
  orderId: "order-1",
  humanReadableId: "ORD-20260718-01",
  storeName: "Pop Legends",
  storeSlug: "pop-legends-64e367",
  eligibility: { canDelete: true, canCancel: true },
  paidAmountMinor: 8000,
  currencyCode: "PEN",
  hasPayments: true,
  markedItemCount: 0,
  locale: "es",
  baseCurrencyCode: "PEN",
};

function createDeliveryLink() {
  return screen.queryAllByRole("link").find((node) => node.getAttribute("href")?.includes("/deliveries/new"));
}

describe("OrderActionsCard delivery affordances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers both delivery actions while a product can still join a delivery", () => {
    render(
      <OrderActionsCard
        {...BASE_PROPS}
        status="OPEN"
        quickArrivalItems={[{ id: "item-1", name: "Album Saint Seiya" }]}
      />,
    );

    expect(screen.getByRole("button", { name: "detail.actions.quickArrival" })).toBeInTheDocument();
    expect(createDeliveryLink()).toBeDefined();
  });

  it("retires 'Crear entrega' once every product is already delivered", () => {
    // The reported bug: a COMPLETED order kept offering a wizard that could only reach its own
    // empty state, because nothing was left to put in a delivery.
    render(<OrderActionsCard {...BASE_PROPS} status="COMPLETED" quickArrivalItems={[]} />);

    expect(createDeliveryLink()).toBeUndefined();
    expect(screen.queryByRole("button", { name: "detail.actions.quickArrival" })).not.toBeInTheDocument();
  });

  it("retires it too when the products are in transit inside another delivery", () => {
    render(<OrderActionsCard {...BASE_PROPS} status="IN_TRANSIT" quickArrivalItems={[]} />);

    expect(createDeliveryLink()).toBeUndefined();
  });

  it("keeps editing and deleting available when the delivery actions are gone", () => {
    render(<OrderActionsCard {...BASE_PROPS} status="COMPLETED" quickArrivalItems={[]} />);

    expect(screen.getByRole("link", { name: /detail.actions.edit/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /detail.actions.delete/ })).toBeInTheDocument();
  });
});

describe("OrderActionsCard view store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links to the store, carrying returnTo/returnLabel back to this order, active or cancelled", () => {
    render(<OrderActionsCard {...BASE_PROPS} status="OPEN" quickArrivalItems={[]} />);

    const link = screen.getByRole("link", { name: /detail.actions.viewStore/ });
    const url = new URL(link.getAttribute("href")!, "http://localhost");
    expect(url.pathname).toBe("/es/stores/pop-legends-64e367");
    expect(url.searchParams.get("returnTo")).toBe("/es/orders/order-1");
    expect(url.searchParams.get("returnLabel")).toBe("ORD-20260718-01");
  });

  it("stays available on a cancelled order, unlike the disabled edit action", () => {
    render(<OrderActionsCard {...BASE_PROPS} status="CANCELLED" quickArrivalItems={[]} />);

    expect(screen.getByRole("link", { name: /detail.actions.viewStore/ })).toBeInTheDocument();
  });
});
