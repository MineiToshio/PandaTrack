import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps, ReactNode } from "react";
import { ToastProvider } from "@/contexts/ToastContext";
import type { PendingProductRow, PendingProductsByStoreGroup } from "@/lib/data/orders/pendingProductsByStoreQueries";
import { utcMidnightToday } from "@/test/domainDateFixtures";
import StoreGroupedView from "../StoreGroupedView";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = (key: string, vars?: Record<string, unknown>) => {
      if (!vars) return key;
      return `${key}:${JSON.stringify(vars)}`;
    };
    // The coordinator probes `t.has(...)` before falling back to the generic error copy.
    translate.has = () => true;
    return translate;
  },
}));
vi.mock("@/components/core/ViewTransitionLink", () => ({
  default: ({ children, ...props }: { children?: ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock("@/components/core/StoreAvatar", () => ({ default: () => <span data-testid="store-avatar" /> }));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("../../_actions/orderItemActions", () => ({
  setOrderItemArrivedAction: vi.fn().mockResolvedValue({ ok: true }),
}));
const { createStorePaymentActionMock, storeArrivalActionMock, capturedSubmitRef } = vi.hoisted(() => ({
  createStorePaymentActionMock: vi
    .fn()
    .mockResolvedValue({ ok: true, paymentId: "payment-1", currencyCode: "PEN", affectedOrders: [] }),
  storeArrivalActionMock: vi
    .fn()
    .mockResolvedValue({ ok: true, deliveryId: "delivery-1", productCount: 1, orderCount: 1 }),
  capturedSubmitRef: { current: null as ((input: unknown) => Promise<unknown> | void) | null },
}));

vi.mock("@/app/[locale]/(app)/_actions/storePaymentActions", () => ({
  getStorePaymentSheetOrdersAction: vi.fn().mockResolvedValue({ ok: true, orders: [] }),
  createStorePaymentAction: (...args: unknown[]) => createStorePaymentActionMock(...args),
}));
vi.mock("@/app/[locale]/(app)/_actions/storeArrivalAction", () => ({
  storeArrivalAction: (...args: unknown[]) => storeArrivalActionMock(...args),
}));

// The sheet itself is not under test here; its submit handler is. The hook stays real so the
// coordinator's own `invalidate` wiring keeps working.
vi.mock("@/components/modules/StorePaymentSheet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/modules/StorePaymentSheet")>()),
  StorePaymentSheet: (props: { onSubmit: (input: unknown) => void }) => {
    capturedSubmitRef.current = props.onSubmit;
    return null;
  },
}));

function renderView(
  props: Partial<ComponentProps<typeof StoreGroupedView>> & { groups: PendingProductsByStoreGroup[] },
) {
  return render(
    <ToastProvider>
      <StoreGroupedView
        locale="es"
        returnTo="/es/orders?view=store"
        baseCurrencyCode="PEN"
        storeSort="arrival-asc"
        today={utcMidnightToday()}
        {...props}
      />
    </ToastProvider>,
  );
}

function makeProduct(overrides: Partial<PendingProductRow> = {}): PendingProductRow {
  return {
    itemId: "item-1",
    name: "One Piece Vol. 1",
    quantity: 1,
    deliveryState: "open",
    unitPrice: 5000,
    allocatedMinor: 0,
    paidDeclared: false,
    orderId: "order-1",
    orderHumanReadableId: "PED-001",
    orderDate: new Date("2026-01-05T00:00:00.000Z"),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    orderAllocatedAmountMinor: 0,
    orderHasUndetailedMoney: false,
    orderTotalCost: 5000,
    orderItemCount: 1,
    currencyCode: "PEN",
    basePagableMinor: 5000,
    ...overrides,
  };
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
      makeProduct(),
      makeProduct({
        itemId: "item-2",
        name: "One Piece Vol. 2",
        unitPrice: null,
        paidDeclared: true,
        orderId: "order-2",
        orderHumanReadableId: "PED-002",
        orderDate: new Date("2026-01-10T00:00:00.000Z"),
        orderAllocatedAmountMinor: 0,
        orderTotalCost: 3000,
        orderItemCount: 2,
        basePagableMinor: null,
      }),
    ],
    debts: [{ currencyCode: "PEN", debtMinor: 5000 }],
    undetailedByOrder: [],
    ...overrides,
  };
}

