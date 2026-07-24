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
    store: { id: "s1", name: "Manga Store", slug: "manga-store", ...store },
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
  remainingAmount: 10000,
  paymentPercentage: 0,
  hasUnpaidBalance: true,
  isOverdue: false,
  overdueDays: 0,
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
