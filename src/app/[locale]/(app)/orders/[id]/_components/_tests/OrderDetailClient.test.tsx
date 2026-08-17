import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The coordinator, exercised against the REAL payments aside card.
 *
 * Everything mocked here is either a sibling surface the card does not own (hero, sticky bar,
 * modals) or a boundary a unit test cannot cross (the Server Action, the router, the toast). The
 * aside card and the inline form are the subject, so they run for real: what #24 pins down is
 * exactly the seam between them, and mocking the card away would have tested the mock.
 */
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const addToastMock = vi.fn();
vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

const addPaymentMock = vi.fn();
const deletePaymentMock = vi.fn();
vi.mock("../../_actions/orderPaymentActions", () => ({
  addPaymentAction: (...args: unknown[]) => addPaymentMock(...args),
  deletePaymentAction: (...args: unknown[]) => deletePaymentMock(...args),
}));

vi.mock("../OrderDetailHero", () => ({ default: () => <div data-testid="hero" /> }));
vi.mock("../OrderPaymentRow", () => ({ default: () => <li data-testid="payment-row" /> }));
vi.mock("../OrderMobileActionsCard", () => ({ default: () => <div data-testid="mobile-actions" /> }));
vi.mock("../OrderPaymentMobileSheet", () => ({ default: () => <div data-testid="mobile-sheet" /> }));
vi.mock("../OrderCancelModal", () => ({ default: () => null }));
vi.mock("../OrderDeleteModal", () => ({ default: () => null }));
vi.mock("../OrderDetailStickyActionBar", () => ({
  default: () => <div data-testid="sticky-bar" />,
  hasStickyBarActions: () => false,
}));
vi.mock("@/components/modules/QuickArrival", () => ({ QuickArrivalModal: () => null }));
vi.mock("@/components/modules/QuickArrival/useQuickArrival", () => ({
  useQuickArrival: () => ({ isOpen: false, open: vi.fn(), close: vi.fn(), submit: vi.fn() }),
}));

import { StoreStatus } from "../../../../../../../../generated/prisma/client";
import OrderDetailClient from "../OrderDetailClient";

const TOTAL_COST = 41000;

const STORE = {
  id: "store-1",
  name: "Manga Store",
  slug: "manga-store",
  status: StoreStatus.APPROVED,
  removalReason: null,
  logoUrl: null,
};

/** Two priced products, which is the minimum for the breakdown panel to be offered at all. */
const TWO_PRODUCTS = [
  { id: "item-1", name: "Kingdom 23", paidDeclared: false, basePagableMinor: 20500, allocatedMinor: 0 },
  { id: "item-2", name: "Berserk deluxe", paidDeclared: false, basePagableMinor: 20500, allocatedMinor: 0 },
];

function renderDetail(overrides: { totalCost?: number; initialPaid?: number; items?: typeof TWO_PRODUCTS } = {}) {
  const totalCost = overrides.totalCost ?? TOTAL_COST;
  const initialPaid = overrides.initialPaid ?? 0;

  render(
    <OrderDetailClient
      order={{
        id: "order-1",
        humanReadableId: "ORD-20260814-01",
        store: STORE,
        storeName: STORE.name,
        totalCost,
        status: "OPEN",
        currencyCode: "PEN",
        exchangeRate: null,
        needsExchangeRateUpdate: false,
        orderDate: new Date("2026-01-01T00:00:00.000Z"),
        expectedDeliveryFrom: null,
        expectedDeliveryTo: null,
        note: null,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        initialPayments:
          initialPaid > 0
            ? [
                {
                  id: "pay-1",
                  amount: initialPaid,
                  paymentDate: new Date("2026-01-02T00:00:00.000Z"),
                  paymentId: "pay-1",
                  paymentTotalMinor: initialPaid,
                  isShared: false,
                  isPartialClaim: false,
                  detailedLineCount: 0,
                },
              ]
            : [],
        eligibility: {} as never,
        flags: {} as never,
        items: overrides.items ?? [
          { id: "item-1", name: "Nendoroid Miku", paidDeclared: false, basePagableMinor: null, allocatedMinor: 0 },
        ],
        undetailedPaidMinor: 0,
      }}
      isOverdue={false}
      overdueDays={0}
      locale="es"
      storeDebtMinor={0}
      quickArrivalItems={[]}
      canCreateDelivery={false}
      baseCurrencyCode="PEN"
      mainColumnExtras={null}
      actionsCard={null}
      noteCard={null}
    />,
  );
}

