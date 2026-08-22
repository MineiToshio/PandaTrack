import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StoreRemovalReason, StoreStatus } from "../../../../../../../../generated/prisma/client";
import { formatAmountSymbolOnly } from "@/lib/currency";
import OrderDetailHero from "../OrderDetailHero";

// Captures the `vars` of the LAST call for each key, so tests can assert not just that a key
// rendered but which AMOUNT it was called with — the plain `(key) => key` shape used elsewhere in
// this file cannot tell `openOrderDebtMinor` and `storeDebtMinor` apart once both format to the
// same key.
const { capturedTranslations } = vi.hoisted(() => ({
  capturedTranslations: new Map<string, Record<string, unknown> | undefined>(),
}));

vi.mock("next-intl", () => ({
  useTranslations:
    () =>
    (key: string, vars?: Record<string, unknown>): string => {
      capturedTranslations.set(key, vars);
      return key;
    },
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
  openOrderDebtMinor: 0,
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

  it("stays on the progress bar, not the debt link, once THIS order has a partial allocation even while the store still owes money elsewhere", () => {
    // The exact shape of ORD-20260313-02 (Vaulted Store) and ORD-20250909-02 (Pop Dealer Store): a
    // partial payment already declared against this order (30000/150000 and 15970/29970 in prod),
    // plus a genuine open debt on the store from ITS OTHER orders. The two lines are mutually
    // exclusive by design (see the block comment above `hasAllocation` in `OrderDetailHero`): once
    // something is declared against this order, the hero commits to "Asignado X de Y" for it and
    // leaves the store-wide figure to the store page, rather than showing both at once. A visual
    // pass that expects `isCreditAtStore || openOrderDebtMinor !== 0` alone to gate the link would
    // read this as a missing link; it is the allocated-order branch instead, not a defect.
    render(<OrderDetailHero {...BASE_PROPS} allocatedAmountMinor={3000} openOrderDebtMinor={120000} order={order} />);

    expect(screen.getByText("detail.hero.allocatedOfTotal")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /detail\.hero\.storeDebtLink/ })).toBeNull();
  });

  it("shows the store's debt link instead of a progress bar while nothing is allocated yet", () => {
    render(<OrderDetailHero {...BASE_PROPS} allocatedAmountMinor={0} openOrderDebtMinor={3000} order={order} />);

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("detail.hero.allocatedOfTotal")).toBeNull();
    const debtLink = screen.getByRole("link", { name: /detail\.hero\.storeDebtLink/ });
    expect(new URL(debtLink.getAttribute("href")!, "http://localhost").pathname).toBe("/en/stores/manga-store");
  });

  it("prints openOrderDebtMinor on the link, not the lifetime storeDebtMinor, when they diverge (ADR 0033)", () => {
    // A COMPLETED order elsewhere at this store left a balance behind (a registration gap): the
    // lifetime `storeDebtMinor` (500.00) still carries it, but `openOrderDebtMinor` (200.00)
    // excludes it. The link must print the open figure.
    capturedTranslations.clear();
    render(
      <OrderDetailHero
        {...BASE_PROPS}
        allocatedAmountMinor={0}
        storeDebtMinor={5000}
        openOrderDebtMinor={2000}
        order={order}
      />,
    );

    expect(capturedTranslations.get("detail.hero.storeDebtLink")?.amount).toBe(
      formatAmountSymbolOnly(2000, order.currencyCode, "en"),
    );
    expect(capturedTranslations.get("detail.hero.storeDebtLink")?.amount).not.toBe(
      formatAmountSymbolOnly(5000, order.currencyCode, "en"),
    );
  });

  it("never clamps a negative openOrderDebtMinor: the link renders the raw figure (BR-05-32)", () => {
    // Unreachable through the derivation by construction, but the type is not narrowed to
    // non-negative, so the component must not paper over it: hiding or clamping it would convert
    // a loud symptom (a ceiling bypassed elsewhere) into silence. `storeDebtMinor` stays positive
    // here so this exercises the debt branch, not the credit one.
    capturedTranslations.clear();
    render(
      <OrderDetailHero
        {...BASE_PROPS}
        allocatedAmountMinor={0}
        storeDebtMinor={1000}
        openOrderDebtMinor={-500}
        order={order}
      />,
    );

    const debtLink = screen.getByRole("link", { name: /detail\.hero\.storeDebtLink/ });
    expect(debtLink).toBeInTheDocument();
    expect(capturedTranslations.get("detail.hero.storeDebtLink")?.amount).toBe(
      formatAmountSymbolOnly(-500, order.currencyCode, "en"),
    );
  });

  it("shows the credit line instead of the debt line when the store owes the collector", () => {
    render(<OrderDetailHero {...BASE_PROPS} allocatedAmountMinor={0} storeDebtMinor={-2000} order={order} />);

    expect(screen.getByText("detail.hero.storeCreditLink")).toBeInTheDocument();
    expect(screen.queryByText("detail.hero.storeDebtLink")).toBeNull();
  });

  it("keeps the credit line on the lifetime storeDebtMinor even when openOrderDebtMinor differs (FR-05-63)", () => {
    // "In credit" is a fact about the store's whole history; the credit branch must not switch to
    // `openOrderDebtMinor`, even when an open order still carries its own committed balance.
    capturedTranslations.clear();
    render(
      <OrderDetailHero
        {...BASE_PROPS}
        allocatedAmountMinor={0}
        storeDebtMinor={-5000}
        openOrderDebtMinor={12000}
        order={order}
      />,
    );

    expect(screen.getByText("detail.hero.storeCreditLink")).toBeInTheDocument();
    expect(screen.queryByText("detail.hero.storeDebtLink")).toBeNull();
    expect(capturedTranslations.get("detail.hero.storeCreditLink")?.amount).toBe(
      formatAmountSymbolOnly(5000, order.currencyCode, "en"),
    );
  });

  it("shows the paid-in-full badge only once allocated reaches the total", () => {
    const { rerender } = render(<OrderDetailHero {...BASE_PROPS} allocatedAmountMinor={5000} order={order} />);
    expect(screen.queryByText("detail.hero.paidInFull")).toBeNull();

    rerender(<OrderDetailHero {...BASE_PROPS} allocatedAmountMinor={10000} order={order} />);
    expect(screen.getByText("detail.hero.paidInFull")).toBeInTheDocument();
  });

  it("renders neither the debt link nor the credit link when nothing is owed either way", () => {
    render(
      <OrderDetailHero
        {...BASE_PROPS}
        allocatedAmountMinor={0}
        storeDebtMinor={0}
        openOrderDebtMinor={0}
        order={order}
      />,
    );

    expect(screen.queryByRole("link", { name: /detail\.hero\.storeDebtLink/ })).toBeNull();
    expect(screen.queryByText("detail.hero.storeCreditLink")).toBeNull();
  });

  it("renders no debt link when the lifetime debt is a registration gap but openOrderDebtMinor is zero", () => {
    // The exact scenario ADR 0033 exists to fix: a COMPLETED order elsewhere left a balance behind,
    // so `storeDebtMinor` alone is not zero, but nothing is open. The link must stay hidden rather
    // than reappear off the lifetime figure.
    render(
      <OrderDetailHero
        {...BASE_PROPS}
        allocatedAmountMinor={0}
        storeDebtMinor={3000}
        openOrderDebtMinor={0}
        order={order}
      />,
    );

    expect(screen.queryByRole("link", { name: /detail\.hero\.storeDebtLink/ })).toBeNull();
    expect(screen.queryByText("detail.hero.storeCreditLink")).toBeNull();
  });

  it("hides both the allocation line and the debt link on a cancelled order", () => {
    const cancelledOrder = { ...order, status: "CANCELLED" as const };
    render(
      <OrderDetailHero
        {...BASE_PROPS}
        allocatedAmountMinor={0}
        storeDebtMinor={3000}
        openOrderDebtMinor={3000}
        order={cancelledOrder}
      />,
    );

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("detail.hero.storeDebtLink")).toBeNull();
    expect(screen.getByText("detail.hero.cancelledOn")).toBeInTheDocument();
  });
});
