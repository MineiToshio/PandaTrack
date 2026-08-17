import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { StorePaymentAllocationLine, StorePaymentListRow } from "@/lib/data/orders/storePaymentQueries";
import StorePaymentsSection from "../StorePaymentsSection";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, vars?: Record<string, unknown>) =>
      vars ? `${namespace}.${key}:${JSON.stringify(vars)}` : `${namespace}.${key}`;
    t.has = () => true;
    return t;
  },
}));

const state = {
  storePayments: [] as StorePaymentListRow[],
  storePaymentsTotalCount: 0,
  deleteStorePayment: vi.fn(),
  loadAllStorePayments: vi.fn(),
  isLoadingAllStorePayments: false,
  hasLoadAllStorePaymentsError: false,
};

vi.mock("../StorePaymentStateProvider", () => ({
  useStorePaymentState: () => state,
}));

/** Exactly the shape `getStorePaymentsForStore` emits, so the row is tested against real data. */
function allocationLine(overrides: Partial<StorePaymentAllocationLine> = {}): StorePaymentAllocationLine {
  const line = {
    orderId: "order-1",
    orderHumanReadableId: "ORD-20260805-07",
    orderCancelled: false,
    orderActive: true,
    orderItemId: null,
    orderItemName: null,
    amountMinor: 21660,
    settlesTarget: false,
    ...overrides,
  };
  // A cancelled order is never active, so `orderCancelled: true` alone must not leave a fixture
  // claiming both. Pass `orderActive` explicitly for the third case: delivered, and not cancelled.
  return { ...line, orderActive: overrides.orderActive ?? !line.orderCancelled };
}

function paymentRow(overrides: Partial<StorePaymentListRow> = {}): StorePaymentListRow {
  const allocations = overrides.allocations ?? [allocationLine()];
  return {
    id: "payment-1",
    amount: 21660,
    currencyCode: "PEN",
    paymentDate: new Date("2026-07-24T00:00:00.000Z"),
    note: null,
    allocatedTotal: allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0),
    claimingOrdersCount: new Set(allocations.map((allocation) => allocation.orderId)).size,
    ...overrides,
    allocations,
  };
}

function renderSection(overrides: Partial<typeof state> = {}) {
  Object.assign(state, {
    storePayments: [],
    storePaymentsTotalCount: 0,
    deleteStorePayment: vi.fn(),
    loadAllStorePayments: vi.fn(),
    isLoadingAllStorePayments: false,
    hasLoadAllStorePaymentsError: false,
    ...overrides,
  });
  return render(<StorePaymentsSection locale="es" />);
}

