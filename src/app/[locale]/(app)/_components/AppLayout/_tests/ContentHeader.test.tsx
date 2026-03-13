import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ContentHeader from "../ContentHeader";

const translationMap: Record<string, string> = {
  "nav.dashboard": "Dashboard",
  "nav.purchases": "Purchases",
  "nav.preOrders": "Pre-orders",
  "drawer.openMenu": "Open menu",
  "accessibility.breadcrumbNavigation": "Breadcrumb",
  "accessibility.languageNavigation": "Language",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => translationMap[key] ?? key,
}));

vi.mock("@/app/[locale]/(app)/_utils/pageHeader", () => ({
  getPageHeader: () => ({
    titleKey: "nav.preOrders",
    breadcrumbs: [{ href: "/en/purchases", labelKey: "nav.purchases" }],
  }),
}));

vi.mock("@/app/[locale]/(landing)/_components/Menu/LanguageToggle", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="language-toggle" data-props={JSON.stringify(props)}>
      language-toggle
    </div>
  ),
}));

vi.mock("@/app/[locale]/(landing)/_components/Menu/ThemeToggle", () => ({
  default: (props: Record<string, unknown>) => <div data-testid="theme-toggle" data-props={JSON.stringify(props)} />,
}));

vi.mock("@/components/modules/auth/SignOutButton", () => ({
  default: () => <button type="button">Sign out</button>,
}));

describe("ContentHeader", () => {
  it("uses localized labels and wires shell analytics props for toggles", () => {
    render(
      <ContentHeader
        locale="en"
        pathname="/en/purchases/pre-orders"
        signOutLabel="Sign out"
        drawerOpen={false}
        onOpenDrawer={vi.fn()}
        burgerButtonRef={{ current: null }}
      />,
    );

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();

    const languageToggleProps = JSON.parse(
      screen.getByTestId("language-toggle").getAttribute("data-props") ?? "{}",
    ) as {
      ariaLabel?: string;
      posthogEvent?: string;
    };
    expect(languageToggleProps.ariaLabel).toBe("Language");
    expect(languageToggleProps.posthogEvent).toBe("app_shell_locale_changed");

    const themeToggleProps = JSON.parse(screen.getByTestId("theme-toggle").getAttribute("data-props") ?? "{}") as {
      posthogEvent?: string;
      posthogProps?: { route?: string };
    };
    expect(themeToggleProps.posthogEvent).toBe("app_shell_theme_changed");
    expect(themeToggleProps.posthogProps?.route).toBe("/en/purchases/pre-orders");
  });
});
