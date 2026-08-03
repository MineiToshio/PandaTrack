import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FxPendingOrder } from "../FxReconciliationModal";
import FxReconciliationModal from "../FxReconciliationModal";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

// The provider call is what the "today" button triggers; the layout assertions below never reach it,
// and leaving it real would put a network call in a unit test.
vi.mock("@/lib/fx/exchangeRates", () => ({
  fetchTodayRate: vi.fn(async () => ({ ok: false, reason: "network" as const })),
}));

vi.mock("../_actions/orderFxActions", () => ({
  updateExchangeRatesAction: vi.fn(),
}));

// Leaf child that renders rich translation markup for the provider credit; stubbed so the simple
// translation mock above is enough and the test stays about the rate row.
vi.mock("../share/FxRateAttribution", () => ({
  default: () => <span data-testid="fx-attribution" />,
}));

// Renders the modal inline so the rate rows are queryable without a portal target.
vi.mock("@/components/modules/Modal", () => ({
  Modal: ({ children, isOpen }: { children?: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div>{children}</div> : null,
}));

function buildOrder(overrides: Partial<FxPendingOrder> = {}): FxPendingOrder {
  return {
    id: "o1",
    humanReadableId: "ORD-20260101-01",
    totalCost: 10000,
    currencyCode: "USD",
    storeName: "Akabane Comics",
    ...overrides,
  } as FxPendingOrder;
}

describe("FxReconciliationModal rate field", () => {
  it("keeps the rate input reachable by its label after the field was moved out of the label element", () => {
    // The input and its "today" button share a stretch row so their heights match, which required
    // lifting the input out of the <label> that used to wrap it. That restructure is only safe while
    // the explicit for/id association survives, so this is the regression that matters.
    render(<FxReconciliationModal isOpen onClose={vi.fn()} baseCurrencyCode="PEN" orders={[buildOrder()]} />);

    const input = screen.getByLabelText(/fx\.modal\.rateLabel/);

    expect(input).toBeTruthy();
    expect(input.tagName).toBe("INPUT");
  });

  it("pairs the input and the today button in one stretch row so the two render the same height", () => {
    // jsdom computes no layout, so the height equality itself cannot be asserted here. What it can
    // hold is the mechanism that produces it: a flex row that stretches its children, with the input
    // taking the free space. Both order forms pair this control the same way.
    render(<FxReconciliationModal isOpen onClose={vi.fn()} baseCurrencyCode="PEN" orders={[buildOrder()]} />);

    const input = screen.getByLabelText(/fx\.modal\.rateLabel/);
    // Walk up to the first ancestor that holds both controls rather than assuming how deeply the
    // Input nests its own wrappers, so the assertion survives a change inside that component.
    let row: HTMLElement | null = input.parentElement;
    while (row && !row.querySelector("button")) {
      row = row.parentElement;
    }

    expect(row).not.toBeNull();
    expect(row?.className).toContain("items-stretch");
  });
});
