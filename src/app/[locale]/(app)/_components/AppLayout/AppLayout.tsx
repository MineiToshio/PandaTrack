"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AppNavDrawer from "./AppNavDrawer";
import AppSidebar from "./AppSidebar";
import ContentHeader from "./ContentHeader";
import { useSidebarState } from "./useSidebarState";

const SIDEBAR_WIDTH_EXPANDED_REM = 16;
const SIDEBAR_RAIL_WIDTH_REM = 3.5;

type AppLayoutProps = {
  locale: string;
  signOutLabel: string;
  children: React.ReactNode;
};

export default function AppLayout({ locale, signOutLabel, children }: AppLayoutProps) {
  const pathname = usePathname();
  const { expanded, toggle } = useSidebarState();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const burgerButtonRef = useRef<HTMLButtonElement>(null);

  const contentOffsetRem = expanded ? SIDEBAR_WIDTH_EXPANDED_REM : SIDEBAR_RAIL_WIDTH_REM;

  const handleOpenDrawer = () => setDrawerOpen(true);
  const handleCloseDrawer = () => setDrawerOpen(false);

  return (
    <div className="flex min-h-screen flex-col">
      <AppSidebar locale={locale} expanded={expanded} onToggle={toggle} />
      <AppNavDrawer locale={locale} isOpen={drawerOpen} onClose={handleCloseDrawer} returnFocusRef={burgerButtonRef} />

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
          <ContentHeader
            locale={locale}
            pathname={pathname ?? ""}
            signOutLabel={signOutLabel}
            drawerOpen={drawerOpen}
            onOpenDrawer={handleOpenDrawer}
            burgerButtonRef={burgerButtonRef}
          />
          <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        </div>
      </div>
    </div>
  );
}
