import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OrdersListPageItem } from "@/lib/data/orders/orderQueries";
import OrderCard from "../OrderCard";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Heavy leaf children that pull router / analytics / image deps — stubbed so the test stays
// focused on whether OrderCard renders the removed-store marker.
vi.mock("@/components/core/ViewTransitionLink", () => ({
  default: ({ children, ...props }: { children?: React.ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock("@/components/core/StoreAvatar", () => ({
  default: () => <span data-testid="store-avatar" />,
}));

function buildOrder(store: OrdersListPageItem["store"]): OrdersListPageItem {
  return {
    id: "o1",
    humanReadableId: "ORD-1",
    orderDate: new Date("2024-01-01T00:00:00.000Z"),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    currencyCode: "USD",
    exchangeRate: null,
    totalCost: 10000,
    status: "OPEN",
    store,
    itemCount: 0,
    items: [],
    paidAmount: 0,
    paymentPercentage: 0,
    hasUnpaidBalance: false,
  };
}

const BASE_PROPS = {
  locale: "en",
  today: new Date("2024-02-01T00:00:00.000Z"),
  returnTo: "/en/orders",
  isExpanded: false,
  onToggle: vi.fn(),
};

describe("OrderCard removed-store tombstone", () => {
  it("does not render a tombstone marker for an approved store", () => {
    render(
      <OrderCard
        {...BASE_PROPS}
        order={buildOrder({
          id: "s1",
          name: "Manga Store",
          slug: "manga-store",
          status: "APPROVED",
          removalReason: null,
        })}
      />,
    );
    expect(screen.getByText("Manga Store")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /orderTombstone/ })).toBeNull();
  });

  it("renders the neutral marker for a removed store with a neutral reason", () => {
    render(
      <OrderCard
        {...BASE_PROPS}
        order={buildOrder({
          id: "s1",
          name: "Manga Store",
          slug: "manga-store",
          status: "REJECTED",
          removalReason: "DUPLICATE",
        })}
      />,
    );
    // Name stays visible (accompany, not replace) and the marker is announced via the icon label.
    expect(screen.getByText("Manga Store")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "orderTombstone.neutral" })).toBeInTheDocument();
  });

  it("renders the sanction marker for a removed store with the abuse reason", () => {
    render(
      <OrderCard
        {...BASE_PROPS}
        order={buildOrder({
          id: "s1",
          name: "Manga Store",
          slug: "manga-store",
          status: "REJECTED",
          removalReason: "ABUSE",
        })}
      />,
    );
    expect(screen.getByRole("img", { name: "orderTombstone.sanction" })).toBeInTheDocument();
  });
});
