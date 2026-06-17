"use client";

import { LayoutDashboard, Package, ShoppingBag, Store, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import posthog from "posthog-js";
import IconButton from "@/components/core/IconButton";
import Logo from "@/components/core/Logo";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { getActiveNavItem, getPrivateAppNavItems, type NavItem, type NavItemId } from "./navigationConfig";
import ShellAccountMenu, { SidebarRailAccountPreview } from "./ShellAccountMenu";
import type { AppShellUserIdentity } from "./types";

const SIDEBAR_WIDTH_EXPANDED_REM = 16;
const SIDEBAR_RAIL_WIDTH_REM = 3.5;

/** Fixed height matching ContentHeader (h-14) so the logo strip aligns with the content header. */
const SIDEBAR_HEADER_BASE = "border-border flex h-14 shrink-0 items-center border-b px-4";

type PrimaryNavItemId = Exclude<NavItemId, "settings">;

const NAV_ICON_MAP: Record<PrimaryNavItemId, LucideIcon> = {
  dashboard: LayoutDashboard,
  stores: Store,
  orders: ShoppingBag,
  deliveries: Package,
};

type LucideIcon = React.ComponentType<{ className?: string }>;

type AppSidebarProps = {
  locale: string;
  currentUser: AppShellUserIdentity;
  signOutLabel: string;
  expanded: boolean;
  onToggle: () => void;
  storesHref?: string;
};

export default function AppSidebar({
  locale,
  currentUser,
  signOutLabel,
  expanded,
  onToggle,
  storesHref,
}: AppSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("appLayout");
  const [floatingOpen, setFloatingOpen] = useState(false);

  const navItems = getPrivateAppNavItems();
  const activeItem = getActiveNavItem(pathname ?? "");

  const handleToggle = () => {
    posthog.capture(POSTHOG_EVENTS.APP_SHELL.SIDEBAR_TOGGLED, {
      state: expanded ? "collapsed" : "expanded",
      viewport: "desktop",
      route: pathname ?? "",
    });
    onToggle();
    setFloatingOpen(false);
  };

  const handleRailEnter = () => setFloatingOpen(true);
  const handleRailLeave = () => setFloatingOpen(false);

  return (
    <>
      {/* Desktop sidebar: fixed left, starts below verification banner when present. Hidden below lg. */}
      <aside
        className="border-border bg-surface fixed left-0 z-40 hidden flex-col border-r transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex"
        style={{
          width: expanded ? `${SIDEBAR_WIDTH_EXPANDED_REM}rem` : `${SIDEBAR_RAIL_WIDTH_REM}rem`,
          top: "var(--app-banner-offset, 0px)",
          height: "calc(100vh - var(--app-banner-offset, 0px))",
        }}
      >
        <div className={cn(SIDEBAR_HEADER_BASE, expanded ? "w-full justify-start" : "justify-center")}>
          {expanded ? (
            <Logo className="min-w-0 flex-1 text-2xl" />
          ) : (
            <Image src="/icon.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" />
          )}
        </div>
        {expanded ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <ExpandedSidebarContent
              locale={locale}
              pathname={pathname ?? ""}
              currentUser={currentUser}
              signOutLabel={signOutLabel}
              navItems={navItems}
              activeItem={activeItem}
              onToggle={handleToggle}
              t={t}
              showCollapse
              storesHref={storesHref}
            />
          </div>
        ) : (
          <div
            className="flex min-h-0 flex-1 flex-col"
            onMouseEnter={handleRailEnter}
            onMouseLeave={handleRailLeave}
            onFocus={() => setFloatingOpen(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setFloatingOpen(false);
            }}
          >
            <div className="w-full flex-1 py-2">
              <RailIcons locale={locale} navItems={navItems} activeItem={activeItem} t={t} storesHref={storesHref} />
            </div>
            <div className="border-border flex w-full flex-col items-center gap-2 border-t px-2 py-2">
              <SidebarRailAccountPreview
                user={currentUser}
                label={t("account.triggerLabel", { username: currentUser.username })}
                onOpen={handleRailEnter}
              />
              <IconButton
                Icon={PanelLeftOpen}
                variant="outline"
                aria-label={t("sidebar.expand")}
                onClick={handleToggle}
              />
            </div>
          </div>
        )}
      </aside>

      {/* Floating preview when collapsed: same sidebar expanded over the rail (left: 0 so rail is not visible behind) */}
      {!expanded && floatingOpen && (
        <div
          className="border-border bg-surface fixed left-0 z-50 flex w-[16rem] flex-col border-r shadow-lg transition-opacity duration-150 ease-out motion-reduce:duration-0 lg:flex"
          style={{
            top: "var(--app-banner-offset, 0px)",
            height: "calc(100vh - var(--app-banner-offset, 0px))",
          }}
          onMouseEnter={handleRailEnter}
          onMouseLeave={handleRailLeave}
        >
          <div className={cn(SIDEBAR_HEADER_BASE, "w-full justify-start")}>
            <Logo className="min-w-0 flex-1 text-2xl" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <ExpandedSidebarContent
              locale={locale}
              pathname={pathname ?? ""}
              currentUser={currentUser}
              signOutLabel={signOutLabel}
              navItems={navItems}
              activeItem={activeItem}
              onToggle={handleToggle}
              t={t}
              showCollapse={false}
              storesHref={storesHref}
            />
          </div>
        </div>
      )}
    </>
  );
}

