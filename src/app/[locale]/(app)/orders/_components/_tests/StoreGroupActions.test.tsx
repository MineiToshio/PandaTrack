import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PendingProductsByStoreGroup } from "@/lib/data/orders/pendingProductsByStoreQueries";
import StoreGroupActions from "../StoreGroupActions";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key);
    translate.has = () => true;
    return translate;
  },
}));
vi.mock("@/components/core/ViewTransitionLink", () => ({
  default: ({ children, ...props }: { children?: React.ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const UNDETAILED = [{ orderId: "order-1", humanReadableId: "ORD-1", amountMinor: 19990, currencyCode: "PEN" }];

function renderActions(undetailed: PendingProductsByStoreGroup["undetailedByOrder"] = []) {
  const { container } = render(
    <StoreGroupActions
      store={{
        id: "store-1",
        slug: "akiba-books",
        name: "Akiba Books",
        logoUrl: null,
        sellerType: "RETAILER",
        status: "APPROVED",
      }}
      debts={[{ currencyCode: "PEN", debtMinor: 20000, openOrderDebtMinor: 20000 }]}
      undetailedByOrder={undetailed}
      locale="es"
      returnTo="/es/orders?view=store"
      onRegisterPayment={() => {}}
      className="flex flex-wrap items-center gap-2"
    />,
  );
  return container;
}

/** The cluster's rendered labels, left to right in DOM order. */
function labelOrder(container: HTMLElement): string[] {
  const cluster = container.firstElementChild as HTMLElement;
  return [...cluster.children].map((child) => (child.textContent ?? "").trim());
}

describe("StoreGroupActions", () => {
  it("puts 'Sin desglosar' between 'Registrar pago' and 'Ver tienda'", () => {
    // The collector's own ordering, and it carries a reason: the two MONEY controls sit together,
    // so the one that explains an existing figure is beside the one that adds to it, and the
    // navigation out of the group comes last.
    const container = renderActions(UNDETAILED);

    expect(labelOrder(container)).toEqual([
      "storeView.registerPayment",
      `storeView.undetailed.trigger:${JSON.stringify({ count: 1 })}`,
      "storeView.viewStore",
    ]);
  });

  it("closes the gap when the store has no undesglosed money, which is 8 of 10 stores", () => {
    const container = renderActions();

    expect(labelOrder(container)).toEqual(["storeView.registerPayment", "storeView.viewStore"]);
  });

  it("wraps rather than overflowing, since three labelled controls do not fit a 320px card", () => {
    const container = renderActions(UNDETAILED);

    expect((container.firstElementChild as HTMLElement).className.split(/\s+/)).toContain("flex-wrap");
  });
});
