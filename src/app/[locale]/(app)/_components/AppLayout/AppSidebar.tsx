"use client";

import { LayoutDashboard, Package, Settings, ShoppingBag, Store, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import posthog from "posthog-js";
import IconButton from "@/components/core/IconButton";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { getActiveNavItem, getPrivateAppNavItems, type NavItem, type NavItemId } from "./navigationConfig";

const SIDEBAR_WIDTH_EXPANDED_REM = 16;
const SIDEBAR_RAIL_WIDTH_REM = 3.5;

const NAV_ICON_MAP: Record<NavItemId, LucideIcon> = {
  dashboard: LayoutDashboard,
  stores: Store,
  purchases: ShoppingBag,
  shipments: Package,
  settings: Settings,
};

type LucideIcon = React.ComponentType<{ className?: string }>;

type AppSidebarProps = {
  locale: string;
  expanded: boolean;
  onToggle: () => void;
};

export default function AppSidebar({ locale, expanded, onToggle }: AppSidebarProps) {
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
      {/* Desktop sidebar: fixed left, full height. Hidden below lg. */}
      <aside
        className="border-border bg-surface fixed inset-y-0 left-0 z-40 hidden flex-col border-r transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex"
        style={{
          width: expanded ? `${SIDEBAR_WIDTH_EXPANDED_REM}rem` : `${SIDEBAR_RAIL_WIDTH_REM}rem`,
        }}
      >
        {expanded ? (
          <ExpandedSidebarContent
            locale={locale}
            navItems={navItems}
            activeItem={activeItem}
            onToggle={handleToggle}
            t={t}
            showCollapse
          />
        ) : (
          <div className="flex h-full w-full flex-col py-3">
            <div
              className="w-full"
              onMouseEnter={handleRailEnter}
              onMouseLeave={handleRailLeave}
              onFocus={() => setFloatingOpen(true)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setFloatingOpen(false);
              }}
            >
              <RailIcons locale={locale} navItems={navItems} activeItem={activeItem} t={t} />
            </div>
            <div className="mt-auto flex w-full justify-center px-2">
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
          className="border-border bg-surface fixed inset-y-0 left-0 z-50 flex w-[16rem] flex-col border-r shadow-lg transition-opacity duration-150 ease-out motion-reduce:duration-0 lg:flex"
          onMouseEnter={handleRailEnter}
          onMouseLeave={handleRailLeave}
        >
          <ExpandedSidebarContent
            locale={locale}
            navItems={navItems}
            activeItem={activeItem}
            onToggle={handleToggle}
            t={t}
            showCollapse={false}
          />
        </div>
      )}
    </>
  );
}

function ExpandedSidebarContent({
  locale,
  navItems,
  activeItem,
  onToggle,
  t,
  showCollapse,
}: {
  locale: string;
  navItems: NavItem[];
  activeItem: NavItem;
  onToggle: () => void;
  t: (key: string) => string;
  showCollapse: boolean;
}) {
  return (
    <>
      <nav className="flex flex-1 flex-col gap-1 px-2 py-3" aria-label="Main">
        {navItems.map((item) => (
          <NavLink key={item.id} item={item} locale={locale} isActive={activeItem.id === item.id} t={t} />
        ))}
      </nav>
      <div className="border-border flex items-center justify-between border-t p-3">
        <span className="text-text-muted text-sm">{showCollapse ? t("sidebar.collapse") : t("sidebar.expand")}</span>
        <IconButton
          Icon={showCollapse ? PanelLeftClose : PanelLeftOpen}
          variant="outline"
          aria-label={showCollapse ? t("sidebar.collapse") : t("sidebar.expand")}
          onClick={onToggle}
        />
      </div>
    </>
  );
}

function RailIcons({
  locale,
  navItems,
  activeItem,
  t,
}: {
  locale: string;
  navItems: NavItem[];
  activeItem: NavItem;
  t: (key: string) => string;
}) {
  return (
    <nav className="flex w-full flex-col gap-1 px-2" aria-label="Main">
      {navItems.map((item) => {
        const Icon = NAV_ICON_MAP[item.id];
        const isActive = activeItem.id === item.id;
        const href = item.href(locale);
        return (
          <Link
            key={item.id}
            href={href}
            aria-label={t(item.labelKey)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring focus-visible:ring-offset-background flex h-10 w-full shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              isActive ? "bg-primary/20 text-primary" : "text-text-muted hover:bg-muted hover:text-foreground",
            )}
            data-ph-event={POSTHOG_EVENTS.APP_SHELL.NAV_CLICKED}
            data-ph-props={JSON.stringify({
              destination: item.id,
              navigation_level: "primary",
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
}: {
  item: NavItem;
  locale: string;
  isActive: boolean;
  t: (key: string) => string;
}) {
  const Icon = NAV_ICON_MAP[item.id];
  const href = item.href(locale);
  return (
    <Link
      href={href}
      className={cn(
        "focus-visible:ring-ring focus-visible:ring-offset-background flex h-10 items-center gap-3 rounded-lg pr-3 pl-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        isActive ? "bg-primary/20 text-primary" : "text-text-body hover:bg-muted hover:text-foreground",
      )}
      aria-current={isActive ? "page" : undefined}
      data-ph-event={POSTHOG_EVENTS.APP_SHELL.NAV_CLICKED}
      data-ph-props={JSON.stringify({
        destination: item.id,
        navigation_level: "primary",
      })}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{t(item.labelKey)}</span>
    </Link>
  );
}
