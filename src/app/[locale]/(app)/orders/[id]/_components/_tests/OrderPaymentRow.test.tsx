import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import OrderPaymentRow from "../OrderPaymentRow";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

type MockModalAction = { label: string; onClick: () => void; disabled?: boolean };

// Mirrors the pattern used by `OrderCancelModal.test.tsx`: stub the canonical `<Modal>` shell so
// the test exercises this component's own title/subtitle choice, not the dialog/sheet machinery.
vi.mock("@/components/modules/Modal", () => ({
  Modal: ({
    isOpen,
    title,
    subtitle,
    children,
    primaryAction,
    secondaryAction,
  }: {
    isOpen: boolean;
    title: ReactNode;
    subtitle: ReactNode;
    children: ReactNode;
    primaryAction: MockModalAction;
    secondaryAction: MockModalAction;
  }) =>
    isOpen ? (
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
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

const ONE_TO_ONE_PAYMENT = {
  id: "alloc-1",
  amount: 5000,
  paymentDate: new Date("2024-02-01T00:00:00.000Z"),
  paymentId: "pay-1",
  paymentTotalMinor: 5000,
  isShared: false,
};

const SHARED_PAYMENT = {
  id: "alloc-2",
  amount: 2000,
  paymentDate: new Date("2024-02-05T00:00:00.000Z"),
  paymentId: "pay-2",
  paymentTotalMinor: 8000,
  isShared: true,
};

const BASE_PROPS = {
  currencyCode: "USD",
  locale: "en",
  storeName: "Manga Store",
  onConfirmDelete: vi.fn(),
};

describe("OrderPaymentRow delete-confirm copy", () => {
  it("uses the 1:1 delete copy for a payment raised for this order alone", async () => {
    const user = userEvent.setup();
    render(<OrderPaymentRow {...BASE_PROPS} payment={ONE_TO_ONE_PAYMENT} />);

    await user.click(screen.getByRole("button", { name: /detail\.payments\.deleteLabelDetailed/ }));

    expect(screen.getByText("detail.payments.deleteModalTitle")).toBeInTheDocument();
    expect(screen.getByText("detail.payments.deleteModalDescription")).toBeInTheDocument();
    expect(screen.queryByText("detail.payments.deleteModalTitleShared")).not.toBeInTheDocument();
  });

  it("uses the shared-payment delete copy, and names the store, for an allocation of a shared payment", async () => {
    const user = userEvent.setup();
    render(<OrderPaymentRow {...BASE_PROPS} payment={SHARED_PAYMENT} />);

    await user.click(screen.getByRole("button", { name: /detail\.payments\.deleteLabelDetailed/ }));

    expect(screen.getByText("detail.payments.deleteModalTitleShared")).toBeInTheDocument();
    expect(screen.getByText("detail.payments.deleteModalDescriptionShared")).toBeInTheDocument();
    expect(screen.queryByText("detail.payments.deleteModalTitle")).not.toBeInTheDocument();
  });

  it("shows the shared-payment subtitle on the row itself", () => {
    render(<OrderPaymentRow {...BASE_PROPS} payment={SHARED_PAYMENT} />);
    expect(screen.getByText("detail.payments.sharedSubtitle")).toBeInTheDocument();
  });

  it("omits the shared-payment subtitle for a 1:1 payment", () => {
    render(<OrderPaymentRow {...BASE_PROPS} payment={ONE_TO_ONE_PAYMENT} />);
    expect(screen.queryByText("detail.payments.sharedSubtitle")).not.toBeInTheDocument();
  });
});
