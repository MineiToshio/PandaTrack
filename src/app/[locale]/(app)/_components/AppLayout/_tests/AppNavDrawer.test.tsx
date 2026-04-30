import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import AppNavDrawer from "../AppNavDrawer";

const translationMap: Record<string, string> = {
  "nav.dashboard": "Dashboard",
  "nav.stores": "Stores",
  "nav.purchases": "Orders",
  "nav.deliveries": "Deliveries",
  "drawer.openMenu": "Open menu",
  "drawer.closeMenu": "Close menu",
  "drawer.preferencesAriaLabel": "Preferences and account",
  "account.triggerLabel": "collector-fox account actions",
  "account.identityCaption": "Account and preferences",
  "account.settings": "Settings",
  "account.privacy": "Privacy Policy",
  "account.terms": "Terms and Conditions",
  "accessibility.mainNavigation": "Main navigation",
  "accessibility.languageNavigation": "Language",
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

vi.mock("@/app/[locale]/(landing)/_components/Menu/LanguageToggle", () => ({
  default: () => <div data-testid="drawer-language-toggle" />,
}));

vi.mock("@/app/[locale]/(landing)/_components/Menu/ThemeToggle", () => ({
  default: () => <div data-testid="drawer-theme-toggle" />,
}));

vi.mock("@/components/modules/auth/SignOutButton", () => ({
  default: ({ label, onSignOut }: { label: string; onSignOut?: () => void }) => (
    <button type="button" data-testid="drawer-sign-out" onClick={onSignOut}>
      {label}
    </button>
  ),
}));

describe("AppNavDrawer", () => {
  const drawerProps = {
    currentUser: { username: "collector-fox", name: "Collector Fox", image: null },
    signOutLabel: "Sign out",
    onClose: vi.fn(),
    returnFocusRef: { current: null } as RefObject<HTMLButtonElement | null>,
  };

  it("renders nothing when closed", () => {
    const { container } = render(<AppNavDrawer locale="en" isOpen={false} {...drawerProps} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders overlay and panel with primary nav when open", () => {
    render(<AppNavDrawer locale="en" isOpen {...drawerProps} />);

    expect(screen.getByRole("dialog", { name: "Main navigation" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stores" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Orders" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Deliveries" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();

    expect(screen.getByRole("region", { name: "Preferences and account" })).toBeInTheDocument();
    expect(screen.getByTestId("drawer-language-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-theme-toggle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "collector-fox account actions" })).toBeInTheDocument();
  });

  it("opens the inline account menu with settings, sign out, and legal links", async () => {
    const user = userEvent.setup();
    render(<AppNavDrawer locale="en" isOpen {...drawerProps} />);

    await user.click(screen.getByRole("button", { name: "collector-fox account actions" }));

    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByTestId("drawer-sign-out")).toHaveTextContent("Sign out");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Terms and Conditions" })).toHaveAttribute("target", "_blank");
  });

  it("calls onClose when panel close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AppNavDrawer locale="en" isOpen {...drawerProps} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Close menu" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<AppNavDrawer locale="en" isOpen {...drawerProps} onClose={onClose} />);

    const backdrop = container.querySelector("button[aria-hidden='true']");
    expect(backdrop).toBeInstanceOf(HTMLButtonElement);
    await user.click(backdrop as HTMLButtonElement);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("marks current route link as current page", () => {
    render(<AppNavDrawer locale="en" isOpen {...drawerProps} />);
    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
  });

  it("adds centralized PostHog data attributes to nav links", () => {
    render(<AppNavDrawer locale="en" isOpen {...drawerProps} />);
    const storesLink = screen.getByRole("link", { name: "Stores" });

    expect(storesLink).toHaveAttribute("data-ph-event", "app_shell_nav_clicked");
    expect(storesLink).toHaveAttribute(
      "data-ph-props",
      JSON.stringify({ destination: "stores", navigation_level: "primary", stores_href_kind: "plain" }),
    );
  });
});
