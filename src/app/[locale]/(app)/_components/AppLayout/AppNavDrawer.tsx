"use client";

import { LayoutDashboard, Package, Settings, ShoppingBag, Store, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import IconButton from "@/components/core/IconButton";
import Logo from "@/components/core/Logo";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { getActiveNavItem, getPrivateAppNavItems, type NavItemId } from "./navigationConfig";

const NAV_ICON_MAP: Record<NavItemId, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  stores: Store,
  purchases: ShoppingBag,
  shipments: Package,
  settings: Settings,
};

const TABLET_BREAKPOINT_PX = 768;

function getViewportKind(): "mobile" | "tablet" {
  if (typeof window === "undefined") return "mobile";
  return window.innerWidth >= TABLET_BREAKPOINT_PX ? "tablet" : "mobile";
}

type AppNavDrawerProps = {
  locale: string;
  isOpen: boolean;
  onClose: () => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
};

export default function AppNavDrawer({ locale, isOpen, onClose, returnFocusRef }: AppNavDrawerProps) {
  const pathname = usePathname();
  const t = useTranslations("appLayout");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const navItems = getPrivateAppNavItems();
  const activeItem = getActiveNavItem(pathname ?? "");

  useEffect(() => {
    if (isOpen) {
      posthog.capture(POSTHOG_EVENTS.APP_SHELL.DRAWER_OPENED, {
        viewport: getViewportKind(),
        route: pathname ?? "",
      });
      closeButtonRef.current?.focus();
    }
  }, [isOpen, pathname]);

  const handleClose = () => {
    returnFocusRef.current?.focus();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      aria-hidden={!isOpen}
      role="dialog"
      aria-modal="true"
      aria-label={t("drawer.closeMenu")}
    >
      <button
        type="button"
        aria-label={t("drawer.closeMenu")}
        className={cn(
          "bg-background/80 absolute inset-0 backdrop-blur-sm transition-opacity duration-200 motion-reduce:duration-0",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={handleClose}
      />
      <aside
        className={cn(
          "border-border bg-surface absolute top-0 left-0 flex h-full w-80 max-w-[85vw] min-w-0 flex-col border-r shadow-lg transition-transform duration-200 motion-reduce:duration-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <div className="border-border flex shrink-0 items-center justify-between gap-2 border-b px-3 py-3">
            <Logo className="text-2xl" />
            <IconButton
              ref={closeButtonRef}
              Icon={X}
              variant="outline"
              size="sm"
              aria-label={t("drawer.closeMenu")}
              onClick={handleClose}
              className="shrink-0"
            />
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-2 py-3" aria-label="Main">
            {navItems.map((item) => {
              const Icon = NAV_ICON_MAP[item.id];
              const isActive = activeItem.id === item.id;
              const href = item.href(locale);
              return (
                <Link
                  key={item.id}
                  href={href}
                  onClick={handleClose}
                  className={cn(
                    "focus-visible:ring-ring focus-visible:ring-offset-background flex h-10 items-center gap-3 rounded-lg px-2.5 pr-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                    isActive ? "bg-primary/20 text-primary" : "text-text-body hover:bg-muted hover:text-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                  data-ph-event={POSTHOG_EVENTS.APP_SHELL.NAV_CLICKED}
                  data-ph-props={JSON.stringify({ destination: item.id, navigation_level: "primary" })}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </div>
  );
}
