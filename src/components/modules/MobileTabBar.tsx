"use client";

import { LayoutDashboard, Settings, ShoppingBag, Store } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import FAB, { type FabAction } from "@/components/core/FAB";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { getActiveNavItem } from "@/app/[locale]/(app)/_components/AppLayout/navigationConfig";

const TAB_NAV_IDS = ["dashboard", "orders", "stores", "settings"] as const;
type TabNavId = (typeof TAB_NAV_IDS)[number];

type TabConfig = {
  id: TabNavId;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
};

const TABS: TabConfig[] = [
  { id: "dashboard", icon: LayoutDashboard, labelKey: "mobileTabBar.today" },
  { id: "orders", icon: ShoppingBag, labelKey: "mobileTabBar.orders" },
  { id: "stores", icon: Store, labelKey: "mobileTabBar.stores" },
  { id: "settings", icon: Settings, labelKey: "mobileTabBar.settings" },
];

function getTabHref(id: TabNavId, locale: string, storesHref?: string): string {
  if (id === "stores" && storesHref != null) return storesHref;
  return `/${locale}${ROUTES[id]}`;
}

type MobileTabBarProps = {
  locale: string;
  pathname: string;
  fabAction: FabAction | null;
  storesHref?: string;
};

export default function MobileTabBar({ locale, pathname, fabAction, storesHref }: MobileTabBarProps) {
  const t = useTranslations("appLayout");
  const activeNavItem = getActiveNavItem(pathname);
  const activeTabId: TabNavId | null = TAB_NAV_IDS.includes(activeNavItem.id as TabNavId)
    ? (activeNavItem.id as TabNavId)
    : null;

  return (
    <nav
      role="tablist"
      aria-label={t("accessibility.mainNavigation")}
      className="border-border bg-surface fixed right-0 bottom-0 left-0 z-30 grid border-t lg:hidden"
      style={{
        height: "var(--mobile-tab-bar-h)",
        gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* First two tabs */}
      {TABS.slice(0, 2).map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={activeTabId === tab.id}
          href={getTabHref(tab.id, locale, storesHref)}
          t={t}
          pathname={pathname}
        />
      ))}

      {/* Center FAB slot */}
      <div className="relative flex items-start justify-center" role="presentation">
        <div style={{ transform: "translateY(-28px)" }}>
          <FAB action={fabAction} position="elevated" />
        </div>
      </div>

      {/* Last two tabs */}
      {TABS.slice(2).map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={activeTabId === tab.id}
          href={getTabHref(tab.id, locale, storesHref)}
          t={t}
          pathname={pathname}
        />
      ))}
    </nav>
  );
}

function TabItem({
  tab,
  isActive,
  href,
  t,
  pathname,
}: {
  tab: TabConfig;
  isActive: boolean;
  href: string;
  t: ReturnType<typeof useTranslations<"appLayout">>;
  pathname: string;
}) {
  const { id, icon: Icon, labelKey } = tab;
  const label = t(labelKey);
  const storesHrefKind = id === "stores" ? (href.includes("?") ? "preference_filters" : "plain") : undefined;

  return (
    <Link
      role="tab"
      href={href}
      aria-selected={isActive}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "focus-visible:ring-ring focus-visible:ring-offset-background active:bg-muted/50 flex flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        isActive ? "text-accent" : "text-text-muted",
      )}
      style={{ minHeight: 44, minWidth: 44 }}
      data-ph-event={POSTHOG_EVENTS.APP_SHELL.NAV_CLICKED}
      data-ph-props={JSON.stringify({
        destination: id,
        navigation_level: "primary",
        viewport: "mobile",
        ...(storesHrefKind != null && { stores_href_kind: storesHrefKind }),
      })}
      onClick={() => {
        posthog.capture(POSTHOG_EVENTS.APP_SHELL.NAV_CLICKED, {
          destination: id,
          navigation_level: "primary",
          viewport: "mobile",
          route: pathname,
          ...(storesHrefKind != null && { stores_href_kind: storesHrefKind }),
        });
      }}
    >
      <Icon className="h-5 w-5" aria-hidden />
      <span className={cn("text-caption max-w-14 truncate", isActive ? "font-medium" : "font-normal")}>{label}</span>
    </Link>
  );
}
