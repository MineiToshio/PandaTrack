"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import LanguageToggle from "@/app/[locale]/(landing)/_components/Menu/LanguageToggle";
import ThemeToggle from "@/app/[locale]/(landing)/_components/Menu/ThemeToggle";
import SignOutButton from "@/components/modules/auth/SignOutButton";
import Heading from "@/components/core/Heading";
import IconButton from "@/components/core/IconButton";
import { getActiveNavItem } from "./navigationConfig";

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
  const activeItem = getActiveNavItem(pathname);
  const pageTitle = t(activeItem.labelKey);

  return (
    <header className="border-border bg-background flex min-h-14 shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:gap-4 lg:px-6">
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
        <Heading as="h1" size="xs" className="text-text-title min-w-0 truncate">
          {pageTitle}
        </Heading>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <LanguageToggle className="hidden sm:flex" />
        <ThemeToggle />
        <SignOutButton locale={locale} label={signOutLabel} />
      </div>
    </header>
  );
}
