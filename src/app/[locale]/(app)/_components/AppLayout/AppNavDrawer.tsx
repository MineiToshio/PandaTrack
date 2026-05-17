"use client";

import { LayoutDashboard, Package, ShoppingBag, Store, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { useFocusScope } from "@/lib/a11y/useFocusScope";
import LanguageToggle from "@/app/[locale]/(landing)/_components/Menu/LanguageToggle";
import ThemeToggle from "@/app/[locale]/(landing)/_components/Menu/ThemeToggle";
import IconButton from "@/components/core/IconButton";
import Logo from "@/components/core/Logo";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { getActiveNavItem, getPrivateAppNavItems, type NavItemId } from "./navigationConfig";
import ShellAccountMenu from "./ShellAccountMenu";
import type { AppShellUserIdentity } from "./types";

type PrimaryNavItemId = Exclude<NavItemId, "settings">;

const NAV_ICON_MAP: Record<PrimaryNavItemId, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  stores: Store,
  orders: ShoppingBag,
  deliveries: Package,
};

const TABLET_BREAKPOINT_PX = 768;

function getViewportKind(): "mobile" | "tablet" {
  if (typeof window === "undefined") return "mobile";
  return window.innerWidth >= TABLET_BREAKPOINT_PX ? "tablet" : "mobile";
}

type AppNavDrawerProps = {
  locale: string;
  currentUser: AppShellUserIdentity;
  signOutLabel: string;
  isOpen: boolean;
  onClose: () => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
  storesHref?: string;
};

export default function AppNavDrawer({
  locale,
  currentUser,
  signOutLabel,
  isOpen,
  onClose,
  returnFocusRef,
  storesHref,
}: AppNavDrawerProps) {
  const pathname = usePathname();
  const t = useTranslations("appLayout");
  const drawerRootRef = useRef<HTMLDivElement>(null);
  const navItems = getPrivateAppNavItems();
  const activeItem = getActiveNavItem(pathname ?? "");
  const appShellMainNavigationLabel = t("accessibility.mainNavigation");
  const appShellLanguageLabel = t("accessibility.languageNavigation");
  const drawerPreferencesLabel = t("drawer.preferencesAriaLabel");

  useFocusScope({
    active: isOpen,
    rootRef: drawerRootRef,
    onClose,
    returnFocusRef,
  });

  useEffect(() => {
    if (isOpen) {
      posthog.capture(POSTHOG_EVENTS.APP_SHELL.DRAWER_OPENED, {
        viewport: getViewportKind(),
        route: pathname ?? "",
      });
    }
  }, [isOpen, pathname]);

  if (!isOpen) return null;

  return (
    <div
      ref={drawerRootRef}
      id="app-nav-drawer"
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={appShellMainNavigationLabel}
    >
      <button
        type="button"
        className={cn(
          "bg-background/80 absolute inset-0 backdrop-blur-sm transition-opacity duration-200 motion-reduce:duration-0",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        aria-hidden
        tabIndex={-1}
      />
      <aside
        className={cn(
          "border-border bg-surface absolute top-0 left-0 flex h-full w-80 max-w-[85vw] min-w-0 flex-col border-r shadow-lg transition-transform duration-200 motion-reduce:duration-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="border-border flex shrink-0 items-center justify-between gap-2 border-b px-3 py-3">
          <Logo className="text-2xl" />
          <IconButton
            Icon={X}
            variant="outline"
            size="sm"
            aria-label={t("drawer.closeMenu")}
            onClick={onClose}
            className="shrink-0"
          />
        </div>
        <nav
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-3"
          aria-label={appShellMainNavigationLabel}
        >
          {navItems.map((item) => {
            const Icon = NAV_ICON_MAP[item.id as PrimaryNavItemId];
            const isActive = activeItem.id === item.id;
            const href = item.id === "stores" && storesHref != null ? storesHref : item.href(locale);
            const storesHrefKind =
              item.id === "stores" ? (href.includes("?") ? "preference_filters" : "plain") : undefined;
            return (
              <Link
                key={item.id}
                href={href}
                onClick={onClose}
                className={cn(
                  "focus-visible:ring-ring focus-visible:ring-offset-background flex h-11 min-h-11 items-center gap-3 rounded-lg px-2.5 pr-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "text-text-body hover:bg-foreground/15 hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
                data-ph-event={POSTHOG_EVENTS.APP_SHELL.NAV_CLICKED}
                data-ph-props={JSON.stringify({
                  destination: item.id,
                  navigation_level: "primary",
                  ...(storesHrefKind != null && { stores_href_kind: storesHrefKind }),
                })}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
        <section
          aria-label={drawerPreferencesLabel}
          className="border-border flex shrink-0 flex-col gap-4 border-t px-3 py-4"
        >
          <div className="flex min-w-0 flex-wrap items-center justify-start gap-3">
            <LanguageToggle
              className="min-w-0 shrink-0 justify-start gap-2 text-base [&>span]:gap-2"
              compact
              onNavigate={onClose}
              ariaLabel={appShellLanguageLabel}
              posthogEvent={POSTHOG_EVENTS.APP_SHELL.LOCALE_CHANGED}
              getPosthogProps={(targetLocale) => ({
                locale: targetLocale,
                route: pathname ?? "",
              })}
            />
            <ThemeToggle
              className="h-11 w-11 shrink-0"
              posthogEvent={POSTHOG_EVENTS.APP_SHELL.THEME_CHANGED}
              posthogProps={{ route: pathname ?? "" }}
            />
          </div>
          <ShellAccountMenu
            key={`drawer-account-${pathname ?? ""}`}
            locale={locale}
            user={currentUser}
            signOutLabel={signOutLabel}
            surface="drawer"
            onItemSelect={onClose}
          />
        </section>
      </aside>
    </div>
  );
}