/** Opens the desktop inline panel and types an amount into it. */
function submitPayment(amount: string) {
  fireEvent.click(screen.getByRole("button", { name: "detail.payments.addCta" }));
  fireEvent.change(screen.getByLabelText("detail.payments.amountLabel"), { target: { value: amount } });
  fireEvent.click(screen.getByRole("button", { name: "detail.payments.submitPaymentAmount" }));
}

function successResult(paidAmount: number, totalCost = TOTAL_COST) {
  return {
    ok: true as const,
    paymentId: "pay-new",
    paidAmount,
    remainingAmount: Math.max(0, totalCost - paidAmount),
    paymentPercentage: Math.round((paidAmount / totalCost) * 100),
    payments: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// #24
describe("desktop inline panel folds optimistically", () => {
  it("folds in the same tick as the submit, without waiting for the server", async () => {
    // The mobile sheet already did this; desktop sat on a spinner until the promise came back. What
    // the collector should be watching is the hero bar and the "Falta" figure moving, and neither
    // is visible behind an open panel.
    let resolveAction: ((value: unknown) => void) | undefined;
    addPaymentMock.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );

    renderDetail();
    submitPayment("410.00");

    // No `await`, no `waitFor`: the panel must already be gone while the action is still in flight.
    expect(screen.queryByLabelText("detail.payments.amountLabel")).toBeNull();
    expect(addPaymentMock).toHaveBeenCalledTimes(1);

    resolveAction?.(successResult(41000));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("rolls back and says so by toast, because the panel is no longer there to say it inline", async () => {
    addPaymentMock.mockResolvedValue({ ok: false, error: "STORE_DEBT_EXCEEDED" });

    renderDetail();
    submitPayment("410.00");

    await waitFor(() =>
      expect(addToastMock).toHaveBeenCalledWith("detail.payments.storeDebtExceeded", { variant: "error" }),
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

// #25
describe("the paid-in-full toast marks the order, not the instalment", () => {
  it("fires only when this payment is the one that closes the balance", async () => {
    addPaymentMock.mockResolvedValue(successResult(41000));

    renderDetail();
    submitPayment("410.00");

    await waitFor(() =>
      expect(addToastMock).toHaveBeenCalledWith("detail.payments.paidInFullToast", { variant: "success" }),
    );
  });

  it("stays silent on a partial payment, where the bar moving is already the answer", async () => {
    addPaymentMock.mockResolvedValue(successResult(8200));

    renderDetail();
    submitPayment("82.00");

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(addToastMock).not.toHaveBeenCalled();
  });

  it("stays silent on a payment added to an order that was already fully paid", async () => {
    // Nothing was crossed: the milestone happened on some earlier payment, and repeating the
    // congratulation on every later one is exactly the noise a 626-payment habit cannot afford.
    addPaymentMock.mockResolvedValue(successResult(41000));

    renderDetail({ initialPaid: 41000 });

    // A fully paid order offers no "Anotar pago" CTA at all, which is the stronger form of silence:
    // there is no second door through which the milestone toast could fire twice.
    expect(screen.queryByRole("button", { name: "detail.payments.addCta" })).toBeNull();
    // Both aside instances (the desktop rail and the mobile stack) say it.
    expect(screen.getAllByText("detail.payments.summaryFullyPaid")).toHaveLength(2);
    expect(addToastMock).not.toHaveBeenCalled();
  });
});

/**
 * A submission carrying a breakdown draft is the ONE exception to optimistic confirmation, and the
 * reason is asymmetric: `handleAddPayment` rolls back `payments`, never the draft, so dismissing on
 * a refusal destroys up to six hand-typed lines with no way to get them back.
 *
 * Both cases below open the desktop panel, but what they pin down is a MOBILE failure: that surface
 * is a `<Modal>` and the coordinator's toast renders behind it, so a sheet that stayed up while its
 * refusal went to a toast would show the collector nothing at all.
 */
function submitWithBreakdown(amount: string) {
  fireEvent.click(screen.getByRole("button", { name: "detail.payments.addCta" }));
  fireEvent.change(screen.getByLabelText("detail.payments.amountLabel"), { target: { value: amount } });
  fireEvent.click(screen.getByRole("button", { name: "toggle" }));
  fireEvent.click(screen.getAllByRole("checkbox")[0]);
  fireEvent.click(screen.getByRole("button", { name: "detail.payments.submitPaymentAmount" }));
}

describe("a refusal over a live breakdown is reported inside the form, never by toast", () => {
  // T13
  it("keeps the draft, marks the refused line and does not fire the coordinator's toast", async () => {
    addPaymentMock.mockResolvedValue({ ok: false, error: "EXCEEDS_ITEM_BASE", orderItemId: "item-1" });

    renderDetail({ items: TWO_PRODUCTS });
    submitWithBreakdown("410.00");

    // The message is INSIDE the form, which is therefore still mounted.
    await waitFor(() => expect(screen.getByText("detail.payments.errorItemBase")).toBeInTheDocument());
    expect(screen.getByLabelText("detail.payments.amountLabel")).toBeInTheDocument();

    // The whole draft survived: the box is still ticked and its amount is still in its field.
    expect((screen.getAllByRole("checkbox")[0] as HTMLInputElement).checked).toBe(true);
    const [refusedField, untouchedField] = screen.getAllByLabelText("amountAria");
    // By-price over one ticked line of a two-product order: 410.00 x 205.00/410.00.
    expect(refusedField).toHaveValue("205.00");
    expect(untouchedField).toHaveValue("");
    // And the server said WHICH line, so that line carries the rail rather than the whole panel.
    expect(refusedField).toHaveAttribute("aria-invalid", "true");

    expect(addToastMock).not.toHaveBeenCalled();
  });

  it("names the STORE and its debt for the one refusal the form cannot word itself", async () => {
    // `STORE_DEBT_EXCEEDED` is about what is still owed the store across every order, not about this
    // order's balance, and the sentence needs the store's name and that debt. Both live here. With
    // the form mounted the coordinator's toast is off (§11.3), so without the outcome carrying the
    // resolved message the collector read the generic "no se pudo registrar el pago" for a refusal
    // the server named precisely.
    addPaymentMock.mockResolvedValue({ ok: false, error: "STORE_DEBT_EXCEEDED" });

    renderDetail({ items: TWO_PRODUCTS });
    submitWithBreakdown("410.00");

    await waitFor(() => expect(screen.getByText("detail.payments.storeDebtExceeded")).toBeInTheDocument());
    expect(screen.queryByText("detail.payments.errorAdd")).toBeNull();
    expect(addToastMock).not.toHaveBeenCalled();
  });

  // T14
  it("releases the loading state and keeps the CTA live when no verdict arrives at all", async () => {
    addPaymentMock.mockRejectedValue(new Error("network"));

    renderDetail({ items: TWO_PRODUCTS });
    submitWithBreakdown("410.00");

    // Nothing was refused, so the identical resend is the right next move and the button says so.
    await waitFor(() => expect(screen.getByText("detail.payments.errorUnanswered")).toBeInTheDocument());
    const cta = screen.getByRole("button", { name: "detail.payments.submitPaymentAmount" });
    expect(cta).toBeEnabled();
    // The draft is untouched, which is the whole reason for staying open.
    expect((screen.getAllByRole("checkbox")[0] as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByLabelText("amountAria")[0]).toHaveValue("205.00");
  });
});
