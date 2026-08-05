import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

import DashboardActivityRow from "../DashboardActivityRow";

const BASE_PROPS = {
  orderId: "order-1",
  humanReadableId: "ORD-20260716-03",
  storeName: "AmiAmi",
  storeLogoUrl: null,
  href: "/es/orders/order-1",
  ariaLabel: "Pedido ORD-20260716-03 de AmiAmi",
  listKey: "overdue",
  meta: <span>hace 12 días</span>,
};

function renderRow(props: Partial<React.ComponentProps<typeof DashboardActivityRow>> = {}) {
  return render(
    <ul>
      <DashboardActivityRow {...BASE_PROPS} {...props} />
    </ul>,
  );
}

describe("DashboardActivityRow", () => {
  it("renders the order as a single navigable link when it carries no action", () => {
    renderRow();

    const link = screen.getByRole("link", { name: BASE_PROPS.ariaLabel });
    expect(link).toHaveAttribute("href", BASE_PROPS.href);
    expect(screen.getByText("AmiAmi")).toBeInTheDocument();
    expect(screen.getByText("ORD-20260716-03")).toBeInTheDocument();
  });

  it("renders the trailing action outside the link, so it is a real button and not nested inside an anchor", () => {
    renderRow({ action: <button type="button">Llegó</button> });

    const link = screen.getByRole("link", { name: BASE_PROPS.ariaLabel });
    const action = screen.getByRole("button", { name: "Llegó" });

    expect(action).toBeInTheDocument();
    // Nesting a button inside an anchor is invalid HTML and unreachable by keyboard: the row uses
    // a full-bleed link overlay precisely so both stay independently operable.
    expect(link.contains(action)).toBe(false);
  });

  it("renders the meta once when there is no action, so the plain row keeps its single inline slot", () => {
    renderRow();

    expect(screen.getAllByText("hace 12 días")).toHaveLength(1);
  });

  it("moves the meta under the order code on narrow screens when the row carries an action", () => {
    // Regression: with a status chip AND a trailing control competing for one line, the store name
    // and order code collapsed to ~18px at 375px wide, which is the only thing telling rows apart.
    renderRow({ action: <button type="button">Llegó</button> });

    const copies = screen.getAllByText("hace 12 días");
    expect(copies).toHaveLength(2);

    const stacked = copies.find((node) => node.closest(".sm\\:hidden"));
    const inline = copies.find((node) => node.closest(".hidden.sm\\:flex"));
    expect(stacked).toBeDefined();
    expect(inline).toBeDefined();
    // The stacked copy belongs to the identity column so it sits under the code line.
    expect(stacked?.closest(".min-w-0")).not.toBeNull();
  });

  it("keeps the link reachable by not letting the passive content swallow the pointer", () => {
    const { container } = renderRow({ action: <button type="button">Llegó</button> });

    const storeName = screen.getByText("AmiAmi");
    expect(storeName.closest(".pointer-events-none")).not.toBeNull();

    const link = container.querySelector("a");
    expect(link?.className).toContain("absolute");
  });
});
