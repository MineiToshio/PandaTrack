import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrderCancelModal from "../OrderCancelModal";

const { cancelOrderActionMock } = vi.hoisted(() => ({
  cancelOrderActionMock: vi.fn(),
}));

vi.mock("../../_actions/orderLifecycleActions", () => ({
  cancelOrderAction: cancelOrderActionMock,
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

type MockModalAction = { label: string; onClick: () => void; disabled?: boolean };

// Mirrors the pattern used by other tests that render components wrapping the canonical
// `<Modal>` (e.g. `StorePublicReviewsSection.test.tsx`): stub the modal shell so the test
// exercises the caller's own markup and actions without the adaptive dialog/sheet machinery.
vi.mock("@/components/modules/Modal/Modal", () => ({
  default: ({
    isOpen,
    children,
    primaryAction,
    secondaryAction,
  }: {
    isOpen: boolean;
    children: ReactNode;
    primaryAction: MockModalAction;
    secondaryAction: MockModalAction;
  }) =>
    isOpen ? (
      <div>
        {children}
        <button type="button" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
          {primaryAction.label}
        </button>
        <button type="button" onClick={secondaryAction.onClick} disabled={secondaryAction.disabled}>
          {secondaryAction.label}
        </button>
      </div>
    ) : null,
}));

const BASE_PROPS = {
  isOpen: true,
  onClose: vi.fn(),
  orderId: "order-1",
  humanReadableId: "ORD-1",
  storeName: "Test Store",
  currencyCode: "USD",
};

describe("OrderCancelModal payments-choice control", () => {
  beforeEach(() => {
    cancelOrderActionMock.mockReset();
    cancelOrderActionMock.mockResolvedValue({ ok: true });
  });

  it("hides the control and cancels with the credit default when the order has no payments", async () => {
    const user = userEvent.setup();
    render(<OrderCancelModal {...BASE_PROPS} paidAmountMinor={0} hasPayments={false} />);

    expect(screen.queryByText("detail.cancelModal.paymentsCreditLabel")).not.toBeInTheDocument();
    expect(screen.queryByText("detail.cancelModal.paymentsLostLabel")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "detail.cancelModal.confirm" }));

    expect(cancelOrderActionMock).toHaveBeenCalledWith("order-1", null, "credit");
  });

  it("shows the control defaulting to credit, and submits the lost choice once selected", async () => {
    const user = userEvent.setup();
    render(<OrderCancelModal {...BASE_PROPS} paidAmountMinor={16000} hasPayments />);

    const creditRadio = screen.getByRole("radio", { name: /paymentsCreditLabel/ });
    const lostRadio = screen.getByRole("radio", { name: /paymentsLostLabel/ });
    expect(creditRadio).toBeChecked();
    expect(lostRadio).not.toBeChecked();

    await user.click(lostRadio);
    expect(lostRadio).toBeChecked();
    expect(creditRadio).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "detail.cancelModal.confirm" }));

    expect(cancelOrderActionMock).toHaveBeenCalledWith("order-1", null, "lost");
  });
});
