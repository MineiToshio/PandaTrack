import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QuickArrivalModal from "../QuickArrivalModal";

vi.mock("next-intl", () => ({
  useLocale: () => "es",
  useTranslations: () => {
    const t = (key: string) => key;
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
      orderHumanReadableId="PED-001"
      storeName="AmiAmi"
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

    await userEvent.click(screen.getByRole("button", { name: "detail.quickArrival.confirm" }));

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
    await userEvent.click(screen.getByRole("button", { name: "detail.quickArrival.confirm" }));

    expect(onSubmit.mock.calls[0][0].productIds).toEqual(["item-1", "item-3"]);
  });

  it("refuses to submit with nothing selected", async () => {
    const { onSubmit, onClose } = renderModal();

    await userEvent.click(screen.getByRole("button", { name: "detail.quickArrival.selectNone" }));
    await userEvent.click(screen.getByRole("button", { name: "detail.quickArrival.confirm" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders no product picker for a single-product order", () => {
    renderModal({ items: [ITEMS[0]] });

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("defaults the arrival date to today and records no shipping cost", async () => {
    const { onSubmit } = renderModal();

    await userEvent.click(screen.getByRole("button", { name: "detail.quickArrival.confirm" }));

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