describe("StorePaymentsSection", () => {
  it("labels the header with the TRUE total, not the number of rows it managed to render", () => {
    // Buscalibre: 38 payments, 20 rendered. The header used to read "20".
    renderSection({
      storePayments: Array.from({ length: 20 }, (_, index) => paymentRow({ id: `payment-${index}` })),
      storePaymentsTotalCount: 38,
    });

    expect(screen.getByText("38")).toBeInTheDocument();
    expect(screen.queryByText("20")).not.toBeInTheDocument();
  });

  it("offers a real control for the withheld payments, not a sentence that reads like one", () => {
    const loadAllStorePayments = vi.fn();
    renderSection({
      storePayments: [paymentRow()],
      storePaymentsTotalCount: 38,
      loadAllStorePayments,
    });

    const button = screen.getByRole("button", {
      name: 'stores.redesign.detail.payments.seeAll:{"count":38}',
    });
    button.click();
    expect(loadAllStorePayments).toHaveBeenCalledTimes(1);
  });

  it("hides the control once the list is complete", () => {
    renderSection({ storePayments: [paymentRow()], storePaymentsTotalCount: 1 });

    expect(screen.queryByText(/payments.seeAll/)).not.toBeInTheDocument();
  });

  it("keeps the rows it has and offers a retry when the fetch fails", () => {
    renderSection({
      storePayments: [paymentRow()],
      storePaymentsTotalCount: 38,
      hasLoadAllStorePaymentsError: true,
    });

    expect(screen.getByRole("alert")).toHaveTextContent("stores.redesign.detail.payments.seeAllError");
    expect(screen.getByRole("button", { name: "stores.redesign.detail.payments.seeAllRetry" })).toBeInTheDocument();
    // The 20 rows that did arrive are still there: a section-wide error state would throw away
    // valid content to report a partial failure.
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("keeps the section expanded even at the volume that tempts collapsing it", () => {
    // Pop Dealer Store's 102. A collapsed `CollapsibleSection` body stays focusable inside an
    // `aria-hidden` subtree, and the "see all" control lives in that body.
    renderSection({
      storePayments: Array.from({ length: 102 }, (_, index) => paymentRow({ id: `payment-${index}` })),
      storePaymentsTotalCount: 102,
    });

    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();
  });
});

describe("StorePaymentsSection - what each row says the payment covers", () => {
  it("names the order and the product without any expanding", () => {
    renderSection({
      storePayments: [
        paymentRow({ allocations: [allocationLine({ orderItemId: "item-1", orderItemName: "Figura Goku SSJ4" })] }),
      ],
      storePaymentsTotalCount: 1,
    });

    const row = screen.getAllByRole("listitem")[0];
    expect(within(row).getAllByText("ORD-20260805-07").length).toBeGreaterThan(0);
    expect(within(row).getAllByText(/Figura Goku SSJ4/).length).toBeGreaterThan(0);
  });

  it("marks a payment declared against a cancelled order as lost money", () => {
    renderSection({
      storePayments: [paymentRow({ allocations: [allocationLine({ orderCancelled: true })] })],
      storePaymentsTotalCount: 1,
    });

    // Without this the row shows "ORD-20230130-01 · Todo el pedido" and reads as money that still
    // counts, while the block above has already netted it out of what is paid.
    expect(screen.getAllByText("stores.redesign.detail.payments.cancelledMarker").length).toBeGreaterThan(0);
  });

  it("marks a multi-ORDER payment as carrying lost money too", () => {
    // The collapsed row cannot name an order here (there are several), so the "Perdido" marker is
    // the only thing left on it that says part of this money died with a cancelled order. Dropping
    // it makes the one shape with the least context the one with the least warning.
    renderSection({
      storePayments: [
        paymentRow({
          amount: 30000,
          allocations: [
            allocationLine({ orderId: "order-1", amountMinor: 20000, orderCancelled: true }),
            allocationLine({ orderId: "order-2", orderHumanReadableId: "ORD-20260805-08", amountMinor: 10000 }),
          ],
        }),
      ],
      storePaymentsTotalCount: 1,
    });

    expect(screen.getAllByText(/payments.coverageManyOrders/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("stores.redesign.detail.payments.cancelledMarker").length).toBeGreaterThan(0);
  });

  it("renders no breakdown toggle for the single-declaration payment every real row is", () => {
    renderSection({ storePayments: [paymentRow()], storePaymentsTotalCount: 1 });

    expect(screen.queryByText(/breakdownToggleAria/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /breakdownToggleAria/ })).toHaveLength(0);
  });

  it("opens a read-only breakdown for a payment split across several lines", async () => {
    const user = userEvent.setup();
    renderSection({
      storePayments: [
        paymentRow({
          amount: 21660,
          allocations: [
            allocationLine({ orderItemId: "item-1", orderItemName: "Figura Goku SSJ4", amountMinor: 12000 }),
            allocationLine({ orderItemId: "item-2", orderItemName: "Manga Vol. 1", amountMinor: 9660 }),
          ],
        }),
      ],
      storePaymentsTotalCount: 1,
    });

    const toggle = screen.getByRole("button", { name: /breakdownToggleAria/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("group", { name: "stores.redesign.detail.payments.breakdownHeading" });
    expect(within(panel).getByText("Figura Goku SSJ4")).toBeInTheDocument();
    expect(within(panel).getByText("Manga Vol. 1")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-controls", panel.id);
  });

  it("keeps the delete control and the breakdown toggle on the same line, spaced apart", () => {
    // Geometry, asserted structurally. Both controls grow their hit area to 44×44 with a
    // `::before` inset of 8px, so they need 16px between their boxes; stacked on separate lines
    // they had ~7px, and the one later in the DOM takes the whole overlapping band, which cost the
    // delete button most of its tap target on mobile. Two things keep that from coming back: they
    // are siblings on one line (not one per line), and the toggle carries its own mobile margin on
    // top of the row's 8px gap. Rendered once, not once per breakpoint.
    renderSection({
      storePayments: [
        paymentRow({
          allocations: [
            allocationLine({ orderItemId: "item-1", orderItemName: "Figura Goku SSJ4", amountMinor: 12000 }),
            allocationLine({ orderItemId: "item-2", orderItemName: "Manga Vol. 1", amountMinor: 9660 }),
          ],
        }),
      ],
      storePaymentsTotalCount: 1,
    });

    const toggles = screen.getAllByRole("button", { name: /breakdownToggleAria/ });
    const deletes = screen.getAllByRole("button", { name: /payments.deleteAria/ });
    expect(toggles).toHaveLength(1);
    expect(deletes).toHaveLength(1);
    expect(toggles[0].parentElement).toBe(deletes[0].parentElement);
    expect(toggles[0].className).toContain("ml-3");
    expect(toggles[0].className).toContain("md:ml-0");
  });

  it("shows the undeclared remainder of a partly assigned payment", () => {
    renderSection({
      storePayments: [paymentRow({ amount: 30000, allocations: [allocationLine({ amountMinor: 21660 })] })],
      storePaymentsTotalCount: 1,
    });

    expect(screen.getAllByText(/payments.unassignedBadge/).length).toBeGreaterThan(0);
  });
});
