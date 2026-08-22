import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import StoreReconciliationSheet from "../StoreReconciliationSheet";
import type { StoreReconciliationOrderRow, StoreReconciliationSubmitInput } from "../StoreReconciliationSheet.types";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key);
    t.has = () => true;
    return t;
  },
}));

type MockModalAction = { label: string; onClick: () => void; disabled?: boolean };

/** Same shell-stub pattern as `StorePaymentSheet.test.tsx`: keeps the real props contract without
    the adaptive dialog/sheet machinery. `primaryAction` here is genuinely OPTIONAL (the sheet omits
    it in its "nothing to adjust" shape), unlike the payment sheet's always-present one. */
vi.mock("@/components/modules/Modal/Modal", () => ({
  default: function MockModal({
    isOpen,
    children,
    primaryAction,
    secondaryAction,
  }: {
    isOpen: boolean;
    children: ReactNode;
    primaryAction?: MockModalAction;
    secondaryAction: MockModalAction;
    onClose: () => void;
  }) {
    if (!isOpen) return null;
    return (
      <div role="dialog">
        <div>{children}</div>
        {primaryAction && (
          <button type="button" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
            {primaryAction.label}
          </button>
        )}
        <button type="button" onClick={secondaryAction.onClick}>
          {secondaryAction.label}
        </button>
      </div>
    );
  },
}));

function row(overrides: Partial<StoreReconciliationOrderRow> = {}): StoreReconciliationOrderRow {
  return {
    orderId: "order-1",
    orderDate: new Date("2026-06-01T00:00:00.000Z"),
    humanReadableId: "ORD-20260601-01",
    totalCost: 18000,
    openBalanceMinor: 18000,
    writtenOffMinor: 0,
    status: "OPEN" as never,
    ...overrides,
  };
}

function renderSheet(overrides: Partial<React.ComponentProps<typeof StoreReconciliationSheet>> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  const onRetryPreview = vi.fn();
  const onGoToAssignPayment = vi.fn();
  const props: React.ComponentProps<typeof StoreReconciliationSheet> = {
    isOpen: true,
    onClose,
    storeId: "store-1",
    storeName: "Akiba Records",
    currencyCode: "PEN",
    openOrderDebtMinor: 38000,
    openOrders: [],
    deliveredOrders: [],
    unassignedMinor: 0,
    previewLoading: false,
    previewError: false,
    onRetryPreview,
    locale: "es",
    onGoToAssignPayment,
    onSubmit,
    ...overrides,
  };
  const utils = render(<StoreReconciliationSheet {...props} />);
  return { ...utils, onSubmit, onClose, onRetryPreview, onGoToAssignPayment };
}

/** The reason textarea, unambiguous even though the money inputs are `role="textbox"` too. */
function reasonField(): HTMLElement {
  const element = document.getElementById("store-reconciliation-reason");
  if (!element) throw new Error("reason field not found");
  return element;
}

describe("StoreReconciliationSheet - parked money blocks the form (FR-05-69, ADR 0034 §6)", () => {
  it("hides every form control and names the amount while the store holds unassigned money", () => {
    renderSheet({
      unassignedMinor: 3000,
      openOrders: [row()],
    });

    expect(
      screen.getByText('unassignedMoneyBlocksWrite:{"store":"Akiba Records","amount":"S/ 30.00"}'),
    ).toBeInTheDocument();
    expect(screen.queryByText("openOrdersHeading")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/reasonLabel/)).not.toBeInTheDocument();
    expect(screen.queryByText("submit")).not.toBeInTheDocument();
    expect(screen.getByText("goToAssignPayment")).toBeInTheDocument();
  });

  it("closes this sheet and hands off to the store payment sheet when asked to assign", async () => {
    const user = userEvent.setup();
    const { onClose, onGoToAssignPayment } = renderSheet({ unassignedMinor: 3000 });

    await user.click(screen.getByText("goToAssignPayment"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onGoToAssignPayment).toHaveBeenCalledTimes(1);
  });
});

