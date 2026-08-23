import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { formatAmountSymbolOnly, formatAmountWithSymbol } from "@/lib/currency";
import type { PendingProductsByStoreGroup } from "@/lib/data/orders/pendingProductsByStoreQueries";
import StoreGroupHeader, { resolveDebtFigures } from "../StoreGroupHeader";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key);
    translate.has = () => true;
    return translate;
  },
}));
vi.mock("@/components/core/StoreAvatar", () => ({ default: () => <span data-testid="store-avatar" /> }));

type Debts = PendingProductsByStoreGroup["debts"];

function store(overrides: Partial<PendingProductsByStoreGroup["store"]> = {}) {
  return {
    id: "store-1",
    slug: "akiba-books",
    name: "Akiba Books",
    logoUrl: null,
    sellerType: "RETAILER" as const,
    status: "APPROVED" as const,
    ...overrides,
  };
}

function renderHeader(
  props: Partial<React.ComponentProps<typeof StoreGroupHeader>> & { debts?: Debts } = {},
): ReactNode {
  const { debts = [{ currencyCode: "PEN", debtMinor: 20000, openOrderDebtMinor: 20000 }], ...rest } = props;
  render(
    <StoreGroupHeader
      store={store()}
      pendingProductCount={20}
      overdueProductCount={0}
      debts={debts}
      locale="es"
      isExpanded={false}
      onToggleExpand={() => {}}
      {...rest}
    />,
  );
  return null;
}

