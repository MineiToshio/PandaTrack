"use client";

import {
  Image as ImageIcon,
  LayoutDashboard,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  Shield,
  ShoppingBag,
  Store,
  Trophy,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import IconButton from "@/components/core/IconButton";
import Logo from "@/components/core/Logo";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS } from "@/lib/constants";
import {
  getActiveAdminNavItemId,
  getActiveNavItem,
  getAdminNavItems,
  getAllNavItems,
  type AdminNavItemId,
  type NavItemId,
} from "@/app/[locale]/(app)/_components/AppLayout/navigationConfig";
import ShellAccountMenu, {
  SidebarRailAccountPreview,
} from "@/app/[locale]/(app)/_components/AppLayout/ShellAccountMenu";
import type { AppShellUserIdentity } from "@/app/[locale]/(app)/_components/AppLayout/types";

const NAV_ICON_MAP: Record<NavItemId, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  orders: ShoppingBag,
  deliveries: Package,
  stores: Store,
  // A trophy rather than a medal glyph: medal iconography belongs to the album's own rarity chips.
  progress: Trophy,
  settings: Settings,
};

const ADMIN_ICON_MAP: Record<AdminNavItemId, React.ComponentType<{ className?: string }>> = {
  moderation: Shield,
  imageIntake: ImageIcon,
  audit: ScrollText,
};

type SidebarProps = {
  locale: string;
  currentUser: AppShellUserIdentity;
  signOutLabel: string;
  expanded: boolean;
  onToggle: () => void;
  floatingOpen: boolean;
  onFloatingChange: (open: boolean) => void;
  storesHref?: string;
  isAdmin: boolean;
  /** `false` hides the `Progreso` entry entirely, with no placeholder left behind (`FR-12-38`). */
  showProgression: boolean;
};

