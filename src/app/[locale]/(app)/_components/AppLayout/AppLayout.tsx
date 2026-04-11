"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AppNavDrawer from "./AppNavDrawer";
import AppSidebar from "./AppSidebar";
import ContentHeader from "./ContentHeader";
import { HeaderTitleProvider } from "./HeaderTitleContext";
import type { AppShellUserIdentity } from "./types";
import { useSidebarState } from "./useSidebarState";

const SIDEBAR_WIDTH_EXPANDED_REM = 16;
const SIDEBAR_RAIL_WIDTH_REM = 3.5;

type AppLayoutProps = {
  locale: string;
  signOutLabel: string;
  currentUser: AppShellUserIdentity;
  children: React.ReactNode;
};

export default function AppLayout({ locale, signOutLabel, currentUser, children }: AppLayoutProps) {
  const pathname = usePathname();
  const { expanded, toggle } = useSidebarState();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const burgerButtonRef = useRef<HTMLButtonElement>(null);

  const contentOffsetRem = expanded ? SIDEBAR_WIDTH_EXPANDED_REM : SIDEBAR_RAIL_WIDTH_REM;

  const handleOpenDrawer = () => setDrawerOpen(true);
  const handleCloseDrawer = () => setDrawerOpen(false);

  return (
    <div className="flex min-h-screen flex-col">
      <AppSidebar locale={locale} currentUser={currentUser} signOutLabel={signOutLabel} expanded={expanded} onToggle={toggle} />
      <AppNavDrawer
        locale={locale}
        currentUser={currentUser}
        signOutLabel={signOutLabel}
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        returnFocusRef={burgerButtonRef}
      />

      {/* Content area: offset on desktop (lg) so it starts after the sidebar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <style>{`
          @media (min-width: 1024px) {
            .app-layout-content {
              margin-left: ${contentOffsetRem}rem;
            }
          }
        `}</style>
        <div className="app-layout-content flex min-w-0 flex-1 flex-col transition-[margin-left] duration-200 ease-out motion-reduce:transition-none">
          <HeaderTitleProvider>
            <ContentHeader
              locale={locale}
              pathname={pathname ?? ""}
              drawerOpen={drawerOpen}
              onOpenDrawer={handleOpenDrawer}
              burgerButtonRef={burgerButtonRef}
            />
            <main className="flex min-w-0 flex-1 flex-col">{children}</main>
          </HeaderTitleProvider>
        </div>
      </div>
    </div>
  );
}
