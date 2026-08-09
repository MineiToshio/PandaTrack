import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StorePaymentSheet from "../StorePaymentSheet";
import type { AssignableOrder } from "@/lib/data/orders/storePaymentAssignableOrdersQueries";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key);
    t.rich = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

type MockModalAction = { label: string; onClick: () => void; disabled?: boolean };

// Same shell stub other modal tests use — exercise this component's own markup and actions
// without the adaptive dialog/sheet machinery.
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
        <button type="button" onClick={secondaryAction.onClick}>
          {secondaryAction.label}
        </button>
      </div>
    ) : null,
}));

function makeOrder(overrides: Partial<AssignableOrder> = {}): AssignableOrder {
  return {
    orderId: "order-1",
    orderDate: new Date("2026-01-05T00:00:00.000Z"),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    currencyCode: "PEN",
    totalCost: 10000,
    allocatedAmountMinor: 0,
    assignableMinor: 10000,
    items: [
      { itemId: "item-1", name: "Nendoroid Miku", basePagableMinor: 6000, allocatedMinor: 0 },
      { itemId: "item-2", name: "Figma Rem", basePagableMinor: 4000, allocatedMinor: 0 },
    ],
    ...overrides,
  };
}

function renderSheet(overrides: Partial<ComponentProps<typeof StorePaymentSheet>> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(
    <StorePaymentSheet
      isOpen
      onClose={onClose}
      storeName="Akiba Books"
      debts={[{ currencyCode: "PEN", debtMinor: 10000 }]}
      orders={[makeOrder()]}
      ordersLoading={false}
      locale="es"
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit, onClose };
}

async function fillAmountAndDate(amount: string) {
  const amountInput = screen.getByLabelText(/amountLabel/);
  await userEvent.type(amountInput, amount);
}

describe("StorePaymentSheet — monomoneda", () => {
  it("renders no currency selector for a single-currency store", () => {
    renderSheet();
    expect(screen.queryByLabelText(/currencyLabel/)).not.toBeInTheDocument();
  });

  it("shows the store's debt for that currency", () => {
    renderSheet();
    expect(screen.getByText(/debtAmount/)).toBeInTheDocument();
  });
});

describe("StorePaymentSheet — multimoneda", () => {
  it("shows a currency selector that filters the eligible orders", async () => {
    renderSheet({
      debts: [
        { currencyCode: "PEN", debtMinor: 10000 },
        { currencyCode: "USD", debtMinor: 5000 },
      ],
      orders: [
        makeOrder({ orderId: "order-pen", currencyCode: "PEN" }),
        makeOrder({ orderId: "order-usd", currencyCode: "USD", items: [] }),
      ],
    });

    expect(screen.getByLabelText(/currencyLabel/)).toBeInTheDocument();

    // Open the declaration list and confirm it shows the PEN order by default.
    await userEvent.click(screen.getByText("allocations.toggle"));
    expect(screen.getByText("Nendoroid Miku")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/currencyLabel/), "USD");
    expect(screen.queryByText("Nendoroid Miku")).not.toBeInTheDocument();
  });
});

describe("StorePaymentSheet — error de excedente", () => {
  it("blocks submission and shows the exceeds-debt banner once the amount is over the debt", async () => {
    const { onSubmit } = renderSheet({ debts: [{ currencyCode: "PEN", debtMinor: 5000 }] });

    await fillAmountAndDate("60"); // 6000 minor units > 5000 debt

    expect(screen.getByRole("alert")).toHaveTextContent("exceedsDebt");
    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "submit" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("StorePaymentSheet — fecha anterior al pedido", () => {
  it("blocks submission and shows the inline date error once a declared order's date is after the payment date", async () => {
    // The sheet's payment date defaults to today. An order dated far in the future is always
    // "after" today without needing to drive the calendar popup — exactly the shape this rule
    // guards against (a payment allegedly predating the order it is declared for).
    const futureOrder = makeOrder({ orderDate: new Date("2999-01-01T00:00:00.000Z") });
    const { onSubmit } = renderSheet({ orders: [futureOrder] });

    await fillAmountAndDate("100");
    await userEvent.click(screen.getByText("allocations.toggle"));
    const orderAmountInput = screen.getByLabelText(/orderAmountAria/);
    await userEvent.type(orderAmountInput, "40");

    expect(screen.getByText("dateBeforeOrder")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "submit" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not flag an order with no declaration even when its date is in the future", async () => {
    const futureOrder = makeOrder({ orderDate: new Date("2999-01-01T00:00:00.000Z") });
    renderSheet({ orders: [futureOrder] });

    await fillAmountAndDate("100");

    expect(screen.queryByText("dateBeforeOrder")).not.toBeInTheDocument();
  });
});

describe("StorePaymentSheet — contador vivo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a live 'sin asignar' counter that reflects typed order allocations", async () => {
    renderSheet();
    await fillAmountAndDate("100"); // 10000 minor units, well within the 10000 debt

    await userEvent.click(screen.getByText("allocations.toggle"));
    expect(
      screen.getByText((content) => content.includes("allocations.unallocated") && content.includes("100.00")),
    ).toBeInTheDocument();

    const orderAmountInput = screen.getByLabelText(/orderAmountAria/);
    await userEvent.type(orderAmountInput, "40");

    expect(
      screen.getByText((content) => content.includes("allocations.unallocated") && content.includes("60.00")),
    ).toBeInTheDocument();
  });

  it("submits the built allocation lines and closes synchronously (Optimistic Confirmation)", async () => {
    const { onSubmit, onClose } = renderSheet();
    await fillAmountAndDate("100");

    await userEvent.click(screen.getByText("allocations.toggle"));
    const orderAmountInput = screen.getByLabelText(/orderAmountAria/);
    await userEvent.type(orderAmountInput, "40");

    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.amount).toBe(10000);
    expect(payload.currencyCode).toBe("PEN");
    expect(payload.allocations).toEqual([{ orderId: "order-1", amountMinor: 4000 }]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
