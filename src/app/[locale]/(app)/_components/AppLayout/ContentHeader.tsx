"use client";

import { ChevronRight, Menu } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getPageHeader } from "@/app/[locale]/(app)/_utils/pageHeader";
import LanguageToggle from "@/app/[locale]/(landing)/_components/Menu/LanguageToggle";
import ThemeToggle from "@/app/[locale]/(landing)/_components/Menu/ThemeToggle";
import SignOutButton from "@/components/modules/auth/SignOutButton";
import Heading from "@/components/core/Heading";
import IconButton from "@/components/core/IconButton";

type ContentHeaderProps = {
  locale: string;
  pathname: string;
  signOutLabel: string;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  burgerButtonRef: React.RefObject<HTMLButtonElement | null>;
};

export default function ContentHeader({
  locale,
  pathname,
  signOutLabel,
  drawerOpen,
  onOpenDrawer,
  burgerButtonRef,
}: ContentHeaderProps) {
  const t = useTranslations("appLayout");
  const pageHeader = getPageHeader(pathname, locale);
  const pageTitle = t(pageHeader.titleKey);

  return (
    <header className="border-border bg-background flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 sm:gap-4 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-initial lg:gap-4">
        <IconButton
          ref={burgerButtonRef}
          Icon={Menu}
          variant="outline"
          size="sm"
          aria-label={t("drawer.openMenu")}
          aria-expanded={drawerOpen}
          onClick={onOpenDrawer}
          className="shrink-0 lg:hidden"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
          {pageHeader.breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="flex min-w-0 shrink-0 items-center gap-1.5 text-sm">
              {pageHeader.breadcrumbs.map((crumb, index) => {
                const isLast = index === pageHeader.breadcrumbs.length - 1;
                const label = t(crumb.labelKey);
                return (
                  <span key={crumb.href} className="flex items-center gap-1.5">
                    {index > 0 && <ChevronRight className="text-text-muted h-4 w-4 shrink-0" aria-hidden />}
                    {isLast ? (
                      <span className="text-text-muted truncate" aria-current="page">
                        {label}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="text-link focus-visible:ring-ring focus-visible:ring-offset-background max-w-32 truncate rounded hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:max-w-48"
                      >
                        {label}
                      </Link>
                    )}
                  </span>
                );
              })}
            </nav>
          )}
          <Heading as="h1" size="xs" className="text-text-title min-w-0 truncate">
            {pageTitle}
          </Heading>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <LanguageToggle className="hidden sm:flex" />
        <ThemeToggle />
        <SignOutButton locale={locale} label={signOutLabel} />
      </div>
    </header>
  );
}
