import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StoreRemovalReason, StoreStatus } from "../../../../../../../../generated/prisma/client";
import OrderDetailHero from "../OrderDetailHero";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Leaf children that pull image / clipboard / analytics deps — stubbed so the test stays focused
// on the hero's removed-store line.
vi.mock("@/components/core/StoreAvatar", () => ({
  default: () => <span data-testid="store-avatar" />,
}));
vi.mock("../OrderCodeCopyButton", () => ({
  default: () => <span data-testid="order-code" />,
}));

function buildOrder(store: { status: StoreStatus; removalReason: StoreRemovalReason | null }) {
  return {
    id: "o1",
    humanReadableId: "ORD-1",
    store: { id: "s1", name: "Manga Store", slug: "manga-store", logoUrl: null, ...store },
    orderDate: new Date("2024-01-01T00:00:00.000Z"),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    currencyCode: "USD",
    exchangeRate: null,
    needsExchangeRateUpdate: false,
    totalCost: 10000,
    status: "OPEN" as const,
  };
}

const BASE_PROPS = {
  allocatedAmountMinor: 0,
  hasUnpaidBalance: true,
  isOverdue: false,
  overdueDays: 0,
  storeDebtMinor: 0,
  locale: "en",
};

describe("OrderDetailHero removed-store tombstone", () => {
  it("does not render the tombstone line for an approved store", () => {
    render(<OrderDetailHero {...BASE_PROPS} order={buildOrder({ status: "APPROVED", removalReason: null })} />);
    expect(screen.getByText("Manga Store")).toBeInTheDocument();
    expect(screen.queryByText(/orderTombstone/)).toBeNull();
  });

  it("renders the neutral line for a removed store with a neutral reason", () => {
    render(<OrderDetailHero {...BASE_PROPS} order={buildOrder({ status: "REJECTED", removalReason: "FALSE_INFO" })} />);
    expect(screen.getByText("Manga Store")).toBeInTheDocument();
    expect(screen.getByText("orderTombstone.neutral")).toBeInTheDocument();
  });

  it("renders the sanction line for a removed store with the abuse reason", () => {
    render(<OrderDetailHero {...BASE_PROPS} order={buildOrder({ status: "REJECTED", removalReason: "ABUSE" })} />);
    expect(screen.getByText("orderTombstone.sanction")).toBeInTheDocument();
  });
});

describe("OrderDetailHero store link", () => {
  it("links the store name to its detail page, carrying returnTo/returnLabel back to this order", () => {
    render(<OrderDetailHero {...BASE_PROPS} order={buildOrder({ status: "APPROVED", removalReason: null })} />);

    const link = screen.getByRole("link", { name: "Manga Store" });
    const url = new URL(link.getAttribute("href")!, "http://localhost");
    expect(url.pathname).toBe("/en/stores/manga-store");
    expect(url.searchParams.get("returnTo")).toBe("/en/orders/o1");
    expect(url.searchParams.get("returnLabel")).toBe("ORD-1");
  });
});

// § store-level payments: the two hero states below allocated / storeDebt drive.
describe("OrderDetailHero allocation state", () => {
  const order = buildOrder({ status: "APPROVED", removalReason: null });

  it("shows the allocated-of-total line and a progress bar once something is allocated", () => {
    render(<OrderDetailHero {...BASE_PROPS} allocatedAmountMinor={5000} order={order} />);

    expect(screen.getByText("detail.hero.allocatedOfTotal")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByText("detail.hero.storeDebtLink")).toBeNull();
  });

  it("shows the store's debt link instead of a progress bar while nothing is allocated yet", () => {
    render(<OrderDetailHero {...BASE_PROPS} allocatedAmountMinor={0} storeDebtMinor={3000} order={order} />);

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("detail.hero.allocatedOfTotal")).toBeNull();
    const debtLink = screen.getByRole("link", { name: /detail\.hero\.storeDebtLink/ });
    expect(new URL(debtLink.getAttribute("href")!, "http://localhost").pathname).toBe("/en/stores/manga-store");
  });

  it("shows the credit line instead of the debt line when the store owes the collector", () => {
    render(<OrderDetailHero {...BASE_PROPS} allocatedAmountMinor={0} storeDebtMinor={-2000} order={order} />);

    expect(screen.getByText("detail.hero.storeCreditLink")).toBeInTheDocument();
    expect(screen.queryByText("detail.hero.storeDebtLink")).toBeNull();
  });

  it("shows the paid-in-full badge only once allocated reaches the total", () => {
    const { rerender } = render(<OrderDetailHero {...BASE_PROPS} allocatedAmountMinor={5000} order={order} />);
    expect(screen.queryByText("detail.hero.paidInFull")).toBeNull();

    rerender(<OrderDetailHero {...BASE_PROPS} allocatedAmountMinor={10000} order={order} />);
    expect(screen.getByText("detail.hero.paidInFull")).toBeInTheDocument();
  });

  it("hides both the allocation line and the debt link on a cancelled order", () => {
    const cancelledOrder = { ...order, status: "CANCELLED" as const };
    render(<OrderDetailHero {...BASE_PROPS} allocatedAmountMinor={0} storeDebtMinor={3000} order={cancelledOrder} />);

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("detail.hero.storeDebtLink")).toBeNull();
    expect(screen.getByText("detail.hero.cancelledOn")).toBeInTheDocument();
  });
});
