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

// `values` mirrors real next-intl interpolation closely enough to assert on: the compact
// variant's `view.compactAriaLabel` key takes a `{value}` param.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

import OrderListGroupBy from "../OrderListGroupBy";

describe("OrderListGroupBy", () => {
  beforeEach(() => {
    pushMock.mockClear();
    captureMock.mockClear();
    document.cookie = "pandatrack-orders-view=; path=/; max-age=0";
  });

  describe("select variant (desktop)", () => {
    it("exposes an aria-label and shows only the active option's value as text", () => {
      render(<OrderListGroupBy view="order" variant="select" />);

      const trigger = screen.getByRole("combobox", { name: "view.ariaLabel" });
      expect(trigger).toHaveTextContent("view.order");
      expect(trigger).not.toHaveTextContent("view.store");
    });

    it("navigates to the other view, clears page/sort, and writes the cookie + posthog event on select", async () => {
      const user = userEvent.setup();
      render(<OrderListGroupBy view="order" variant="select" />);

      await user.click(screen.getByRole("combobox", { name: "view.ariaLabel" }));
      await user.click(screen.getByRole("option", { name: "view.store" }));

      expect(pushMock).toHaveBeenCalledTimes(1);
      const pushedUrl = pushMock.mock.calls[0][0] as string;
      const params = new URLSearchParams(pushedUrl.split("?")[1]);
      expect(params.get("view")).toBe("store");
      expect(params.has("page")).toBe(false);
      expect(params.has("sort")).toBe(false);

      expect(document.cookie).toContain("pandatrack-orders-view=store");
      expect(captureMock).toHaveBeenCalledWith("orders_list_view_changed", { view: "store", surface: "select" });
    });

    it("does nothing when selecting the already-active option", async () => {
      const user = userEvent.setup();
      render(<OrderListGroupBy view="order" variant="select" />);

      await user.click(screen.getByRole("combobox", { name: "view.ariaLabel" }));
      await user.click(screen.getByRole("option", { name: "view.order" }));

      expect(pushMock).not.toHaveBeenCalled();
      expect(captureMock).not.toHaveBeenCalled();
    });

    it("renders no tooltip in the select variant", () => {
      render(<OrderListGroupBy view="order" variant="select" />);

      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });

  describe("compact variant (mobile)", () => {
    it("shows the short active-value label and a full aria-label naming the current value", () => {
      render(<OrderListGroupBy view="store" variant="compact" />);

      const trigger = screen.getByRole("button", {
        name: `view.compactAriaLabel:${JSON.stringify({ value: "view.store" })}`,
      });
      expect(trigger).toHaveTextContent("view.compactStore");
      expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("opens the picker sheet and selects the other option", async () => {
      const user = userEvent.setup();
      render(<OrderListGroupBy view="order" variant="compact" />);

      const trigger = screen.getByRole("button", { name: /compactAriaLabel/ });
      await user.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      const option = await screen.findByRole("option", { name: "view.store" });
      await user.click(option);

      expect(pushMock).toHaveBeenCalledTimes(1);
      const pushedUrl = pushMock.mock.calls[0][0] as string;
      const params = new URLSearchParams(pushedUrl.split("?")[1]);
      expect(params.get("view")).toBe("store");
      expect(params.has("page")).toBe(false);
      expect(params.has("sort")).toBe(false);

      expect(document.cookie).toContain("pandatrack-orders-view=store");
      expect(captureMock).toHaveBeenCalledWith("orders_list_view_changed", { view: "store", surface: "compact" });
    });

    it("renders no tooltip in the compact variant", () => {
      render(<OrderListGroupBy view="order" variant="compact" />);

      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });
});