describe("StoreGroupHeader", () => {
  describe("the summary line", () => {
    it("names how many products are late, not how many orders exist", () => {
      // The reason the group can afford to land closed (`FR-05-70`): the urgency inside it is
      // stated on the row itself, so the collector decides without opening anything.
      renderHeader({ pendingProductCount: 20, overdueProductCount: 15 });

      expect(
        screen.getByText(`storeView.overdueSummary:${JSON.stringify({ overdue: 15, total: 20 })}`),
      ).toBeInTheDocument();
    });

    it("falls back to the plain product count when nothing is late", () => {
      renderHeader({ pendingProductCount: 5, overdueProductCount: 0 });

      expect(screen.getByText(`storeView.productSummary:${JSON.stringify({ products: 5 })}`)).toBeInTheDocument();
      expect(screen.queryByText(/storeView\.overdueSummary/)).not.toBeInTheDocument();
    });
  });

  describe("the seller type", () => {
    it("says nothing at all for a shop, which is nine of the collector's ten stores", () => {
      renderHeader();

      expect(screen.queryByText("create.sellerTypeRetailer")).not.toBeInTheDocument();
    });

    it.each([
      ["PERSON" as const, "create.sellerTypePerson"],
      ["PROXY" as const, "create.sellerTypeProxy"],
    ])("keeps the %s deviation, and keeps it readable to a screen reader", (sellerType, label) => {
      // ADR 0006: the mark is a SHAPE, so it survives for a reader who cannot tell two tints apart,
      // and the word is still there for one who cannot see the shape either.
      renderHeader({ store: store({ sellerType }) });

      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  describe("the money column", () => {
    it("prints the figure alone in a single-currency store, with the word underneath", () => {
      renderHeader({ debts: [{ currencyCode: "PEN", debtMinor: 190400, openOrderDebtMinor: 190400 }] });

      expect(screen.getByText(formatAmountSymbolOnly(190400, "PEN", "es"))).toBeInTheDocument();
      expect(screen.getByText("storeView.pendingLabel")).toBeInTheDocument();
    });

    it("brings the currency code back only when the store mixes currencies", () => {
      // "S/" already IS PEN, and the suffix costs 29px on every line of the screen. It earns that
      // width exactly when the symbol alone stops being an answer.
      renderHeader({
        debts: [
          { currencyCode: "PEN", debtMinor: 120000, openOrderDebtMinor: 120000 },
          { currencyCode: "USD", debtMinor: 8400, openOrderDebtMinor: 8400 },
        ],
      });

      expect(screen.getByText(formatAmountWithSymbol(120000, "PEN", "es"))).toBeInTheDocument();
      expect(screen.getByText(formatAmountWithSymbol(8400, "USD", "es"))).toBeInTheDocument();
    });
  });

  it("is one disclosure control for the whole row, not a chevron beside other buttons", () => {
    renderHeader({ isExpanded: false });

    const toggle = screen.getByRole("button");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "store-group-body-store-1");
    // The store's identity is INSIDE the control, so the control announces which store it opens.
    expect(toggle.textContent).toContain("Akiba Books");
  });

  describe("the whole row is the target", () => {
    it("covers the row with an overlay instead of stopping at the identity block", () => {
      // It shipped once without this: the button's box ended at the text, so the card's own padding
      // and its chevron were dead pixels. Pressing the chevron, the thing that most looks like the
      // control, did nothing at all. jsdom has no layout engine, so the mechanism is what is pinned.
      renderHeader();

      const toggle = screen.getByRole("button");
      const tokens = toggle.className.split(/\s+/).filter(Boolean);
      expect(tokens).toContain("after:absolute");
      expect(tokens, "the overlay has to span the row, not the button's own box").toContain("after:inset-0");
    });

    it("anchors that overlay on the row, not on some ancestor further up", () => {
      // `inset-0` resolves against the nearest POSITIONED ancestor. Without `relative` on the row
      // the overlay escapes to whatever is positioned above it, which is a full-card, and silently
      // at that: nothing looks wrong, the wrong pixels just become clickable.
      renderHeader();

      const row = screen.getByRole("button").closest("div") as HTMLElement;
      expect(row.className.split(/\s+/)).toContain("relative");
    });

    it("lets the chevron fall through to the overlay rather than swallowing the press", () => {
      renderHeader();

      const chevron = screen.getByRole("button").parentElement?.parentElement?.querySelector("[aria-hidden]");
      expect(chevron?.className).toContain("pointer-events-none");
    });

    it("keeps the desktop actions above the overlay", () => {
      // Both the overlay and this cluster are positioned with `z-index: auto`, so tree order
      // decides; the cluster only wins because it is `relative` AND later in the DOM. Drop the
      // `relative` and the overlay eats "Registrar pago".
      renderHeader({ desktopActions: <button type="button">Registrar pago</button> });

      const actions = screen.getByText("Registrar pago").closest("div") as HTMLElement;
      expect(actions.className.split(/\s+/)).toContain("relative");
    });
  });

  it("gives the list a heading structure", () => {
    renderHeader();

    expect(screen.getByRole("heading", { level: 3 }).textContent).toContain("Akiba Books");
  });
});

describe("resolveDebtFigures", () => {
  it("drops a currency at zero, which is six of the collector's ten stores", () => {
    // Each of those six spent ~185px announcing a zero. The row still renders; it just stops
    // offering work that does not exist.
    expect(
      resolveDebtFigures([
        { currencyCode: "PEN", debtMinor: 120000, openOrderDebtMinor: 120000 },
        { currencyCode: "USD", debtMinor: 0, openOrderDebtMinor: 0 },
      ]),
    ).toEqual([{ currencyCode: "PEN", amountMinor: 120000, kind: "debt" }]);
  });

  it("keeps one muted figure when every currency is at zero, rather than going blank", () => {
    expect(
      resolveDebtFigures([
        { currencyCode: "PEN", debtMinor: 0, openOrderDebtMinor: 0 },
        { currencyCode: "USD", debtMinor: 0, openOrderDebtMinor: 0 },
      ]),
    ).toEqual([{ currencyCode: "PEN", amountMinor: 0, kind: "none" }]);
  });

  it("reads credit off the LIFETIME debt and everything else off the open-order figure", () => {
    // `FR-05-63` / `ADR 0033`: being in credit is a fact about the store's whole history, while a
    // positive figure must exclude a balance stranded on a fully delivered order.
    expect(resolveDebtFigures([{ currencyCode: "PEN", debtMinor: -16000, openOrderDebtMinor: 5000 }])).toEqual([
      { currencyCode: "PEN", amountMinor: 16000, kind: "credit" },
    ]);
    expect(resolveDebtFigures([{ currencyCode: "PEN", debtMinor: 50000, openOrderDebtMinor: 20000 }])).toEqual([
      { currencyCode: "PEN", amountMinor: 20000, kind: "debt" },
    ]);
  });

  it("returns nothing for a store with no currencies at all", () => {
    expect(resolveDebtFigures([])).toEqual([]);
  });
});
