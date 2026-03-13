import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AppNavDrawer from "../AppNavDrawer";

const translationMap: Record<string, string> = {
  "nav.dashboard": "Dashboard",
  "nav.stores": "Stores",
  "nav.purchases": "Purchases",
  "nav.shipments": "Shipments",
  "nav.settings": "Settings",
  "drawer.openMenu": "Open menu",
  "drawer.closeMenu": "Close menu",
  "accessibility.mainNavigation": "Main navigation",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => translationMap[key] ?? key,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/dashboard",
}));

vi.mock("posthog-js", () => ({
  default: { capture: vi.fn() },
}));

describe("AppNavDrawer", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <AppNavDrawer locale="en" isOpen={false} onClose={vi.fn()} returnFocusRef={{ current: null }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders overlay and panel with primary nav when open", () => {
    render(<AppNavDrawer locale="en" isOpen onClose={vi.fn()} returnFocusRef={{ current: null }} />);

    expect(screen.getByRole("dialog", { name: "Close menu" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stores" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Purchases" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shipments" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("calls onClose when panel close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AppNavDrawer locale="en" isOpen onClose={onClose} returnFocusRef={{ current: null }} />);

    const closeButtons = screen.getAllByRole("button", { name: "Close menu" });
    await user.click(closeButtons[1]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AppNavDrawer locale="en" isOpen onClose={onClose} returnFocusRef={{ current: null }} />);

    const closeButtons = screen.getAllByRole("button", { name: "Close menu" });
    const backdrop = closeButtons[0];
    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("marks current route link as current page", () => {
    render(<AppNavDrawer locale="en" isOpen onClose={vi.fn()} returnFocusRef={{ current: null }} />);
    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
  });

  it("adds centralized PostHog data attributes to nav links", () => {
    render(<AppNavDrawer locale="en" isOpen onClose={vi.fn()} returnFocusRef={{ current: null }} />);
    const storesLink = screen.getByRole("link", { name: "Stores" });

    expect(storesLink).toHaveAttribute("data-ph-event", "app_shell_nav_clicked");
    expect(storesLink).toHaveAttribute(
      "data-ph-props",
      JSON.stringify({ destination: "stores", navigation_level: "primary" }),
    );
  });
});
