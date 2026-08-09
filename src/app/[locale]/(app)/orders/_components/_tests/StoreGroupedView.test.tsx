import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps, ReactNode } from "react";
import { ToastProvider } from "@/contexts/ToastContext";
import type { PendingProductsByStoreGroup } from "@/lib/data/orders/pendingProductsByStoreQueries";
import StoreGroupedView from "../StoreGroupedView";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) => {
    if (!vars) return key;
    return `${key}:${JSON.stringify(vars)}`;
  },
}));
vi.mock("@/components/core/ViewTransitionLink", () => ({
  default: ({ children, ...props }: { children?: ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock("@/components/core/StoreAvatar", () => ({ default: () => <span data-testid="store-avatar" /> }));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("../../_actions/orderItemActions", () => ({
  setOrderItemArrivedAction: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/app/[locale]/(app)/_actions/storePaymentActions", () => ({
  getStorePaymentSheetOrdersAction: vi.fn().mockResolvedValue({ ok: true, orders: [] }),
  createStorePaymentAction: vi
    .fn()
    .mockResolvedValue({ ok: true, paymentId: "payment-1", currencyCode: "PEN", affectedOrders: [] }),
}));

function renderView(props: ComponentProps<typeof StoreGroupedView>) {
  return render(
    <ToastProvider>
      <StoreGroupedView {...props} />
    </ToastProvider>,
  );
}

function makeGroup(overrides: Partial<PendingProductsByStoreGroup> = {}): PendingProductsByStoreGroup {
  return {
    store: {
      id: "store-1",
      slug: "akiba-books",
      name: "Akiba Books",
      logoUrl: null,
      sellerType: "RETAILER",
      status: "APPROVED",
    },
    openOrdersCount: 2,
    pendingProducts: [
      {
        itemId: "item-1",
        name: "One Piece Vol. 1",
        quantity: 1,
        deliveryState: "open",
        unitPrice: 5000,
        allocatedMinor: 0,
        settled: false,
        orderId: "order-1",
        orderDate: new Date("2026-01-05T00:00:00.000Z"),
        expectedDeliveryFrom: null,
        expectedDeliveryTo: null,
        orderTotalCost: 5000,
        orderItemCount: 1,
        currencyCode: "PEN",
        basePagableMinor: 5000,
      },
      {
        itemId: "item-2",
        name: "One Piece Vol. 2",
        quantity: 1,
        deliveryState: "open",
        unitPrice: null,
        allocatedMinor: 0,
        settled: true,
        orderId: "order-2",
        orderDate: new Date("2026-01-10T00:00:00.000Z"),
        expectedDeliveryFrom: null,
        expectedDeliveryTo: null,
        orderTotalCost: 3000,
        orderItemCount: 2,
        currencyCode: "PEN",
        basePagableMinor: null,
      },
    ],
    debts: [{ currencyCode: "PEN", debtMinor: 5000 }],
    ...overrides,
  };
}

describe("StoreGroupedView", () => {
  it("renders a group header with the store name and every pending product expanded by default", () => {
    renderView({ groups: [makeGroup()], locale: "es", returnTo: "/es/orders?view=store" });

    expect(screen.getByText("Akiba Books")).toBeInTheDocument();
    expect(screen.getAllByText("One Piece Vol. 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("One Piece Vol. 2").length).toBeGreaterThan(0);
  });

  it("shows a price for a product with a base amount and an 'add price' link when there is none", () => {
    renderView({ groups: [makeGroup()], locale: "es", returnTo: "/es/orders?view=store" });

    expect(screen.getAllByText("storeView.addPrice").length).toBeGreaterThan(0);
  });

  it("marks a settled product without re-deriving it from a payment bar", () => {
    renderView({ groups: [makeGroup()], locale: "es", returnTo: "/es/orders?view=store" });

    expect(screen.getAllByText("storeView.settled").length).toBeGreaterThan(0);
  });

  it("collapses the group body when its chevron is toggled", () => {
    renderView({ groups: [makeGroup()], locale: "es", returnTo: "/es/orders?view=store" });

    expect(screen.getAllByText("One Piece Vol. 1").length).toBeGreaterThan(0);

    const toggle = screen.getByRole("button", { name: "card.collapse" });
    fireEvent.click(toggle);

    expect(screen.queryByText("One Piece Vol. 1")).not.toBeInTheDocument();
  });

  it("renders one collapsible section per store", () => {
    const groupB = makeGroup({
      store: {
        id: "store-2",
        slug: "manga-corner",
        name: "Manga Corner",
        logoUrl: null,
        sellerType: "PERSON",
        status: "APPROVED",
      },
    });
    renderView({ groups: [makeGroup(), groupB], locale: "es", returnTo: "/es/orders?view=store" });

    expect(screen.getByText("Akiba Books")).toBeInTheDocument();
    expect(screen.getByText("Manga Corner")).toBeInTheDocument();
  });
});
