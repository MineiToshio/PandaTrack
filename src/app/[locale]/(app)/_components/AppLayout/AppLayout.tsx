"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ShellIdentityContext } from "@/contexts/ShellIdentityContext";
import { ToastProvider } from "@/contexts/ToastContext";
import Sidebar from "@/components/modules/Sidebar";
import Header from "@/components/modules/Header";
import MobileTabBar from "@/components/modules/MobileTabBar";
import MascotBubble, { MASCOT_HIDDEN_VALUE, MASCOT_VISIBLE_KEY } from "@/components/modules/MascotBubble";
import { useSidebarState } from "@/hooks/useSidebarState";
import { APP_SHELL_MAIN_CLASSNAME } from "@/lib/constants";
import { cn } from "@/lib/styles";
import { getFabAction } from "../../_utils/fabAction";
import AppNavDrawer from "./AppNavDrawer";
import { HeaderTitleProvider } from "./HeaderTitleContext";
import type { AppShellUserIdentity } from "./types";

type AppLayoutProps = {
  locale: string;
  signOutLabel: string;
  currentUser: AppShellUserIdentity;
  storesHref?: string;
  children: React.ReactNode;
};

export default function AppLayout({
  locale,
  signOutLabel,
  currentUser: initialUser,
  storesHref,
  children,
}: AppLayoutProps) {
  const pathname = usePathname();
  const { expanded, toggle, floatingOpen, setFloatingOpen } = useSidebarState();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const burgerButtonRef = useRef<HTMLButtonElement>(null);
  const [currentUser, setCurrentUser] = useState<AppShellUserIdentity>(initialUser);
  const [mascotVisible, setMascotVisible] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(MASCOT_VISIBLE_KEY) === MASCOT_HIDDEN_VALUE) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional client-only hydration from localStorage
        setMascotVisible(false);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const updateUser = useCallback((patch: Partial<AppShellUserIdentity>) => {
    setCurrentUser((prev) => ({ ...prev, ...patch }));
  }, []);

  // Content offset follows ONLY the pinned `expanded` state — hover-expand floats over content
  // (does not push). PUSH is reserved for the manual collapse/expand toggle.
  const sidebarCurrentW = expanded ? "var(--sidebar-w-expanded)" : "var(--sidebar-w-collapsed)";

  const fabAction = getFabAction(pathname ?? "", locale);

  const handleOpenDrawer = () => setDrawerOpen(true);
  const handleCloseDrawer = () => setDrawerOpen(false);

  return (
    <ShellIdentityContext.Provider value={{ user: currentUser, updateUser }}>
      <ToastProvider>
        {/* Shell root: carries --sidebar-current-w so all children can reference it */}
        <div
          className="flex min-h-screen flex-col"
          style={{ "--sidebar-current-w": sidebarCurrentW } as React.CSSProperties}
        >
          {/* Skip link */}
          <a
            href="#main-content"
            className="focus:bg-surface sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:rounded-lg focus:px-4 focus:py-2 focus:shadow-lg focus:outline-none"
          >
            Saltar al contenido
          </a>

          {/* Desktop sidebar — PUSH: width drives content offset via --sidebar-current-w */}
          <Sidebar
            locale={locale}
            currentUser={currentUser}
            signOutLabel={signOutLabel}
            expanded={expanded}
            onToggle={toggle}
            floatingOpen={floatingOpen}
            onFloatingChange={setFloatingOpen}
            storesHref={storesHref}
          />

          {/* Mobile nav drawer */}
          <AppNavDrawer
            locale={locale}
            currentUser={currentUser}
            signOutLabel={signOutLabel}
            isOpen={drawerOpen}
            onClose={handleCloseDrawer}
            returnFocusRef={burgerButtonRef}
            storesHref={storesHref}
          />

          {/* Content area: padded left on desktop to accommodate sidebar PUSH */}
          <div className="flex min-w-0 flex-1 flex-col transition-[padding-left] duration-[var(--motion-base)] ease-[var(--ease-out-expressive)] motion-reduce:transition-none lg:pl-[var(--sidebar-current-w)]">
            <HeaderTitleProvider>
              <Header
                locale={locale}
                pathname={pathname ?? ""}
                drawerOpen={drawerOpen}
                onOpenDrawer={handleOpenDrawer}
                burgerButtonRef={burgerButtonRef}
              />
              <main id="main-content" className={cn(APP_SHELL_MAIN_CLASSNAME, "max-lg:pb-[var(--mobile-tab-bar-h)]")}>
                {children}
              </main>
            </HeaderTitleProvider>
          </div>

          {/* Mobile bottom tab bar */}
          <MobileTabBar locale={locale} pathname={pathname ?? ""} fabAction={fabAction} storesHref={storesHref} />

          {/* Mascot bubble — idle variant, bottom-right corner */}
          <MascotBubble locale={locale} visible={mascotVisible} onHide={() => setMascotVisible(false)} />
        </div>
      </ToastProvider>
    </ShellIdentityContext.Provider>
  );
}