const tileName = (name: string) => `storeView.selection.itemAriaLabel:${JSON.stringify({ name })}`;
const masterName = (store: string) => `storeView.selection.selectAllAriaLabel:${JSON.stringify({ store })}`;

/**
 * The desktop row's tile. Both trees render in jsdom, and the mobile card mounts a second tile for
 * the same product once its group is in select mode, so this takes the first (the desktop row).
 */
function tile(name: string): HTMLInputElement {
  return screen.getAllByRole("checkbox", { name: tileName(name) })[0] as HTMLInputElement;
}

function selectProduct(name: string, options: { shiftKey?: boolean } = {}) {
  const input = tile(name);
  fireEvent.mouseDown(input.closest("label") as HTMLElement, { shiftKey: options.shiftKey ?? false });
  fireEvent.click(input);
}

function storeHeadingOrder(): string[] {
  return screen.getAllByTestId("store-avatar").map((avatar) => {
    const header = avatar.closest("section") as HTMLElement;
    return header.querySelector("p")?.textContent ?? "";
  });
}

describe("StoreGroupedView", () => {
  it("renders a group header with the store name and every pending product expanded by default", () => {
    renderView({ groups: [makeGroup()] });

    expect(screen.getByText("Akiba Books")).toBeInTheDocument();
    expect(screen.getAllByText("One Piece Vol. 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("One Piece Vol. 2").length).toBeGreaterThan(0);
  });

  it("shows a price for a product with a base amount and an 'add price' link when there is none", () => {
    renderView({ groups: [makeGroup()] });

    expect(screen.getAllByText("storeView.addPrice").length).toBeGreaterThan(0);
  });

  it("announces the collector's own mark on a product whose order still owes money", () => {
    // This used to read the dead `settlesTarget` flag, so the chip it asserted had never rendered
    // for anybody. The source of truth is now the collector's own mark on the product.
    renderView({ groups: [makeGroup()] });

    expect(screen.getAllByText("marked").length).toBeGreaterThan(0);
  });

  it("settles every product of a fully paid order from the order's own arithmetic", () => {
    const group = makeGroup();
    renderView({
      groups: [
        {
          ...group,
          pendingProducts: group.pendingProducts.map((product) => ({
            ...product,
            orderAllocatedAmountMinor: product.orderTotalCost,
          })),
        },
      ],
    });

    expect(screen.getAllByText("storeView.settled").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("marked")).toHaveLength(0);
  });

  it("collapses the group body when its chevron is toggled", () => {
    renderView({ groups: [makeGroup()] });

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
    renderView({ groups: [makeGroup(), groupB] });

    expect(screen.getByText("Akiba Books")).toBeInTheDocument();
    expect(screen.getByText("Manga Corner")).toBeInTheDocument();
  });

  it("tells the sheet a rejected payment action was UNANSWERED, not a verdict (GRAVE 1)", async () => {
    // The second of the two coordinators. It absorbs the rejection into a RESOLVED outcome on
    // purpose (a `catch` chained after the success handler would roll a committed payment back off
    // the screen), so this flag is the only thing that keeps a dropped connection from reading as a
    // refusal the server described and shutting the CTA.
    createStorePaymentActionMock.mockReturnValueOnce(Promise.reject(new Error("network down")));
    renderView({ groups: [makeGroup()] });

    // The handler refuses to do anything until a group has claimed the sheet.
    fireEvent.click(screen.getByRole("button", { name: "storeView.registerPayment" }));

    const outcome = capturedSubmitRef.current?.({
      amount: 1000,
      paymentDate: new Date("2026-01-05T00:00:00.000Z"),
      currencyCode: "PEN",
      note: null,
      allocations: [{ orderId: "order-1", amountMinor: 1000 }],
    });

    await expect(outcome).resolves.toEqual({ ok: false, error: "server_error", unanswered: true });
  });

  it("drops the per-product ratio in the same tick the payment leaves money undesglosada (D7)", async () => {
    // The optimistic patch moved `allocatedMinor` and nothing else, so for the length of the round
    // trip the row repainted exactly the percentage ADR 0028 §6 suppresses: with the order also
    // holding money that names no product, this product's own share is a FLOOR, and 2.000 of a
    // 5.000 price is not "40% paid" — it is at least 2.000 paid.
    const group = makeGroup({
      pendingProducts: [makeProduct({ orderTotalCost: 10000, orderAllocatedAmountMinor: 0 })],
    });
    renderView({ groups: [group] });

    fireEvent.click(screen.getByRole("button", { name: "storeView.registerPayment" }));

    await act(async () => {
      await capturedSubmitRef.current?.({
        amount: 5000,
        paymentDate: new Date("2026-01-05T00:00:00.000Z"),
        currencyCode: "PEN",
        note: null,
        // What a breakdown writes: one product line plus the order-level remainder.
        allocations: [
          { orderId: "order-1", orderItemId: "item-1", amountMinor: 2000 },
          { orderId: "order-1", amountMinor: 3000 },
        ],
      });
    });

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryAllByText(/card\.paymentPercentage/)).toHaveLength(0);
    // The figure itself, which is what the state says instead of a ratio.
    expect(screen.getAllByText(/detail\.payments\.declaredAgainst/).length).toBeGreaterThan(0);
  });

  describe("undetailed money (FR-05-51)", () => {
    const UNDETAILED = [
      { orderId: "order-1", humanReadableId: "ORD-20260305-01", amountMinor: 19990, currencyCode: "PEN" },
      { orderId: "order-2", humanReadableId: "ORD-20260703-01", amountMinor: 12940, currencyCode: "PEN" },
    ];

    function triggers(): HTMLElement[] {
      return screen.queryAllByRole("button", { name: /storeView\.undetailed\.triggerAria/ });
    }

    it("offers nothing at all when the store holds no money that names a product (the 8 of 10 case)", () => {
      // Every fixture in this file shipped with `undetailedByOrder: []`, so until now NOTHING in the
      // suite could tell "renders when there is something" from "renders always". Real data: 2 of 10
      // store groups have such money, so the eight that do not are the case the condition is FOR.
      renderView({ groups: [makeGroup()] });

      expect(triggers()).toHaveLength(0);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("names the number of orders and shows the list to nobody until it is asked for", () => {
      renderView({ groups: [makeGroup({ undetailedByOrder: UNDETAILED })] });

      // The count is the ORDERS carrying such money, and it comes off the list itself.
      expect(screen.getAllByText(`storeView.undetailed.trigger:${JSON.stringify({ count: 2 })}`).length).toBe(2);
      // The whole point of the change: no line of this list is on screen before a click. It used to
      // sit permanently at the foot of every group that had one.
      expect(screen.queryByText("ORD-20260305-01")).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("mounts one trigger per breakpoint, so exactly one is ever visible, and the touch one clears 44px", () => {
      // The owner's placement (between "Registrar pago" and "Ver tienda") is a DESKTOP layout: that
      // cluster is already ~278px against the ~252-307px a phone leaves inside the card, so a fourth
      // labelled control does not fit at any phone width. The touch slot is the identity block's
      // money line instead. jsdom has no layout engine, so what is pinned here is the MECHANISM.
      renderView({ groups: [makeGroup({ undetailedByOrder: UNDETAILED })] });

      const [touch, desktop] = triggers().sort((a, b) =>
        a.className.includes("md:hidden") ? -1 : b.className.includes("md:hidden") ? 1 : 0,
      );
      const tokens = (element: HTMLElement) => element.className.split(/\s+/).filter(Boolean);

      expect(tokens(touch), "touch slot must drop out from md: up").toContain("md:hidden");
      expect(tokens(desktop), "desktop slot must be hidden below md:").toContain("hidden");
      expect(tokens(desktop)).toContain("md:inline-flex");
      // `Button size="sm"` is `min-h-8` (32px). The touch slot is RESIZED to the 44px floor rather
      // than expanded with a pseudo, because its neighbours here are the debt figure and the wrapped
      // row above (`docs/design/interface-patterns.md` §12).
      expect(tokens(touch), "touch slot under the 44px floor").toContain("min-h-11");
      expect(tokens(touch)).not.toContain("min-h-8");
    });

    it("opens a dialog listing one line per order, each linking to that order", () => {
      renderView({ groups: [makeGroup({ undetailedByOrder: UNDETAILED })] });

      fireEvent.click(triggers()[0]);

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("storeView.undetailed.hint")).toBeInTheDocument();
      const links = within(dialog).getAllByRole("link");
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAttribute(
        "href",
        `/es/orders/order-1?returnTo=${encodeURIComponent("/es/orders?view=store")}`,
      );
      expect(within(dialog).getByText("ORD-20260305-01")).toBeInTheDocument();
      // The amount is NAMED per order, never spread across the group's products.
      expect(within(dialog).getByText("S/ 199.90 PEN")).toBeInTheDocument();
      expect(within(dialog).getByText("S/ 129.40 PEN")).toBeInTheDocument();
    });

    it("dismisses itself on the way out to an order instead of painting over the transition", () => {
      renderView({ groups: [makeGroup({ undetailedByOrder: UNDETAILED })] });

      fireEvent.click(triggers()[0]);
      const dialog = screen.getByRole("dialog");
      fireEvent.click(within(dialog).getAllByRole("link")[0]);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("product selection", () => {
    it("gives every eligible product a real checkbox named after it, and none to one already in transit", () => {
      renderView({
        groups: [
          makeGroup({
            pendingProducts: [
              makeProduct(),
              makeProduct({ itemId: "item-2", name: "Shipped", deliveryState: "in_transit" }),
            ],
          }),
        ],
      });

      expect(tile("One Piece Vol. 1")).toBeInstanceOf(HTMLInputElement);
      expect(tile("One Piece Vol. 1").type).toBe("checkbox");
      expect(screen.queryByRole("checkbox", { name: tileName("Shipped") })).not.toBeInTheDocument();
    });

    it("mounts the action bar only once something is marked, and names the count", () => {
      renderView({ groups: [makeGroup()] });

      expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();

      selectProduct("One Piece Vol. 1");

      expect(screen.getByRole("toolbar")).toBeInTheDocument();
      expect(
        screen.getByText(`storeView.selection.countSingleOrder:${JSON.stringify({ count: 1 })}`),
      ).toBeInTheDocument();
    });

    /**
     * jsdom has no layout engine, so the pixel truncation this guards against can only be measured
     * in a browser. What it CAN hold is the mechanism that makes the count readable: the bar's row
     * is allowed to break, and the count carries a width floor wide enough for the widest string
     * the ICU message can produce. Measured off the shipped Inter subset at `--text-caption` (13px,
     * weight 400): "1024 productos de 999 pedidos" = 196px, against 208px of floor. The bar had
     * `truncate` and no floor, which rendered "1 producto seleccionado" as "1 produ…" at 375px.
     */
    it("never lets the count be clipped: the row may break and the count has a floor wide enough for it", () => {
      renderView({ groups: [makeGroup()] });
      selectProduct("One Piece Vol. 1");

      const toolbar = screen.getByRole("toolbar");
      const summary = screen.getByText(`storeView.selection.countSingleOrder:${JSON.stringify({ count: 1 })}`);

      expect(toolbar.className).toMatch(/(?:^|\s)flex-wrap(?:\s|$)/);
      expect(summary.className).not.toMatch(/(?:^|\s)(?:truncate|text-ellipsis|whitespace-nowrap)(?:\s|$)/);

      const basis = summary.className.match(/flex-\[1_1_([\d.]+)rem\]/);
      expect(basis, `no flex basis floor on the count: ${summary.className}`).not.toBeNull();
      expect(Number(basis?.[1]) * 16).toBeGreaterThanOrEqual(196);
    });

    it("counts the orders the selection spans once it crosses more than one", () => {
      renderView({ groups: [makeGroup()] });

      selectProduct("One Piece Vol. 1");
      selectProduct("One Piece Vol. 2");

      expect(
        screen.getByText(`storeView.selection.count:${JSON.stringify({ count: 2, orders: 2 })}`),
      ).toBeInTheDocument();
    });

    it("extends the range on Shift + click, skipping what is not eligible", () => {
      renderView({
        groups: [
          makeGroup({
            pendingProducts: [
              makeProduct({ itemId: "a", name: "A" }),
              makeProduct({ itemId: "b", name: "B", deliveryState: "in_transit" }),
              makeProduct({ itemId: "c", name: "C" }),
              makeProduct({ itemId: "d", name: "D" }),
            ],
          }),
        ],
      });

      selectProduct("A");
      selectProduct("D", { shiftKey: true });

      // A, C and D: three products, and B is not in the range because it never was eligible.
      expect(
        screen.getByText(`storeView.selection.countSingleOrder:${JSON.stringify({ count: 3 })}`),
      ).toBeInTheDocument();
      expect(tile("C").checked).toBe(true);
    });

    it("marks every eligible product from the master checkbox, and skips the ones in transit", () => {
      renderView({
        groups: [
          makeGroup({
            pendingProducts: [
              makeProduct(),
              makeProduct({ itemId: "item-2", name: "Shipped", deliveryState: "in_transit" }),
            ],
          }),
        ],
      });

      fireEvent.click(screen.getByRole("checkbox", { name: masterName("Akiba Books") }));

      expect(
        screen.getByText(`storeView.selection.countSingleOrder:${JSON.stringify({ count: 1 })}`),
      ).toBeInTheDocument();
    });

    it("clears the selection on Escape inside the group", () => {
      renderView({ groups: [makeGroup()] });

      selectProduct("One Piece Vol. 1");
      expect(screen.getByRole("toolbar")).toBeInTheDocument();

      fireEvent.keyDown(tile("One Piece Vol. 1"), { key: "Escape" });

      expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    });

    it("drops the selection when its group is collapsed out of sight", () => {
      renderView({ groups: [makeGroup()] });

      selectProduct("One Piece Vol. 1");
      fireEvent.click(screen.getByRole("button", { name: "card.collapse" }));
      fireEvent.click(screen.getByRole("button", { name: "card.expand" }));

      expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    });
  });

  describe("server resync", () => {
    it("re-reads the groups when a product only changed its delivery state (G2)", () => {
      // The query calls anything not-yet-delivered "pending", so a product that moved to
      // `IN_TRANSIT` keeps its id, its `allocatedMinor` and its `settled`. Without `deliveryState`
      // in the signature the effect never fires, and the view keeps offering a tile for a product
      // the mutation will refuse.
      const before = makeGroup({ pendingProducts: [makeProduct()] });
      const { rerender } = renderView({ groups: [before] });

      expect(tile("One Piece Vol. 1")).toBeInTheDocument();

      const after = makeGroup({ pendingProducts: [makeProduct({ deliveryState: "in_transit" })] });
      rerender(
        <ToastProvider>
          <StoreGroupedView
            groups={[after]}
            locale="es"
            returnTo="/es/orders?view=store"
            baseCurrencyCode="PEN"
            storeSort="arrival-asc"
            today={utcMidnightToday()}
          />
        </ToastProvider>,
      );

      expect(screen.queryByRole("checkbox", { name: tileName("One Piece Vol. 1") })).not.toBeInTheDocument();
    });

    it("prunes a marked product that the server no longer allows into a delivery (G1)", () => {
      const { rerender } = renderView({ groups: [makeGroup()] });

      selectProduct("One Piece Vol. 1");
      selectProduct("One Piece Vol. 2");
      expect(
        screen.getByText(`storeView.selection.count:${JSON.stringify({ count: 2, orders: 2 })}`),
      ).toBeInTheDocument();

      const after = makeGroup({
        pendingProducts: [makeProduct({ deliveryState: "in_transit" }), makeGroup().pendingProducts[1]],
      });
      rerender(
        <ToastProvider>
          <StoreGroupedView
            groups={[after]}
            locale="es"
            returnTo="/es/orders?view=store"
            baseCurrencyCode="PEN"
            storeSort="arrival-asc"
            today={utcMidnightToday()}
          />
        </ToastProvider>,
      );

      // Only "Vol. 2" survives. Without the prune the ineligible product stays in the set (it is
      // still a pending row), the batch is refused, and no checkbox on screen can un-mark it.
      expect(
        screen.getByText(`storeView.selection.countSingleOrder:${JSON.stringify({ count: 1 })}`),
      ).toBeInTheDocument();
    });
  });

  describe("store-scoped arrival", () => {
    function twoStores(): PendingProductsByStoreGroup[] {
      return [
        makeGroup({
          pendingProducts: [
            makeProduct({ itemId: "a", name: "Soonest", expectedDeliveryTo: new Date("2026-01-01T00:00:00.000Z") }),
            makeProduct({
              itemId: "b",
              name: "Latest",
              orderId: "order-2",
              expectedDeliveryTo: new Date("2026-03-01T00:00:00.000Z"),
            }),
          ],
        }),
        makeGroup({
          store: {
            id: "store-2",
            slug: "manga-corner",
            name: "Manga Corner",
            logoUrl: null,
            sellerType: "PERSON",
            status: "APPROVED",
          },
          openOrdersCount: 1,
          debts: [],
          pendingProducts: [
            makeProduct({ itemId: "c", name: "Middle", expectedDeliveryTo: new Date("2026-02-01T00:00:00.000Z") }),
          ],
        }),
      ];
    }

    async function confirmArrival() {
      fireEvent.click(
        screen.getByRole("button", { name: 'storeView.selection.storeArrivalAriaLabel:{"store":"Akiba Books"}' }),
      );
      // The modal's own primary action; it dismisses synchronously (Optimistic Confirmation).
      fireEvent.click(await screen.findByRole("button", { name: /detail\.quickArrival\.confirmCount/ }));
    }

    it("never re-opens the dialog on its own after a resync emptied the selection (MEDIO 1)", async () => {
      const beta = makeProduct({ itemId: "b", name: "Beta", orderId: "order-2", orderHumanReadableId: "PED-002" });
      const { rerender } = renderView({
        groups: [makeGroup({ pendingProducts: [makeProduct({ itemId: "a", name: "Alpha" }), beta] })],
      });

      selectProduct("Alpha");
      fireEvent.click(
        screen.getByRole("button", { name: 'storeView.selection.storeArrivalAriaLabel:{"store":"Akiba Books"}' }),
      );
      expect(await screen.findByRole("dialog")).toBeInTheDocument();

      // A resync in which the only marked product is gone (a delivery logged in another tab). The
      // prune leaves nothing, so the dialog UNMOUNTS on its own — the flag that opened it does not.
      rerender(
        <ToastProvider>
          <StoreGroupedView
            groups={[makeGroup({ pendingProducts: [beta] })]}
            locale="es"
            returnTo="/es/orders?view=store"
            baseCurrencyCode="PEN"
            storeSort="arrival-asc"
            today={utcMidnightToday()}
          />
        </ToastProvider>,
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // Marking ANY other product must not bring it back: nobody pressed "Ya me llegó", and the
      // dialog's primary writes a delivery that has no undo.
      selectProduct("Beta");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("toolbar")).toBeInTheDocument();
    });

    it("re-sorts the groups after the optimistic removal changes a store's sort key (G3)", async () => {
      renderView({ groups: twoStores() });

      expect(storeHeadingOrder()).toEqual(["Akiba Books", "Manga Corner"]);

      selectProduct("Soonest");
      await confirmArrival();

      // Akiba's soonest arrival left with the delivery, so its key is now March and it ranks after
      // Manga Corner's February. Without re-sorting, the whole list jumps when the server answers.
      await waitFor(() => expect(storeHeadingOrder()).toEqual(["Manga Corner", "Akiba Books"]));
    });

    it("removes the marked products and recomputes the group's open-order count", async () => {
      renderView({ groups: twoStores() });

      selectProduct("Soonest");
      await confirmArrival();

      await waitFor(() => expect(screen.queryByText("Soonest")).not.toBeInTheDocument());
      // One order left contributing a pending product, down from two. Read off Akiba's own header,
      // because the second store legitimately shows the same 1/1 summary.
      const akibaHeader = screen.getByText("Akiba Books").closest("div")?.parentElement as HTMLElement;
      expect(akibaHeader.textContent).toContain(`storeView.orderSummary:${JSON.stringify({ orders: 1, products: 1 })}`);
    });

    it("sends the store id and the marked products, never the whole group", async () => {
      renderView({ groups: twoStores() });

      selectProduct("Soonest");
      await confirmArrival();

      await waitFor(() => expect(storeArrivalActionMock).toHaveBeenCalled());
      const input = storeArrivalActionMock.mock.calls.at(-1)?.[0] as { storeId: string; productIds: string[] };
      expect(input.storeId).toBe("store-1");
      expect(input.productIds).toEqual(["a"]);
    });

    it("renders its own empty state when the last group leaves the list", async () => {
      renderView({
        groups: [makeGroup({ pendingProducts: [makeProduct({ itemId: "a", name: "Only one" })], debts: [] })],
      });

      selectProduct("Only one");
      await confirmArrival();

      // The server component's empty state is unreachable from the client, so this view owns one.
      await waitFor(() => expect(screen.getByText("storeView.empty.title")).toBeInTheDocument());
    });

    it("says the store left the list still owing money", async () => {
      renderView({
        groups: [
          makeGroup({
            pendingProducts: [makeProduct({ itemId: "a", name: "Only one" })],
            debts: [{ currencyCode: "PEN", debtMinor: 199000 }],
          }),
        ],
      });

      selectProduct("Only one");
      await confirmArrival();

      // The group is a pending-product group, so it vanishes with its debt figure AND its
      // "Registrar pago" button. Said once, where it happens.
      await waitFor(() => expect(screen.getByText(/^toast\.successStoreLeft:/)).toBeInTheDocument());
    });

    it("keeps the plain success copy while the store stays on the list", async () => {
      renderView({ groups: twoStores() });

      selectProduct("Soonest");
      await confirmArrival();

      await waitFor(() => expect(screen.getByText(/^toast\.success:/)).toBeInTheDocument());
    });

    it("restores the rows AND the selection when the server refuses the batch", async () => {
      storeArrivalActionMock.mockResolvedValueOnce({ ok: false, error: "STORE_NOT_FOUND" });
      renderView({ groups: twoStores() });

      selectProduct("Soonest");
      selectProduct("Latest");
      await confirmArrival();

      // Rolled back with the marks intact, so a retry costs no re-marking.
      await waitFor(() => expect(screen.getAllByText("Soonest").length).toBeGreaterThan(0));
      expect(
        screen.getByText(`storeView.selection.count:${JSON.stringify({ count: 2, orders: 2 })}`),
      ).toBeInTheDocument();
    });

    it("drops the named ineligible products from the restored selection and flags their rows", async () => {
      storeArrivalActionMock.mockResolvedValueOnce({
        ok: false,
        error: "PRODUCT_NOT_ELIGIBLE",
        ineligibleProductIds: ["a"],
      });
      renderView({ groups: twoStores() });

      selectProduct("Soonest");
      selectProduct("Latest");
      await confirmArrival();

      await waitFor(() =>
        expect(
          screen.getByText(`storeView.selection.countSingleOrder:${JSON.stringify({ count: 1 })}`),
        ).toBeInTheDocument(),
      );
      expect(screen.getAllByText("storeView.selection.ineligibleRow").length).toBeGreaterThan(0);
    });

    it("does NOT restore the selection when the refusal names nothing (the CAS race)", async () => {
      // `createDelivery`'s compare-and-swap branch returns a bare `PRODUCT_NOT_ELIGIBLE`. Handing
      // the same set back would fail identically on every retry, and nothing on screen says which
      // tile to clear, so the selection goes and the copy asks for a reload instead.
      storeArrivalActionMock.mockResolvedValueOnce({ ok: false, error: "PRODUCT_NOT_ELIGIBLE" });
      renderView({ groups: twoStores() });

      selectProduct("Soonest");
      await confirmArrival();

      await waitFor(() => expect(screen.getAllByText("Soonest").length).toBeGreaterThan(0));
      expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    });

    it("rolls back and keeps the selection when the promise itself rejects", async () => {
      // `mockImplementationOnce`, not `mockReturnValueOnce`: a rejected promise built at setup time
      // sits unhandled across the awaits before the action is called, and Vitest reports that as an
      // unhandled rejection even though the code under test does attach a handler.
      storeArrivalActionMock.mockImplementationOnce(() => Promise.reject(new Error("network down")));
      renderView({ groups: twoStores() });

      selectProduct("Soonest");
      await confirmArrival();

      await waitFor(() => expect(screen.getAllByText("Soonest").length).toBeGreaterThan(0));
      expect(screen.getByRole("toolbar")).toBeInTheDocument();
    });

    it("puts no count in the dialog's subtitle, where it could not stay true", async () => {
      // Unchecking a row inside the dialog moves the dialog's own state and never this view's
      // selection (that isolation is what keeps an id from leaking back into the batch), so a count
      // composed out here freezes at whatever the dialog opened with while the list and the primary
      // keep counting. The subtitle names the store; the live sources own the number.
      renderView({ groups: twoStores() });

      selectProduct("Soonest");
      fireEvent.click(
        screen.getByRole("button", { name: 'storeView.selection.storeArrivalAriaLabel:{"store":"Akiba Books"}' }),
      );

      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText("Akiba Books")).toBeInTheDocument();
      expect(within(dialog).queryByText(/storeView\.selection\.count/)).not.toBeInTheDocument();
    });

    it("tells a cancelled order in a BATCH apart from the per-order refusal (MEDIO 2)", async () => {
      // `createDelivery` answers `ORDER_CANCELLED`, whose copy is "Este pedido está cancelado." —
      // a sentence that names nothing when the batch spans several orders of the store. The
      // selection-scoped key is the one that says which fact holds and what to do about it.
      storeArrivalActionMock.mockResolvedValueOnce({ ok: false, error: "ORDER_CANCELLED" });
      renderView({ groups: twoStores() });

      selectProduct("Soonest");
      selectProduct("Latest");
      await confirmArrival();

      await waitFor(() => expect(screen.getByText("error.SELECTION_ORDER_CANCELLED")).toBeInTheDocument());
      expect(screen.queryByText("error.ORDER_CANCELLED")).not.toBeInTheDocument();
    });

    it("emits a code that HAS copy in both locales, which the stubbed translator cannot prove", () => {
      // This file's `useTranslations` mock answers every key with itself and `t.has()` with `true`,
      // so the assertion above would pass just as happily on a key that exists nowhere. The catalogs
      // on disk are the only thing that can tell the mapping from a typo.
      for (const locale of ["es", "en"]) {
        const catalog = JSON.parse(
          readFileSync(join(process.cwd(), "src", "i18n", "locales", locale, "orders.json"), "utf8"),
        ) as { detail: { quickArrival: { error: Record<string, string> } } };
        const copy = catalog.detail.quickArrival.error.SELECTION_ORDER_CANCELLED;

        expect(copy, `${locale}: orders.detail.quickArrival.error.SELECTION_ORDER_CANCELLED`).toBeTruthy();
        expect(copy).not.toBe(catalog.detail.quickArrival.error.ORDER_CANCELLED);
      }
    });

    it("never moves the store's debt figure: an arrival is not a payment", async () => {
      renderView({ groups: twoStores() });
      const before = screen.getAllByText(/storeView\.debtAmount/)[0].textContent;

      selectProduct("Soonest");
      await confirmArrival();

      await waitFor(() => expect(screen.queryByText("Soonest")).not.toBeInTheDocument());
      expect(screen.getAllByText(/storeView\.debtAmount/)[0].textContent).toBe(before);
    });
  });
});
