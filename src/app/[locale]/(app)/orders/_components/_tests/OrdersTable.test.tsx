import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { OrdersListPageItem } from "@/lib/data/orders/orderQueries";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) => {
    if (key === "table.arrivalArrives") return `llega ${vars?.window}`;
    if (key === "table.arrivalExpected") return `esperada ${vars?.window}`;
    return key;
  },
}));
vi.mock("@/components/core/ViewTransitionLink", () => ({
  default: ({ children, ...props }: { children?: ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock("@/components/core/StoreAvatar", () => ({ default: () => <span /> }));
const rowActionsProps = vi.fn();
vi.mock("../OrderListRowActions", () => ({
  default: (props: Record<string, unknown>) => {
    rowActionsProps(props);
    return <div data-testid="row-actions" />;
  },
}));

import OrdersTable from "../OrdersTable";

const TODAY = new Date("2026-08-06T00:00:00.000Z");

function makeOrder(overrides: Partial<OrdersListPageItem> = {}): OrdersListPageItem {
  return {
    id: "o1",
    humanReadableId: "ORD-20260726-01",
    orderDate: new Date("2026-07-26T00:00:00.000Z"),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    currencyCode: "PEN",
    exchangeRate: null,
    totalCost: 10000,
    status: "OPEN",
    store: {
      id: "s1",
      name: "Pop Dealer Store",
      slug: "pop-dealer",
      status: "APPROVED",
      removalReason: null,
      logoUrl: null,
    },
    itemCount: 1,
    items: [],
    paidAmount: 0,
    paymentPercentage: 0,
    hasUnpaidBalance: true,
    ...overrides,
  } as OrdersListPageItem;
}

function renderTable(order: OrdersListPageItem) {
  return render(
    <OrdersTable
      orders={[order]}
      locale="es"
      today={TODAY}
      returnTo="/es/orders"
      baseCurrencyCode="PEN"
      expandedIds={new Set()}
      onToggle={() => {}}
    />,
  );
}

describe("OrdersTable expected arrival column", () => {
  it("renders a same-month window compactly", () => {
    renderTable(
      makeOrder({
        expectedDeliveryFrom: new Date("2026-08-15T00:00:00.000Z"),
        expectedDeliveryTo: new Date("2026-08-22T00:00:00.000Z"),
      }),
    );

    expect(screen.getByText("llega 15–22 ago")).toBeInTheDocument();
  });

  /**
   * Image intake writes both ends from a single stated date ("llega el 20"), so a degenerate
   * window is common in real data and must not render as "23–23 jul".
   */
  it("collapses a window whose ends are the same day into one date", () => {
    const day = new Date("2026-08-23T00:00:00.000Z");
    renderTable(makeOrder({ expectedDeliveryFrom: day, expectedDeliveryTo: day }));

    expect(screen.getByText("llega 23 ago")).toBeInTheDocument();
  });

  it("renders a single date when only one end of the window is known", () => {
    renderTable(makeOrder({ expectedDeliveryTo: new Date("2026-08-15T00:00:00.000Z") }));

    expect(screen.getByText("llega 15 ago")).toBeInTheDocument();
  });

  it("renders no arrival line at all when no window was ever set", () => {
    renderTable(makeOrder());

    expect(screen.queryByText(/llega|esperada/)).not.toBeInTheDocument();
  });

  /**
   * The verb has to change once the window has elapsed: "llega" in the future tense next to a past
   * date reads as a bug, and the cell would otherwise contradict the overdue chip beside it.
   */
  it("switches to the past-tense wording once the window has elapsed", () => {
    renderTable(makeOrder({ expectedDeliveryTo: new Date("2026-07-22T00:00:00.000Z") }));

    expect(screen.getByText("esperada 22 jul")).toBeInTheDocument();
    expect(screen.queryByText(/^llega/)).not.toBeInTheDocument();
  });

  /**
   * An open-ended window (`from` set, `to` null) used to match the "Entrega atrasada" filter and
   * count as overdue on the dashboard while the row's own chip stayed neutral. All three now ask
   * `resolveOrderArrivalDueDate`.
   */
  it("treats a window with only a start date as overdue once that start has passed", () => {
    renderTable(makeOrder({ expectedDeliveryFrom: new Date("2026-07-01T00:00:00.000Z") }));

    expect(screen.getByText("esperada 1 jul")).toBeInTheDocument();
  });

  it.each(["COMPLETED", "CANCELLED"] as const)("promises no arrival on a %s order", (status) => {
    renderTable(
      makeOrder({
        status,
        expectedDeliveryFrom: new Date("2026-09-15T00:00:00.000Z"),
        expectedDeliveryTo: new Date("2026-09-20T00:00:00.000Z"),
      }),
    );

    expect(screen.queryByText(/llega|esperada/)).not.toBeInTheDocument();
  });
});

describe("OrdersTable order identity", () => {
  it("shows the order date and no longer the order code", () => {
    renderTable(makeOrder());

    expect(screen.getByText("26 jul 2026")).toBeInTheDocument();
    expect(screen.queryByText(/ORD-/)).not.toBeInTheDocument();
  });

  /**
   * The row's accessible name has to disambiguate two rows from the same store. It used to do that
   * with the code; now that the code is not on screen, it uses the date the sighted user sees, so
   * both can refer to the same row the same way.
   */
  it("names the row by store and order date, matching what is visible", () => {
    renderTable(makeOrder());

    const row = screen.getByRole("link");
    expect(row).toHaveAttribute("aria-label", "Pop Dealer Store · 26 jul 2026");
  });
});

describe("OrdersTable layout", () => {
  /**
   * The arrival was briefly its own column. An eighth track squeezed every other column at laptop
   * and tablet widths (the payment cell wrapped onto two lines), and the value is null on many
   * orders, so it does not earn permanent horizontal space. It lives stacked in the store cell.
   */
  /**
   * The two dates share a line only where the cell is wide enough. Measured against the real
   * corpus: forcing the single line clips 14 rows at 1152px, 2 at 1230px and none from 1280px up,
   * so the switch sits at 1360px with headroom. The separator is hidden below it so it cannot
   * orphan at the start of a stacked line. Pinned because the failure mode is silent: `truncate`
   * cuts from the right, so a cell too narrow eats the arrival rather than showing it broken.
   */
  it("joins the dates on one line only from the measured breakpoint up", () => {
    const { container } = renderTable(makeOrder({ expectedDeliveryTo: new Date("2026-08-15T00:00:00.000Z") }));

    const dateLine = container.querySelector("div.flex-col");
    expect(dateLine?.className).toContain("[@media(min-width:1360px)]:flex-row");

    const separator = dateLine?.querySelector("span[aria-hidden]");
    expect(separator?.textContent).toBe("·");
    expect(separator?.className).toContain("hidden");
    expect(separator?.className).toContain("[@media(min-width:1360px)]:inline");
  });

  it("keeps the seven-track grid rather than spending a column on the arrival", () => {
    const { container } = renderTable(makeOrder({ expectedDeliveryTo: new Date("2026-08-15T00:00:00.000Z") }));

    const header = screen.getAllByRole("row")[0]!;
    expect(header.className).toContain("24px]");
    expect(header.className).not.toContain("minmax(0,0.95fr)_minmax(0,0.95fr)");
    // Still rendered, just not in a column of its own.
    expect(within(container).getByText("llega 15 ago")).toBeInTheDocument();
  });
});

describe("OrdersTable expanded products", () => {
  /**
   * The drawer used to render at most five products and then a plain `+ N más…` line that was not
   * a control: it announced hidden products and offered no way to reach them, while the row's own
   * Products column already printed the true total beside it. The mobile card had never capped, so
   * the same order showed five items on a monitor and all of them on a phone.
   */
  it("renders every product of an expanded order, however many there are", () => {
    const items: OrdersListPageItem["items"] = Array.from({ length: 8 }, (_, index) => ({
      id: `item-${index}`,
      name: `Producto ${index + 1}`,
      quantity: 1,
      productTypeKey: null,
      unitPrice: 1000,
      deliveryState: "NONE" as OrdersListPageItem["items"][number]["deliveryState"],
    }));

    render(
      <OrdersTable
        orders={[makeOrder({ items, itemCount: items.length })]}
        locale="es"
        today={TODAY}
        returnTo="/es/orders"
        baseCurrencyCode="PEN"
        expandedIds={new Set(["o1"])}
        onToggle={() => {}}
      />,
    );

    for (const item of items) {
      expect(screen.getByText(item.name)).toBeInTheDocument();
    }
    expect(screen.queryByText(/más…/)).not.toBeInTheDocument();
  });

  /**
   * The expand chevron lives in the row's first grid row, so a long drawer pushes it off screen.
   * The drawer carries its own collapse action, the way the mobile card already did.
   */
  it("hands the drawer a way to collapse the row it belongs to", () => {
    const onToggle = vi.fn();
    rowActionsProps.mockClear();
    render(
      <OrdersTable
        orders={[makeOrder()]}
        locale="es"
        today={TODAY}
        returnTo="/es/orders"
        baseCurrencyCode="PEN"
        expandedIds={new Set(["o1"])}
        onToggle={onToggle}
      />,
    );

    // Asserted through the prop rather than by clicking a button named "card.collapse": the expand
    // chevron carries that same label, so a query by name would pass with or without this wiring.
    const props = rowActionsProps.mock.calls.at(-1)?.[0] as { onCollapse?: () => void };
    expect(typeof props.onCollapse).toBe("function");
    props.onCollapse!();
    expect(onToggle).toHaveBeenCalledWith("o1");
  });
});
