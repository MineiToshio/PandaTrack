import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrderPaymentsAsideCard from "../OrderPaymentsAsideCard";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// The row renders the canonical `<Modal>` (delete confirm) internally; stub it so this test
// stays focused on the aside card's own "lost" marker logic instead of the modal machinery.
vi.mock("../OrderPaymentRow", () => ({
  default: () => <li data-testid="payment-row" />,
}));

const BASE_PROPS = {
  currencyCode: "USD",
  orderDate: new Date("2024-01-01T00:00:00.000Z"),
  locale: "en",
  storeName: "Manga Store",
  storeSlug: "manga-store",
  onAddPayment: vi.fn(),
  onDeletePayment: vi.fn(),
  isOverdue: false,
};

const PAID_PAYMENT = {
  id: "p1",
  amount: 16000,
  paymentDate: new Date("2024-01-05T00:00:00.000Z"),
  paymentId: "pay1",
  paymentTotalMinor: 16000,
  isShared: false,
};

describe("OrderPaymentsAsideCard lost-money marker", () => {
  it("shows the lost marker for a cancelled order that retained payments", () => {
    render(
      <OrderPaymentsAsideCard
        {...BASE_PROPS}
        payments={[PAID_PAYMENT]}
        summary={{ paidAmount: 16000, remainingAmount: 0, paymentPercentage: 100 }}
        hasUnpaidBalance={false}
        status="CANCELLED"
      />,
    );

    expect(screen.getByText("detail.payments.lostMarker")).toBeInTheDocument();
  });

  it("hides the lost marker for a cancelled order with no payments", () => {
    render(
      <OrderPaymentsAsideCard
        {...BASE_PROPS}
        payments={[]}
        summary={{ paidAmount: 0, remainingAmount: 0, paymentPercentage: 0 }}
        hasUnpaidBalance={false}
        status="CANCELLED"
      />,
    );

    expect(screen.queryByText("detail.payments.lostMarker")).not.toBeInTheDocument();
  });

  it("hides the lost marker for a non-cancelled order even when it has payments", () => {
    render(
      <OrderPaymentsAsideCard
        {...BASE_PROPS}
        payments={[PAID_PAYMENT]}
        summary={{ paidAmount: 16000, remainingAmount: 4000, paymentPercentage: 80 }}
        hasUnpaidBalance={true}
        status="OPEN"
      />,
    );

    expect(screen.queryByText("detail.payments.lostMarker")).not.toBeInTheDocument();
  });
});

describe("OrderPaymentsAsideCard empty-allocation state", () => {
  it("shows the empty-state copy and a link to the store's debt when nothing is allocated", () => {
    render(
      <OrderPaymentsAsideCard
        {...BASE_PROPS}
        payments={[]}
        summary={{ paidAmount: 0, remainingAmount: 10000, paymentPercentage: 0 }}
        hasUnpaidBalance={true}
        status="OPEN"
      />,
    );

    expect(screen.getByText("detail.payments.emptyAllocated")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /detail\.payments\.viewStoreDebt/ });
    expect(link.getAttribute("href")).toBe("/en/stores/manga-store");
  });

  it("hides the empty-state copy once a payment is allocated", () => {
    render(
      <OrderPaymentsAsideCard
        {...BASE_PROPS}
        payments={[PAID_PAYMENT]}
        summary={{ paidAmount: 16000, remainingAmount: 0, paymentPercentage: 100 }}
        hasUnpaidBalance={false}
        status="OPEN"
      />,
    );

    expect(screen.queryByText("detail.payments.emptyAllocated")).not.toBeInTheDocument();
  });
});
