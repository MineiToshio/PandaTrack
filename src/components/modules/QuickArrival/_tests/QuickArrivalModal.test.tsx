import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QuickArrivalModal from "../QuickArrivalModal";

const { getSettlementContextActionMock } = vi.hoisted(() => ({
  getSettlementContextActionMock: vi.fn(),
}));

vi.mock("@/app/[locale]/(app)/_actions/settlementActions", () => ({
  getSettlementContextAction: getSettlementContextActionMock,
}));

// The values are serialized into the returned string on purpose: several of this modal's strings
// exist only to state a quantity or an order code, and a mock that dropped the interpolations
// would let the component pass the wrong ones (or none) without any test noticing.
vi.mock("next-intl", () => ({
  useLocale: () => "es",
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values && Object.keys(values).length > 0 ? `${key}|${JSON.stringify(values)}` : key;
    t.rich = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

type MockModalAction = { label: string; onClick: () => void; disabled?: boolean };

// Same shell stub the other modal tests use: exercise this component's own markup and actions
// without the adaptive dialog/sheet machinery.
vi.mock("@/components/modules/Modal/Modal", () => ({
  default: ({
    isOpen,
    subtitle,
    children,
    primaryAction,
    secondaryAction,
  }: {
    isOpen: boolean;
    subtitle?: string;
    children: ReactNode;
    primaryAction: MockModalAction;
    secondaryAction: MockModalAction;
  }) =>
    isOpen ? (
      <div>
        <p data-testid="modal-subtitle">{subtitle}</p>
        {children}
        <button type="button" onClick={primaryAction.onClick}>
          {primaryAction.label}
        </button>
        <button type="button" onClick={secondaryAction.onClick}>
          {secondaryAction.label}
        </button>
      </div>
    ) : null,
}));

const ITEMS = [
  { id: "item-1", name: "Nendoroid Miku" },
  { id: "item-2", name: "Figma Rem" },
  { id: "item-3", name: "Scale Figure Asuka" },
];

function renderModal(overrides: Partial<React.ComponentProps<typeof QuickArrivalModal>> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(
    <QuickArrivalModal
      isOpen
      onClose={onClose}
      subtitle="PED-001 · AmiAmi"
      items={ITEMS}
      baseCurrencyCode="USD"
      locale="es"
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit, onClose };
}

describe("QuickArrivalModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preselects every eligible product so the whole-box case is one tap", async () => {
    const { onSubmit, onClose } = renderModal();

    await userEvent.click(screen.getByRole("button", { name: /detail\.quickArrival\.confirmCount/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].productIds).toEqual(["item-1", "item-2", "item-3"]);
    // Optimistic Confirmation: the surface dismisses without waiting for the server.
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows every product so nothing is confirmed blind", () => {
    renderModal();

    expect(screen.getByRole("checkbox", { name: "Nendoroid Miku" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Figma Rem" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Scale Figure Asuka" })).toBeInTheDocument();
  });

  it("submits only the products left checked", async () => {
    const { onSubmit } = renderModal();

    await userEvent.click(screen.getByRole("checkbox", { name: "Figma Rem" }));
    await userEvent.click(screen.getByRole("button", { name: /detail\.quickArrival\.confirmCount/ }));

    expect(onSubmit.mock.calls[0][0].productIds).toEqual(["item-1", "item-3"]);
  });

  it("refuses to submit with nothing selected", async () => {
    const { onSubmit, onClose } = renderModal();

    await userEvent.click(screen.getByRole("button", { name: "detail.quickArrival.selectNone" }));
    await userEvent.click(screen.getByRole("button", { name: /detail\.quickArrival\.confirmCount/ }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders no product picker for a single-product order", () => {
    renderModal({ items: [ITEMS[0]] });

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("keeps the count and the list for a hand-picked selection of exactly one product", () => {
    // The store-scoped selection's confirmation contract is "count plus list", and it does not get
    // to change shape at one product: those rows were chosen by hand, not preselected here, so the
    // dialog has to echo the selection back. `26 of 36 orders` contribute a single pending
    // product, so this is the common case, not the corner one.
    renderModal({ items: [ITEMS[0]], alwaysListItems: true });

    expect(screen.getByRole("checkbox", { name: "Nendoroid Miku" })).toBeInTheDocument();
    expect(screen.getByText(/detail\.quickArrival\.selectedCount/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /detail\.quickArrival\.confirmCount/ })).toBeInTheDocument();
  });

  it("defaults the arrival date to today and records no shipping cost", async () => {
    const { onSubmit } = renderModal();

    await userEvent.click(screen.getByRole("button", { name: /detail\.quickArrival\.confirmCount/ }));

    const payload = onSubmit.mock.calls[0][0];
    const today = new Date();
    expect(payload.receivedDate.toISOString().slice(0, 10)).toBe(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
    );
    expect(payload.cost).toBe(0);
    expect(payload.shippedDate).toBeNull();
    expect(payload.exchangeRate).toBeNull();
  });

  it("states the collapsed defaults on screen instead of applying them silently", () => {
    renderModal();

    expect(screen.getByText("detail.quickArrival.shipping.defaultsNotice")).toBeInTheDocument();
  });

  it("keeps the shipping details collapsed until asked for", async () => {
    renderModal();

    expect(screen.queryByLabelText(/quickArrival.costLabel/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "detail.quickArrival.shipping.show" }));

    expect(screen.getByRole("button", { name: "detail.quickArrival.shipping.hide" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});

describe("QuickArrivalModal products it cannot offer", () => {
  /**
   * The modal only lists products still eligible for a delivery. An order showing "6 productos"
   * whose sixth already arrived opens a list of five, and with nothing said about the missing one
   * that reads as the modal having dropped it.
   */
  it("states how many products already shipped or arrived", () => {
    renderModal({ settledItemCount: 1 });

    expect(screen.getByText(/detail\.quickArrival\.settledNotListed/)).toBeInTheDocument();
  });

  it("says nothing when every product is still offerable", () => {
    renderModal({ settledItemCount: 0 });

    expect(screen.queryByText(/detail\.quickArrival\.settledNotListed/)).not.toBeInTheDocument();
  });

  it("says nothing when the caller does not know the count", () => {
    renderModal();

    expect(screen.queryByText(/detail\.quickArrival\.settledNotListed/)).not.toBeInTheDocument();
  });
});

/**
 * Store-scoped arrival: the same modal, opened from the orders list "Por tienda" view over a
 * selection that can span several orders of one store. One `Delivery` is written for the whole
 * selection (`BR-08-12`), so the modal has to say so and has to make the provenance of each
 * product visible before the collector confirms.
 */
describe("QuickArrivalModal over a store-scoped selection", () => {
  const CROSS_ORDER_ITEMS = [
    { id: "item-1", name: "Nendoroid Miku", orderLabel: "PED-001" },
    { id: "item-2", name: "Figma Rem", orderLabel: "PED-002" },
    { id: "item-3", name: "Scale Figure Asuka", orderLabel: "PED-001" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the subtitle the caller composed instead of building one from an order code", () => {
    renderModal({ subtitle: "Pop Dealer · 3 productos de 2 pedidos" });

    expect(screen.getByTestId("modal-subtitle")).toHaveTextContent("Pop Dealer · 3 productos de 2 pedidos");
  });

  it("declares in the primary action how many products it is about to log", () => {
    renderModal({ items: CROSS_ORDER_ITEMS });

    expect(screen.getByRole("button", { name: /confirmCount\|\{"count":3\}/ })).toBeInTheDocument();
  });

  it("keeps the declared count in step with the live selection", async () => {
    renderModal({ items: CROSS_ORDER_ITEMS });

    await userEvent.click(screen.getByRole("checkbox", { name: "Figma Rem" }));

    expect(screen.getByRole("button", { name: /confirmCount\|\{"count":2\}/ })).toBeInTheDocument();
  });

  it("groups the products under their source order when the selection crosses orders", () => {
    renderModal({ items: CROSS_ORDER_ITEMS });

    // Named groups only: the picker's own <fieldset> also carries the implicit `group` role.
    const groups = screen.getAllByRole("group", { name: /orderGroupLabel/ });
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveAccessibleName('detail.quickArrival.orderGroupLabel|{"code":"PED-001"}');
    expect(groups[1]).toHaveAccessibleName('detail.quickArrival.orderGroupLabel|{"code":"PED-002"}');
    // Order preserved inside each group, and every product still reachable as its own checkbox.
    expect(
      within(groups[0])
        .getAllByRole("checkbox")
        .map((box) => box.getAttribute("id")),
    ).toEqual(["quick-arrival-item-item-1", "quick-arrival-item-item-3"]);
    expect(within(groups[1]).getAllByRole("checkbox")).toHaveLength(1);
  });

  it("warns that a single delivery will be created, with the product count", () => {
    renderModal({ items: CROSS_ORDER_ITEMS });

    expect(screen.getByText('detail.quickArrival.multiOrderNotice|{"count":3}')).toBeInTheDocument();
  });

  it("does not group or warn when every selected product comes from the same order", () => {
    renderModal({
      items: [
        { id: "item-1", name: "Nendoroid Miku", orderLabel: "PED-001" },
        { id: "item-2", name: "Figma Rem", orderLabel: "PED-001" },
      ],
    });

    expect(screen.queryByRole("group", { name: /orderGroupLabel/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/multiOrderNotice/)).not.toBeInTheDocument();
  });

  it("leaves the per-order launchers flat: no order labels means no grouping and no notice", () => {
    renderModal();

    expect(screen.queryByRole("group", { name: /orderGroupLabel/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/multiOrderNotice/)).not.toBeInTheDocument();
  });

  it("submits one flat product list, regardless of how many orders it spans", async () => {
    const { onSubmit } = renderModal({ items: CROSS_ORDER_ITEMS });

    await userEvent.click(screen.getByRole("button", { name: /confirmCount/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].productIds).toEqual(["item-1", "item-2", "item-3"]);
  });
});

/**
 * Settlement on arrival (`WO-08`, `ADR 0032`): the "Ya pagué el resto" checkbox and its detail,
 * reference and guard copy. The modal fetches a preview via `getSettlementContextAction` once it
 * opens (mocked here so every scenario controls exactly what the resolver would have said).
 */
describe("QuickArrivalModal settlement on arrival (WO-08)", () => {
  const SINGLE_ITEM = [{ id: "item-1", name: "Nendoroid Miku", orderId: "order-1" }];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders no checkbox when the order has nothing left to settle", async () => {
    getSettlementContextActionMock.mockResolvedValue({
      ok: true,
      contexts: [
        {
          orderId: "order-1",
          currencyCode: "USD",
          closesOrder: true,
          unassignedMinor: 0,
          plan: { kind: "nothingToSettle" },
          defaultChecked: false,
        },
      ],
    });

    renderModal({ items: SINGLE_ITEM, orderId: "order-1" });

    await waitFor(() => expect(getSettlementContextActionMock).toHaveBeenCalled());
    expect(
      screen.queryByRole("checkbox", { name: "detail.quickArrival.settlement.checkboxLabel" }),
    ).not.toBeInTheDocument();
  });

  it("pre-marks the checkbox when the arrival closes the order and no unassigned money exists", async () => {
    getSettlementContextActionMock.mockResolvedValue({
      ok: true,
      contexts: [
        {
          orderId: "order-1",
          currencyCode: "USD",
          closesOrder: true,
          unassignedMinor: 0,
          plan: { kind: "computedFull", amountMinor: 5000, appliedUnassignedMinor: 0 },
          defaultChecked: true,
        },
      ],
    });

    renderModal({ items: SINGLE_ITEM, orderId: "order-1" });

    const checkbox = await screen.findByRole("checkbox", { name: "detail.quickArrival.settlement.checkboxLabel" });
    expect(checkbox).toBeChecked();
  });

  it("pre-marks the checkbox (informative only) when the arrival closes the order despite unassigned money existing", async () => {
    getSettlementContextActionMock.mockResolvedValue({
      ok: true,
      contexts: [
        {
          orderId: "order-1",
          currencyCode: "USD",
          closesOrder: true,
          unassignedMinor: 1000,
          plan: { kind: "computedFull", amountMinor: 4000, appliedUnassignedMinor: 1000 },
          defaultChecked: true,
        },
      ],
    });

    renderModal({ items: SINGLE_ITEM, orderId: "order-1" });

    const checkbox = await screen.findByRole("checkbox", { name: "detail.quickArrival.settlement.checkboxLabel" });
    expect(checkbox).toBeChecked();
    expect(screen.getByText(/settlement\.appliedUnassigned/)).toBeInTheDocument();
  });

  it("double-counting guard: leaves the checkbox unmarked when the arrival does NOT close the order and unassigned money exists", async () => {
    getSettlementContextActionMock.mockResolvedValue({
      ok: true,
      contexts: [
        {
          orderId: "order-1",
          currencyCode: "USD",
          closesOrder: false,
          unassignedMinor: 1500,
          plan: { kind: "computedPartial", amountMinor: 800, undetailed: false },
          defaultChecked: false,
        },
      ],
    });

    renderModal({ items: SINGLE_ITEM, orderId: "order-1" });

    const checkbox = await screen.findByRole("checkbox", { name: "detail.quickArrival.settlement.checkboxLabel" });
    expect(checkbox).not.toBeChecked();
  });

  it("shows the unassigned-money guard notice only when the arrival stays open and money is unassigned", async () => {
    getSettlementContextActionMock.mockResolvedValue({
      ok: true,
      contexts: [
        {
          orderId: "order-1",
          currencyCode: "USD",
          closesOrder: false,
          unassignedMinor: 1500,
          plan: { kind: "computedPartial", amountMinor: 800, undetailed: false },
          defaultChecked: false,
        },
      ],
    });

    renderModal({ items: SINGLE_ITEM, orderId: "order-1", storeName: "AmiAmi" });

    await screen.findByRole("checkbox", { name: "detail.quickArrival.settlement.checkboxLabel" });
    await userEvent.click(screen.getByRole("checkbox", { name: "detail.quickArrival.settlement.checkboxLabel" }));
    expect(screen.getByText(/settlement\.unassignedNotice/)).toBeInTheDocument();
  });

  it("shows a blank amount input plus the missing-price reason and the reference figure on the manual branch", async () => {
    getSettlementContextActionMock.mockResolvedValue({
      ok: true,
      contexts: [
        {
          orderId: "order-1",
          currencyCode: "USD",
          closesOrder: false,
          unassignedMinor: 0,
          plan: { kind: "manual", reasonCode: "missingPrice", referenceAmountMinor: 3000 },
          defaultChecked: true,
        },
      ],
    });

    renderModal({ items: SINGLE_ITEM, orderId: "order-1" });

    await screen.findByRole("checkbox", { name: "detail.quickArrival.settlement.checkboxLabel" });
    expect(screen.getByText("detail.quickArrival.settlement.reasonMissingPrice")).toBeInTheDocument();
    expect(screen.getByText(/settlement\.reference/)).toBeInTheDocument();
    const amountInput = screen.getByPlaceholderText("detail.quickArrival.costPlaceholder");
    expect(amountInput).toHaveValue("");
  });

  it("refuses to submit the manual branch with a blank amount", async () => {
    getSettlementContextActionMock.mockResolvedValue({
      ok: true,
      contexts: [
        {
          orderId: "order-1",
          currencyCode: "USD",
          closesOrder: false,
          unassignedMinor: 0,
          plan: { kind: "manual", reasonCode: "missingPrice", referenceAmountMinor: 3000 },
          defaultChecked: true,
        },
      ],
    });

    const { onSubmit } = renderModal({ items: SINGLE_ITEM, orderId: "order-1" });

    await screen.findByRole("checkbox", { name: "detail.quickArrival.settlement.checkboxLabel" });
    await userEvent.click(screen.getByRole("button", { name: /detail\.quickArrival\.confirm/ }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the computed amount's order id as a settlement intent, with the settlement date defaulted to the arrival date", async () => {
    getSettlementContextActionMock.mockResolvedValue({
      ok: true,
      contexts: [
        {
          orderId: "order-1",
          currencyCode: "USD",
          closesOrder: true,
          unassignedMinor: 0,
          plan: { kind: "computedFull", amountMinor: 5000, appliedUnassignedMinor: 0 },
          defaultChecked: true,
        },
      ],
    });

    const { onSubmit } = renderModal({ items: SINGLE_ITEM, orderId: "order-1" });

    await screen.findByRole("checkbox", { name: "detail.quickArrival.settlement.checkboxLabel" });
    await userEvent.click(screen.getByRole("button", { name: /detail\.quickArrival\.confirm/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.settleRemainder).toBe(true);
    expect(payload.settlementIntents).toEqual([
      { orderId: "order-1", manualAmountMinor: undefined, branchHint: "full" },
    ]);
    expect(payload.settlementDate.toISOString().slice(0, 10)).toBe(payload.receivedDate.toISOString().slice(0, 10));
  });

  it("submits settleRemainder: false and no settlement date when the collector unchecks the box", async () => {
    getSettlementContextActionMock.mockResolvedValue({
      ok: true,
      contexts: [
        {
          orderId: "order-1",
          currencyCode: "USD",
          closesOrder: true,
          unassignedMinor: 0,
          plan: { kind: "computedFull", amountMinor: 5000, appliedUnassignedMinor: 0 },
          defaultChecked: true,
        },
      ],
    });

    const { onSubmit } = renderModal({ items: SINGLE_ITEM, orderId: "order-1" });

    await screen.findByRole("checkbox", { name: "detail.quickArrival.settlement.checkboxLabel" });
    await userEvent.click(screen.getByRole("checkbox", { name: "detail.quickArrival.settlement.checkboxLabel" }));
    await userEvent.click(screen.getByRole("button", { name: /detail\.quickArrival\.confirm/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.settleRemainder).toBe(false);
    expect(payload.settlementDate).toBeUndefined();
    expect(payload.settlementIntents).toBeUndefined();
  });

  // MAJOR F4, 2026-08-20 review: before the fix, the settlement-context effect was keyed on
  // `[isOpen]` only, so it fetched exactly once when the dialog opened and never again — deselecting
  // a product moved the picker's own state but never re-requested the preview, which kept quoting a
  // figure for every eligible product regardless of what was actually still checked.
  it("re-fetches the settlement preview with the NARROWED selection when a product is deselected", async () => {
    const MULTI_ITEMS = [
      { id: "item-1", name: "Nendoroid Miku", orderId: "order-1" },
      { id: "item-2", name: "Figma Rem", orderId: "order-1" },
    ];
    getSettlementContextActionMock.mockResolvedValue({
      ok: true,
      contexts: [
        {
          orderId: "order-1",
          currencyCode: "USD",
          closesOrder: true,
          unassignedMinor: 0,
          plan: { kind: "computedFull", amountMinor: 10000, appliedUnassignedMinor: 0 },
          defaultChecked: true,
        },
      ],
    });

    renderModal({ items: MULTI_ITEMS, orderId: "order-1" });

    await waitFor(() =>
      expect(getSettlementContextActionMock).toHaveBeenCalledWith({
        orders: [{ orderId: "order-1", deliveredItemIds: ["item-1", "item-2"] }],
      }),
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "Figma Rem" }));

    await waitFor(() =>
      expect(getSettlementContextActionMock).toHaveBeenLastCalledWith({
        orders: [{ orderId: "order-1", deliveredItemIds: ["item-1"] }],
      }),
    );
  });

  // MAJOR, 2026-08-21 review: `getSettlementContextAction`'s `.then` had no rejection handler, so a
  // rejected promise (a thrown module-evaluation error, a dropped connection) left `settlementContexts`
  // `null` and `isLoadingSettlement` `true` forever — "Calculando…" never clears. Before this fix
  // this test times out waiting for the loading indicator to disappear.
  it("clears the loading state instead of hanging when the settlement-context fetch rejects", async () => {
    getSettlementContextActionMock.mockRejectedValue(new Error("boom"));

    renderModal({ items: SINGLE_ITEM, orderId: "order-1" });

    await waitFor(() => expect(getSettlementContextActionMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(
      screen.queryByRole("checkbox", { name: "detail.quickArrival.settlement.checkboxLabel" }),
    ).not.toBeInTheDocument();
  });

  it("shows the loading state instead of a stale figure while the debounced re-fetch is pending", async () => {
    const MULTI_ITEMS = [
      { id: "item-1", name: "Nendoroid Miku", orderId: "order-1" },
      { id: "item-2", name: "Figma Rem", orderId: "order-1" },
    ];
    getSettlementContextActionMock.mockResolvedValue({
      ok: true,
      contexts: [
        {
          orderId: "order-1",
          currencyCode: "USD",
          closesOrder: true,
          unassignedMinor: 0,
          plan: { kind: "computedFull", amountMinor: 10000, appliedUnassignedMinor: 0 },
          defaultChecked: true,
        },
      ],
    });

    renderModal({ items: MULTI_ITEMS, orderId: "order-1" });
    await waitFor(() => expect(getSettlementContextActionMock).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("checkbox", { name: "Figma Rem" }));

    expect(screen.getByRole("status")).toHaveTextContent("detail.quickArrival.settlement.loading");
  });
});