function ExpandedSidebarContent({
  locale,
  pathname,
  currentUser,
  signOutLabel,
  navItems,
  activeItem,
  onToggle,
  t,
  showCollapse,
  storesHref,
}: {
  locale: string;
  pathname: string;
  currentUser: AppShellUserIdentity;
  signOutLabel: string;
  navItems: NavItem[];
  activeItem: NavItem;
  onToggle: () => void;
  t: (key: string) => string;
  showCollapse: boolean;
  storesHref?: string;
}) {
  const appShellMainNavigationLabel = t("accessibility.mainNavigation");

  return (
    <>
      <nav className="flex flex-1 flex-col gap-1 px-2 py-3" aria-label={appShellMainNavigationLabel}>
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            item={item}
            locale={locale}
            isActive={activeItem.id === item.id}
            t={t}
            storesHref={storesHref}
          />
        ))}
      </nav>
      <div className="border-border flex flex-col gap-2 border-t px-2 py-2">
        <ShellAccountMenu
          key={`desktop-account-${pathname ?? ""}`}
          locale={locale}
          user={currentUser}
          signOutLabel={signOutLabel}
          surface="desktop"
        />
        <div className="flex min-h-11 items-center justify-between px-1">
          <span className="text-text-muted text-sm">{showCollapse ? t("sidebar.collapse") : t("sidebar.expand")}</span>
          <IconButton
            Icon={showCollapse ? PanelLeftClose : PanelLeftOpen}
            variant="outline"
            aria-label={showCollapse ? t("sidebar.collapse") : t("sidebar.expand")}
            onClick={onToggle}
          />
        </div>
      </div>
    </>
  );
}

function RailIcons({
  locale,
  navItems,
  activeItem,
  t,
  storesHref,
}: {
  locale: string;
  navItems: NavItem[];
  activeItem: NavItem;
  t: (key: string) => string;
  storesHref?: string;
}) {
  const appShellMainNavigationLabel = t("accessibility.mainNavigation");

  return (
    <nav className="flex w-full flex-col gap-1 px-2" aria-label={appShellMainNavigationLabel}>
      {navItems.map((item) => {
        const Icon = NAV_ICON_MAP[item.id as PrimaryNavItemId];
        const isActive = activeItem.id === item.id;
        const href = item.id === "stores" && storesHref != null ? storesHref : item.href(locale);
        const storesHrefKind = item.id === "stores" ? (href.includes("?") ? "preference_filters" : "plain") : undefined;
        return (
          <Link
            key={item.id}
            href={href}
            aria-label={t(item.labelKey)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring focus-visible:ring-offset-background flex h-10 w-full shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              isActive ? "bg-primary/20 text-primary" : "text-text-muted hover:bg-foreground/10 hover:text-foreground",
            )}
            data-ph-event={POSTHOG_EVENTS.APP_SHELL.NAV_CLICKED}
            data-ph-props={JSON.stringify({
              destination: item.id,
              navigation_level: "primary",
              ...(storesHrefKind != null && { stores_href_kind: storesHrefKind }),
            })}
          >
            <Icon className="h-5 w-5" />
          </Link>
        );
      })}
    </nav>
  );
}

function NavLink({
  item,
  locale,
  isActive,
  t,
  storesHref,
}: {
  item: NavItem;
  locale: string;
  isActive: boolean;
  t: (key: string) => string;
  storesHref?: string;
}) {
  const Icon = NAV_ICON_MAP[item.id as PrimaryNavItemId];
  const href = item.id === "stores" && storesHref != null ? storesHref : item.href(locale);
  const storesHrefKind = item.id === "stores" ? (href.includes("?") ? "preference_filters" : "plain") : undefined;
  return (
    <Link
      href={href}
      className={cn(
        "focus-visible:ring-ring focus-visible:ring-offset-background flex h-10 items-center gap-3 rounded-lg pr-3 pl-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        isActive ? "bg-primary/20 text-primary" : "text-text-body hover:bg-foreground/10 hover:text-foreground",
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
}