export default function Sidebar({
  locale,
  currentUser,
  signOutLabel,
  expanded,
  onToggle,
  floatingOpen,
  onFloatingChange,
  storesHref,
  isAdmin,
  showProgression,
}: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("appLayout");
  const tAdmin = useTranslations("admin");
  const navItems = getAllNavItems({ showProgression });
  const activeItem = getActiveNavItem(pathname ?? "");
  const activeAdminId = getActiveAdminNavItemId(pathname ?? "");
  const isAdminRoute = activeAdminId !== undefined;
  const isExpanded = expanded || floatingOpen;

  const handleToggle = () => {
    posthog.capture(POSTHOG_EVENTS.APP_SHELL.SIDEBAR_TOGGLED, {
      state: expanded ? "collapsed" : "expanded",
      viewport: "desktop",
      route: pathname ?? "",
    });
    onToggle();
  };

  const handleRailEnter = () => {
    if (!expanded) onFloatingChange(true);
  };

  const handleRailLeave = () => {
    if (!expanded) onFloatingChange(false);
  };

  const handleRailBlur = (e: React.FocusEvent) => {
    if (!expanded && !e.currentTarget.contains(e.relatedTarget as Node)) {
      onFloatingChange(false);
    }
  };

  return (
    <aside
      aria-label={t("accessibility.primarySidebar")}
      className={cn(
        "border-border bg-surface-elevated fixed left-0 hidden flex-col border-r transition-[width] duration-[var(--motion-base)] ease-[var(--ease-out-expressive)] motion-reduce:transition-none lg:flex",
        // Hover-expand floats over content: lift above header (z-30) so it covers header zone too.
        !expanded && floatingOpen ? "z-40 shadow-[var(--elevation-3)]" : "z-20",
      )}
      style={{
        width: isExpanded ? "var(--sidebar-w-expanded)" : "var(--sidebar-w-collapsed)",
        top: "var(--app-banner-offset, 0px)",
        height: "calc(100vh - var(--app-banner-offset, 0px))",
      }}
      onMouseEnter={handleRailEnter}
      onMouseLeave={handleRailLeave}
      onFocus={() => {
        if (!expanded) onFloatingChange(true);
      }}
      onBlur={handleRailBlur}
    >
      {/* Logo zone — height matches content header for visual alignment */}
      <div
        className="border-border flex shrink-0 items-center overflow-hidden border-b px-4"
        style={{ height: "var(--header-h-desktop)" }}
      >
        {isExpanded ? (
          <Logo className="min-w-0 flex-1 text-2xl" />
        ) : (
          <div className="flex w-full items-center justify-center">
            <Image src="/icon.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" />
          </div>
        )}
      </div>

      {/* Primary navigation */}
      <nav
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-3"
        aria-label={t("accessibility.mainNavigation")}
      >
        {navItems.map((item) => {
          const Icon = NAV_ICON_MAP[item.id];
          const isActive = !isAdminRoute && activeItem.id === item.id;
          const href = item.id === "stores" && storesHref != null ? storesHref : item.href(locale);
          const storesHrefKind =
            item.id === "stores" ? (href.includes("?") ? "preference_filters" : "plain") : undefined;

          return (
            <Link
              key={item.id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring focus-visible:ring-offset-background flex h-10 items-center gap-3 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                isExpanded ? "px-3" : "w-full justify-center",
                isActive
                  ? "bg-accent/14 text-accent font-medium"
                  : "text-text-body hover:bg-foreground/15 hover:text-foreground",
              )}
              data-ph-event={POSTHOG_EVENTS.APP_SHELL.NAV_CLICKED}
              data-ph-props={JSON.stringify({
                destination: item.id,
                navigation_level: "primary",
                viewport: "desktop",
                ...(storesHrefKind != null && { stores_href_kind: storesHrefKind }),
              })}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              {isExpanded ? <span>{t(item.labelKey)}</span> : <span className="sr-only">{t(item.labelKey)}</span>}
            </Link>
          );
        })}

        {isAdmin && (
          <div
            role="group"
            className="border-border mt-2 flex flex-col gap-1 border-t pt-3"
            aria-label={tAdmin("nav.section")}
          >
            {isExpanded && (
              <p className="text-text-muted px-3 pb-1 text-xs font-medium tracking-wide uppercase">
                {tAdmin("nav.section")}
              </p>
            )}
            {getAdminNavItems().map((item) => {
              const Icon = ADMIN_ICON_MAP[item.id];
              const isActive = activeAdminId === item.id;

              return (
                <Link
                  key={item.id}
                  href={item.href(locale)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring focus-visible:ring-offset-background flex h-10 items-center gap-3 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                    isExpanded ? "px-3" : "w-full justify-center",
                    isActive
                      ? "bg-accent/14 text-accent font-medium"
                      : "text-text-body hover:bg-foreground/15 hover:text-foreground",
                  )}
                  data-ph-event={POSTHOG_EVENTS.APP_SHELL.NAV_CLICKED}
                  data-ph-props={JSON.stringify({
                    destination: item.id,
                    navigation_level: "admin",
                    viewport: "desktop",
                  })}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                  {isExpanded ? (
                    <span>{tAdmin(item.labelKey)}</span>
                  ) : (
                    <span className="sr-only">{tAdmin(item.labelKey)}</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Footer: user widget + collapse/expand toggle */}
      <div className="border-border flex flex-col gap-2 border-t px-2 py-2">
        {isExpanded ? (
          <>
            <ShellAccountMenu
              key={`desktop-account-${pathname ?? ""}`}
              locale={locale}
              user={currentUser}
              signOutLabel={signOutLabel}
              surface="desktop"
            />
            <div className="flex min-h-11 items-center justify-between px-1">
              <span className="text-text-muted text-sm">{expanded ? t("sidebar.collapse") : t("sidebar.expand")}</span>
              <IconButton
                Icon={expanded ? PanelLeftClose : PanelLeftOpen}
                variant="outline"
                aria-label={expanded ? t("sidebar.collapse") : t("sidebar.expand")}
                onClick={handleToggle}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
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
        )}
      </div>
    </aside>
  );
}
