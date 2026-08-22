import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { quickArrivalActionMock, addToastMock, refreshMock, captureMock } = vi.hoisted(() => ({
  quickArrivalActionMock: vi.fn(),
  addToastMock: vi.fn(),
  refreshMock: vi.fn(),
  captureMock: vi.fn(),
}));

vi.mock("@/app/[locale]/(app)/_actions/quickArrivalAction", () => ({
  quickArrivalAction: quickArrivalActionMock,
}));

// The settlement preview (WO-08) fetches on open; a real `getSession()` call would throw outside
// a request scope, so it is stubbed to "nothing to settle" for every test that does not care about it.
vi.mock("@/app/[locale]/(app)/_actions/settlementActions", () => ({
  getSettlementContextAction: vi.fn().mockResolvedValue({ ok: true, contexts: [] }),
  retrySettlementAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: refreshMock }),
}));

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

vi.mock("posthog-js", () => ({ default: { capture: captureMock } }));

vi.mock("next-intl", () => ({
  useLocale: () => "es",
  useTranslations: () => {
    const t = (key: string) => key;
    t.rich = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

import DashboardActivityQuickArrival from "../DashboardActivityQuickArrival";

const BASE_PROPS = {
  orderId: "order-1",
  humanReadableId: "ORD-20260716-03",
  storeName: "AmiAmi",
  items: [{ id: "item-1", name: "Nendoroid Miku" }],
  baseCurrencyCode: "PEN",
  locale: "es",
  listKey: "overdue",
};

describe("DashboardActivityQuickArrival", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quickArrivalActionMock.mockResolvedValue({
      ok: true,
      deliveryId: "delivery-1",
      productCount: 1,
      moneyOutcomes: [],
    });
  });

  it("shows a labelled control and keeps the modal closed until it is used", () => {
    render(<DashboardActivityQuickArrival {...BASE_PROPS} />);

    expect(screen.getByRole("button", { name: "activity.quickArrival.ariaLabel" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the quick-arrival modal from the row and records which list it came from", async () => {
    render(<DashboardActivityQuickArrival {...BASE_PROPS} />);

    await userEvent.click(screen.getByRole("button", { name: "activity.quickArrival.ariaLabel" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(captureMock).toHaveBeenCalledWith(
      "delivery_quick_arrival_opened",
      expect.objectContaining({ order_id: "order-1", source: "dashboard_activity", list: "overdue" }),
    );
  });

  it("logs the arrival through the shared action and refreshes the dashboard", async () => {
    render(<DashboardActivityQuickArrival {...BASE_PROPS} />);

    await userEvent.click(screen.getByRole("button", { name: "activity.quickArrival.ariaLabel" }));
    await userEvent.click(screen.getByRole("button", { name: "detail.quickArrival.confirm" }));

    expect(quickArrivalActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", productIds: ["item-1"], cost: 0, shippedDate: null }),
    );
    // Server-derived lists: the row disappears on refresh rather than being patched locally.
    expect(refreshMock).toHaveBeenCalled();
    expect(addToastMock).toHaveBeenCalledWith(
      "detail.quickArrival.toast.success",
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("surfaces a refusal as an error toast and does not refresh", async () => {
    quickArrivalActionMock.mockResolvedValue({ ok: false, error: "PRODUCT_NOT_ELIGIBLE" });
    render(<DashboardActivityQuickArrival {...BASE_PROPS} />);

    await userEvent.click(screen.getByRole("button", { name: "activity.quickArrival.ariaLabel" }));
    await userEvent.click(screen.getByRole("button", { name: "detail.quickArrival.confirm" }));

    expect(addToastMock).toHaveBeenCalledWith(
      "detail.quickArrival.error.PRODUCT_NOT_ELIGIBLE",
      expect.objectContaining({ variant: "error" }),
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
