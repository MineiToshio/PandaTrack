import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OrderMarkReconciliation } from "@/lib/orders/productPaymentState";
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
  undetailedPaidMinor: 0,
  breakdownItems: [],
  totalCost: 16000,
  markReconciliation: { markedCount: 0, totalCount: 0, reason: null },
};

const PAID_PAYMENT = {
  id: "p1",
  amount: 16000,
  paymentDate: new Date("2024-01-05T00:00:00.000Z"),
  paymentId: "pay1",
  paymentTotalMinor: 16000,
  isShared: false,
  isPartialClaim: false,
  detailedLineCount: 0,
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

describe("OrderPaymentsAsideCard coverage reconciliation", () => {
  const OPEN_SUMMARY = { paidAmount: 4000, remainingAmount: 12000, paymentPercentage: 25 };

  function renderCard(reconciliation: OrderMarkReconciliation) {
    render(
      <OrderPaymentsAsideCard
        {...BASE_PROPS}
        payments={[PAID_PAYMENT]}
        summary={OPEN_SUMMARY}
        hasUnpaidBalance
        status="OPEN"
        markReconciliation={reconciliation}
      />,
    );
  }

  it("counts marks over the SAME set the warning judges: every item of the order", () => {
    renderCard({ markedCount: 1, totalCount: 6, reason: null });

    expect(screen.getByText("detail.payments.markedCount")).toBeInTheDocument();
    expect(screen.queryByText("detail.payments.allMarkedOpenBalance")).toBeNull();
  });

  it("warns only when every product is marked and money is still owed", () => {
    renderCard({ markedCount: 6, totalCount: 6, reason: "allMarked" });

    const warning = screen.getByText("detail.payments.allMarkedOpenBalance");
    expect(warning).toBeInTheDocument();
    // Announced, never an error: the collector did nothing wrong, and it is usually already on
    // screen at load time.
    expect(warning.closest("[role='status']")).not.toBeNull();
  });

  // #21 — the card reads `reason`, not a boolean that no longer exists.
  it("keeps quiet while the reconciliation names no reason, whatever the counts look like", () => {
    // 6 of 6 marked with a `null` reason is the fully-paid order: the two axes agree.
    renderCard({ markedCount: 6, totalCount: 6, reason: null });

    expect(screen.queryByText("detail.payments.allMarkedOpenBalance")).toBeNull();
  });

  // #20
  it("states the gap as information with an action, not as a fault", () => {
    // It used to sit in a `--warning` panel with an amber border and open with an accusation
    // ("Marcaste todos los productos … y todavía le faltan"). Nothing went wrong: the collector
    // knows something the books do not. Tone `info`, and a CTA that carries the exact amount so the
    // form opens already knowing what to record — which the next assertions actually exercise,
    // because a comment claiming a contract the test never presses is how the contract goes missing.
    renderCard({ markedCount: 6, totalCount: 6, reason: "allMarked" });

    const notice = screen.getByText("detail.payments.allMarkedOpenBalance").closest("[role='status']");
    expect(notice).not.toBeNull();
    expect(notice?.className).not.toContain("--warning");
    expect(notice?.className).toContain("--info");

    const cta = screen.getByRole("button", { name: "detail.payments.allMarkedOpenBalanceCta" });
    expect(cta).toBeInTheDocument();

    fireEvent.click(cta);

    // The figure the CTA named ($120.00 of the 12000 minor units still owed), already in the field,
    // with the submit live. It used to open empty with the submit greyed out.
    const amount = screen.getByLabelText("detail.payments.amountLabel") as HTMLInputElement;
    expect(amount.value).toBe("120.00");
    expect(screen.getByRole("button", { name: "detail.payments.submitPaymentAmount" })).toBeEnabled();
  });

  // The other door into the same panel: nothing on the way in named an amount, so nothing is
  // prefilled. Pinned so the prefill cannot leak into the plain path, where a figure the collector
  // did not ask for is one they have to notice and clear.
  it("opens an EMPTY panel from the plain Anotar pago CTA", () => {
    renderCard({ markedCount: 1, totalCount: 6, reason: null });

    fireEvent.click(screen.getByRole("button", { name: /detail\.payments\.addCta/ }));

    const amount = screen.getByLabelText("detail.payments.amountLabel") as HTMLInputElement;
    expect(amount.value).toBe("");
    expect(screen.getByRole("button", { name: "detail.payments.submitPayment" })).toBeDisabled();
  });

  it("offers no inline form at all from the notice on mobile, where the sticky bar owns the action", () => {
    // The mobile instance renders with `showAddCta={false}` because `OrderPaymentMobileSheet` is the
    // single source of truth for "Anotar pago" there (spec §5.8). The notice used to bypass it and
    // mount the desktop panel inside the card, whose `autoFocus` default raises the keyboard over
    // the quick-picks the sheet is built around.
    render(
      <OrderPaymentsAsideCard
        {...BASE_PROPS}
        payments={[PAID_PAYMENT]}
        summary={OPEN_SUMMARY}
        hasUnpaidBalance
        status="OPEN"
        markReconciliation={{ markedCount: 6, totalCount: 6, reason: "allMarked" }}
        showAddCta={false}
      />,
    );

    // The notice itself still speaks: the amount is information, and the bar carries the action.
    expect(screen.getByText("detail.payments.allMarkedOpenBalance")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "detail.payments.allMarkedOpenBalanceCta" })).toBeNull();
    expect(screen.queryByLabelText("detail.payments.amountLabel")).toBeNull();
  });

  it("stays quiet on a cancelled order even when every product is marked and money is still owed", () => {
    // A cancelled order's open balance is money that will never be collected, not a live
    // contradiction the collector still needs to resolve (BR-06-07).
    render(
      <OrderPaymentsAsideCard
        {...BASE_PROPS}
        payments={[PAID_PAYMENT]}
        summary={OPEN_SUMMARY}
        hasUnpaidBalance
        status="CANCELLED"
        markReconciliation={{ markedCount: 6, totalCount: 6, reason: "allMarked" }}
      />,
    );

    expect(screen.queryByText("detail.payments.allMarkedOpenBalance")).toBeNull();
  });

  it("says nothing at all about coverage on an order with no items", () => {
    renderCard({ markedCount: 0, totalCount: 0, reason: null });

    expect(screen.queryByText("detail.payments.markedCount")).toBeNull();
    expect(screen.queryByText("detail.payments.allMarkedOpenBalance")).toBeNull();
  });

  it("names the money that reached the order without naming a product", () => {
    render(
      <OrderPaymentsAsideCard
        {...BASE_PROPS}
        payments={[PAID_PAYMENT]}
        summary={OPEN_SUMMARY}
        hasUnpaidBalance
        status="OPEN"
        undetailedPaidMinor={4000}
      />,
    );

    expect(screen.getByText("detail.payments.undetailed")).toBeInTheDocument();
  });

  // #23
  it("says the order is paid in full, in success tone, once the last centavo lands", () => {
    // The milestone worth marking is the ORDER, not the instalment.
    const { container } = render(
      <OrderPaymentsAsideCard
        {...BASE_PROPS}
        payments={[PAID_PAYMENT]}
        summary={{ paidAmount: 16000, remainingAmount: 0, paymentPercentage: 100 }}
        hasUnpaidBalance={false}
        status="OPEN"
      />,
    );

    expect(screen.getByText("detail.payments.summaryFullyPaid")).toBeInTheDocument();
    expect(screen.queryByText("detail.payments.sectionTitle")).toBeNull();
    expect(container.querySelector("section")?.getAttribute("style")).toContain("var(--success)");
  });

  it("keeps the neutral heading and accent while money is still owed", () => {
    const { container } = render(
      <OrderPaymentsAsideCard
        {...BASE_PROPS}
        payments={[PAID_PAYMENT]}
        summary={OPEN_SUMMARY}
        hasUnpaidBalance
        status="OPEN"
      />,
    );

    expect(screen.getByText("detail.payments.sectionTitle")).toBeInTheDocument();
    expect(container.querySelector("section")?.getAttribute("style")).not.toContain("var(--success)");
  });

  it("stays quiet when every peso of the order named a product", () => {
    render(
      <OrderPaymentsAsideCard
        {...BASE_PROPS}
        payments={[PAID_PAYMENT]}
        summary={OPEN_SUMMARY}
        hasUnpaidBalance
        status="OPEN"
        undetailedPaidMinor={0}
      />,
    );

    expect(screen.queryByText("detail.payments.undetailed")).toBeNull();
  });
});

/**
 * #22 — the vocabulary, not the markup.
 *
 * The card renders the KEY under a mocked `next-intl`, so what the label says can only be pinned on
 * the catalog itself. The decision is not "the string is Falta": it is that the order detail and the
 * store payment sheet stopped using two words for the same figure. "Por asignar" was accounting
 * language that existed nowhere else in the product.
 */
describe("residual vocabulary", () => {
  it.each(["es", "en"])("names the residual with the same word the store sheet uses (%s)", (locale) => {
    const catalog = JSON.parse(
      readFileSync(join(process.cwd(), "src", "i18n", "locales", locale, "orders.json"), "utf8"),
    ) as { detail: { payments: Record<string, string>; storePayment: { allocations: Record<string, string> } } };

    expect(catalog.detail.storePayment.allocations.orderBalance.replace("{amount}", "").trim().toLowerCase()).toBe(
      catalog.detail.payments.remainingToAllocate.toLowerCase(),
    );
  });
});