describe("StoreReconciliationSheet - nothing to adjust", () => {
  it("says so instead of offering a write when nothing is parked and no order carries a balance", () => {
    renderSheet({ openOrders: [], deliveredOrders: [], unassignedMinor: 0 });

    expect(screen.getByText("nothingToAdjust")).toBeInTheDocument();
    expect(screen.queryByText("submit")).not.toBeInTheDocument();
  });
});

describe("StoreReconciliationSheet - the two groups", () => {
  it("renders only the open-orders group when there are no delivered ones", () => {
    renderSheet({ openOrders: [row()], deliveredOrders: [] });

    expect(screen.getByText("openOrdersHeading")).toBeInTheDocument();
    expect(screen.queryByText("deliveredOrdersHeading")).not.toBeInTheDocument();
  });

  it("renders only the delivered-orders group on a store with zero open orders (the back-catalogue case)", () => {
    renderSheet({
      openOrders: [],
      deliveredOrders: [row({ orderId: "order-2", status: "COMPLETED" as never })],
    });

    expect(screen.queryByText("openOrdersHeading")).not.toBeInTheDocument();
    expect(screen.getByText("deliveredOrdersHeading")).toBeInTheDocument();
    expect(screen.getByText('deliveredOrdersExplainer:{"store":"Akiba Records"}')).toBeInTheDocument();
  });

  it("renders both groups together when both have candidates", () => {
    renderSheet({
      openOrders: [row({ orderId: "order-1" })],
      deliveredOrders: [row({ orderId: "order-2", status: "COMPLETED" as never })],
    });

    expect(screen.getByText("openOrdersHeading")).toBeInTheDocument();
    expect(screen.getByText("deliveredOrdersHeading")).toBeInTheDocument();
  });
});

