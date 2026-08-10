import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock, captureMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  captureMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/es/orders",
  useSearchParams: () => new URLSearchParams("sort=recent&page=2"),
}));

vi.mock("posthog-js", () => ({ default: { capture: captureMock } }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import OrderListViewToggle from "../OrderListViewToggle";

describe("OrderListViewToggle", () => {
  beforeEach(() => {
    pushMock.mockClear();
    captureMock.mockClear();
    document.cookie = "pandatrack-orders-view=; path=/; max-age=0";
  });

  it("exposes an accessible group with one option pressed and the other not", () => {
    render(<OrderListViewToggle view="order" />);

    expect(screen.getByRole("group", { name: "view.groupLabel" })).toBeInTheDocument();
    const orderButton = screen.getByRole("button", { name: "view.order" });
    const storeButton = screen.getByRole("button", { name: "view.store" });
    expect(orderButton).toHaveAttribute("aria-pressed", "true");
    expect(storeButton).toHaveAttribute("aria-pressed", "false");
  });

  it("flips aria-pressed when the active view changes", () => {
    render(<OrderListViewToggle view="store" />);

    expect(screen.getByRole("button", { name: "view.order" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "view.store" })).toHaveAttribute("aria-pressed", "true");
  });

  it("navigates to the other view, clears page/sort, and writes the cookie + posthog event on click", async () => {
    const user = userEvent.setup();
    render(<OrderListViewToggle view="order" />);

    await user.click(screen.getByRole("button", { name: "view.store" }));

    expect(pushMock).toHaveBeenCalledTimes(1);
    const pushedUrl = pushMock.mock.calls[0][0] as string;
    const params = new URLSearchParams(pushedUrl.split("?")[1]);
    expect(params.get("view")).toBe("store");
    expect(params.has("page")).toBe(false);
    expect(params.has("sort")).toBe(false);

    expect(document.cookie).toContain("pandatrack-orders-view=store");
    expect(captureMock).toHaveBeenCalledWith("orders_list_view_changed", { view: "store" });
  });

  it("does nothing when clicking the already-active option", async () => {
    const user = userEvent.setup();
    render(<OrderListViewToggle view="order" />);

    await user.click(screen.getByRole("button", { name: "view.order" }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("label variant renders visible text and no redundant aria-label", () => {
    render(<OrderListViewToggle view="order" variant="label" />);

    const orderButton = screen.getByRole("button", { name: "view.order" });
    expect(orderButton).not.toHaveAttribute("aria-label");
    expect(orderButton).toHaveTextContent("view.order");
  });

  it("icon-only variant carries the accessible name via aria-label with no visible text node", () => {
    render(<OrderListViewToggle view="order" variant="icon-only" />);

    const orderButton = screen.getByRole("button", { name: "view.order" });
    expect(orderButton).toHaveAttribute("aria-label", "view.order");
    expect(orderButton).toHaveTextContent("");
  });
});
