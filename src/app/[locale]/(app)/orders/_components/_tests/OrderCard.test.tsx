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

function buildOrder(
  store: OrdersListPageItem["store"],
  overrides: Partial<OrdersListPageItem> = {},
): OrdersListPageItem {
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
    ...overrides,
  };
}

const APPROVED_STORE: OrdersListPageItem["store"] = {
  id: "s1",
  name: "Manga Store",
  slug: "manga-store",
  logoUrl: null,
  status: "APPROVED",
  removalReason: null,
};

const BASE_PROPS = {
  locale: "en",
  today: new Date("2024-02-01T00:00:00.000Z"),
  returnTo: "/en/orders",
  baseCurrencyCode: "PEN",
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
          logoUrl: null,
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
          logoUrl: null,
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
          logoUrl: null,
          status: "REJECTED",
          removalReason: "ABUSE",
        })}
      />,
    );
    expect(screen.getByRole("img", { name: "orderTombstone.sanction" })).toBeInTheDocument();
  });
});

/** Mobile counterpart of the desktop row's `FR-05-35` signal — same rule, same copy. */
describe("OrderCard outstanding-balance signal", () => {
  it("flags a completed order that still owes money, beside its status chip", () => {
    render(
      <OrderCard {...BASE_PROPS} order={buildOrder(APPROVED_STORE, { status: "COMPLETED", hasUnpaidBalance: true })} />,
    );
    expect(screen.getByText("card.outstandingBalance")).toBeInTheDocument();
    expect(screen.getByText("status.COMPLETED")).toBeInTheDocument();
  });

  it("stays silent on a settled completed order", () => {
    render(
      <OrderCard
        {...BASE_PROPS}
        order={buildOrder(APPROVED_STORE, { status: "COMPLETED", hasUnpaidBalance: false })}
      />,
    );
    expect(screen.queryByText("card.outstandingBalance")).not.toBeInTheDocument();
  });
});

/**
 * T10c — the mobile half of T10b. Same rule, same three-way line, asserted here because this card
 * and `OrdersTable` compute it independently and are the two surfaces that can drift apart.
 */
describe("OrderCard arrival line on an order already at the store", () => {
  const AT_STORE_ITEM = {
    id: "i1",
    name: "Starter Deck EX ST-30",
    quantity: 1,
    productTypeKey: null,
    unitPrice: null,
    deliveryState: "arrived_at_store" as const,
  };

  it("neither flags nor re-promises an order whose every product is already at the store", () => {
    render(
      <OrderCard
        {...BASE_PROPS}
        order={buildOrder(APPROVED_STORE, {
          expectedDeliveryTo: new Date("2023-12-12T00:00:00.000Z"),
          itemCount: 1,
          items: [AT_STORE_ITEM],
        })}
      />,
    );

    expect(screen.getByText("table.arrivalResolved")).toBeInTheDocument();
    // "llega" would be a future tense over a December date read in February, which is exactly what
    // suppressing the delay alone would have produced.
    expect(screen.queryByText("table.arrivalArrives")).not.toBeInTheDocument();
    expect(screen.queryByText("table.arrivalExpected")).not.toBeInTheDocument();
    expect(screen.queryByText(/card\.overdue/)).not.toBeInTheDocument();
  });

  it("keeps flagging an order that still has one product waiting", () => {
    render(
      <OrderCard
        {...BASE_PROPS}
        order={buildOrder(APPROVED_STORE, {
          expectedDeliveryTo: new Date("2023-12-12T00:00:00.000Z"),
          itemCount: 2,
          items: [
            AT_STORE_ITEM,
            {
              id: "i2",
              name: "Sigue esperando",
              quantity: 1,
              productTypeKey: null,
              unitPrice: null,
              deliveryState: "open" as const,
            },
          ],
        })}
      />,
    );

    expect(screen.getByText(/card\.overdue/)).toBeInTheDocument();
    expect(screen.getByText("table.arrivalExpected")).toBeInTheDocument();
    expect(screen.queryByText("table.arrivalResolved")).not.toBeInTheDocument();
  });
});
