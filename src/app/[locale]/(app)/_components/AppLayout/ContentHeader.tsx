"use client";

import { useTranslations } from "next-intl";
import LanguageToggle from "@/app/[locale]/(landing)/_components/Menu/LanguageToggle";
import ThemeToggle from "@/app/[locale]/(landing)/_components/Menu/ThemeToggle";
import SignOutButton from "@/components/modules/auth/SignOutButton";
import Heading from "@/components/core/Heading";
import { getActiveNavItem } from "./navigationConfig";

type ContentHeaderProps = {
  locale: string;
  pathname: string;
  signOutLabel: string;
};

export default function ContentHeader({ locale, pathname, signOutLabel }: ContentHeaderProps) {
  const t = useTranslations("appLayout");
  const activeItem = getActiveNavItem(pathname);
  const pageTitle = t(activeItem.labelKey);

  return (
    <header className="border-border bg-background flex min-h-[3.5rem] shrink-0 items-center justify-between gap-4 border-b px-4 py-3 lg:px-6">
      <Heading as="h1" size="xs" className="text-text-title truncate">
        {pageTitle}
      </Heading>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <LanguageToggle className="hidden sm:flex" />
        <ThemeToggle />
        <SignOutButton locale={locale} label={signOutLabel} />
      </div>
    </header>
  );
}