describe("StoreReconciliationSheet - marking orders and the payload it builds", () => {
  it("submits exactly one line, for the row's whole balance, when marked settled", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSheet({
      openOrders: [row({ orderId: "order-1", openBalanceMinor: 18000 })],
    });

    await user.type(reasonField(), "no identificado");
    await user.click(screen.getAllByText("markSettled")[0]);
    await user.click(screen.getByText("submit"));

    expect(onSubmit).toHaveBeenCalledWith({
      reason: "no identificado",
      lines: [{ orderId: "order-1", amountMinor: 18000 }],
    });
  });

  it("submits a partial line equal to the balance minus the typed remainder", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSheet({
      openOrders: [row({ orderId: "order-1", openBalanceMinor: 18000 })],
    });

    const remainingInput = screen.getByRole("textbox", { name: /remainingInputAria/ });
    await user.clear(remainingInput);
    await user.type(remainingInput, "50");
    await user.type(reasonField(), "el precio cambió");
    await user.click(screen.getByText("submit"));

    // Balance 180.00, remaining 50.00 typed -> write-off of 130.00 (13000 minor).
    expect(onSubmit).toHaveBeenCalledWith({
      reason: "el precio cambió",
      lines: [{ orderId: "order-1", amountMinor: 13000 }],
    });
  });

  it('"todo saldado" marks every listed row at once, still one line per order', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSheet({
      openOrders: [row({ orderId: "order-1", openBalanceMinor: 18000 })],
      deliveredOrders: [row({ orderId: "order-2", openBalanceMinor: 20000, status: "COMPLETED" as never })],
    });

    await user.click(screen.getByText("markAllSettled"));
    await user.type(reasonField(), "no identificado");
    await user.click(screen.getByText("submit"));

    expect(onSubmit).toHaveBeenCalledWith({
      reason: "no identificado",
      lines: expect.arrayContaining([
        { orderId: "order-1", amountMinor: 18000 },
        { orderId: "order-2", amountMinor: 20000 },
      ]),
    });
    expect((onSubmit.mock.calls[0][0] as StoreReconciliationSubmitInput).lines).toHaveLength(2);
  });

  it("the read-out drops by exactly the OPEN-group lines being written, never by a delivered one", async () => {
    const user = userEvent.setup();
    renderSheet({
      openOrderDebtMinor: 38000,
      openOrders: [row({ orderId: "order-1", openBalanceMinor: 18000 })],
      deliveredOrders: [row({ orderId: "order-2", openBalanceMinor: 20000, status: "COMPLETED" as never })],
    });

    expect(screen.getByText('readOut:{"amount":"S/ 380.00"}')).toBeInTheDocument();

    await user.click(screen.getAllByText("markSettled")[0]); // marks the OPEN row (order-1)
    expect(screen.getByText('readOut:{"amount":"S/ 200.00"}')).toBeInTheDocument();
  });

  it("gates submit on both a marked line and a non-empty reason", async () => {
    const user = userEvent.setup();
    renderSheet({ openOrders: [row()] });

    expect(screen.getByText("submit")).toBeDisabled();

    await user.click(screen.getAllByText("markSettled")[0]);
    expect(screen.getByText("submit")).toBeDisabled(); // still no reason

    await user.type(reasonField(), "no identificado");
    expect(screen.getByText("submit")).not.toBeDisabled();
  });

  it("shows a visible error under the field and blocks submit when a typed remainder exceeds the order's balance (MINOR-7)", async () => {
    const user = userEvent.setup();
    renderSheet({
      openOrders: [
        row({ orderId: "order-1", openBalanceMinor: 18000 }),
        row({ orderId: "order-2", openBalanceMinor: 20000 }),
      ],
    });

    const remainingInputs = screen.getAllByRole("textbox", { name: /remainingInputAria/ });
    // order-2's row stays untouched and valid on its own; only order-1 is typed out of range.
    await user.clear(remainingInputs[0]);
    await user.type(remainingInputs[0], "999999");
    await user.click(screen.getAllByText("markSettled")[1]);
    await user.type(reasonField(), "no identificado");

    expect(screen.getByRole("alert")).toHaveTextContent("remainingExceedsBalance");
    expect(remainingInputs[0]).toHaveAccessibleDescription(/remainingExceedsBalance/);
    // A gate computed only from the surviving lines (order-2's, which IS valid and non-empty) would
    // read as submittable here; the invalid row must still block it (`MINOR-7`, WO-11 review).
    expect(screen.getByText("submit")).toBeDisabled();
  });

  it("re-enables submit once the out-of-range remainder is corrected", async () => {
    const user = userEvent.setup();
    renderSheet({ openOrders: [row({ orderId: "order-1", openBalanceMinor: 18000 })] });

    const remainingInput = screen.getByRole("textbox", { name: /remainingInputAria/ });
    await user.clear(remainingInput);
    await user.type(remainingInput, "999999");
    await user.type(reasonField(), "no identificado");
    expect(screen.getByText("submit")).toBeDisabled();

    await user.clear(remainingInput);
    await user.type(remainingInput, "50");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("submit")).not.toBeDisabled();
  });

  it("names each row by its DATE, never by its ORD- code as the accessible name", () => {
    renderSheet({ openOrders: [row({ humanReadableId: "ORD-20260601-01" })] });

    // The code may appear as small secondary text, but no control's accessible name IS the code.
    const codeAsAccessibleName = screen.queryByRole("textbox", { name: "ORD-20260601-01" });
    expect(codeAsAccessibleName).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /remainingInputAria/ })).toBeInTheDocument();
    expect(screen.getByText(/ORD-20260601-01/)).toBeInTheDocument(); // present as secondary metadata
  });
});

describe("StoreReconciliationSheet - preview loading and error", () => {
  it("shows a loading state instead of the form while the preview is in flight", () => {
    renderSheet({ previewLoading: true });
    expect(screen.getByText("previewLoading")).toBeInTheDocument();
    expect(screen.queryByText("submit")).not.toBeInTheDocument();
  });

  it("offers a retry when the preview fails to load", async () => {
    const user = userEvent.setup();
    const { onRetryPreview } = renderSheet({ previewError: true });

    expect(screen.getByText("previewError")).toBeInTheDocument();
    await user.click(screen.getByText("previewRetry"));
    expect(onRetryPreview).toHaveBeenCalledTimes(1);
  });
});
