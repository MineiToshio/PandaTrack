"use client";

import { ChevronRight, Menu } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getPageHeader, type BreadcrumbItem } from "@/app/[locale]/(app)/_utils/pageHeader";
import { useHeaderTitle } from "./HeaderTitleContext";
import LanguageToggle from "@/app/[locale]/(landing)/_components/Menu/LanguageToggle";
import ThemeToggle from "@/app/[locale]/(landing)/_components/Menu/ThemeToggle";
import IconButton from "@/components/core/IconButton";
import { APP_SHELL_CONTENT_MAX_WIDTH_CLASSNAME, POSTHOG_EVENTS } from "@/lib/constants";
import { cn } from "@/lib/styles";

type ContentHeaderProps = {
  locale: string;
  pathname: string;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  burgerButtonRef: React.RefObject<HTMLButtonElement | null>;
};

type DisplayBreadcrumb =
  | { kind: "i18n"; href: string; labelKey: string }
  | { kind: "literal"; href: string; label: string };

function toDisplayBreadcrumbs(
  items: BreadcrumbItem[],
  afterFirst: { label: string; href: string } | null,
): DisplayBreadcrumb[] {
  if (items.length === 0) return [];
  const first: DisplayBreadcrumb = { kind: "i18n", href: items[0].href, labelKey: items[0].labelKey };
  if (!afterFirst) {
    return [first, ...items.slice(1).map((b) => ({ kind: "i18n" as const, href: b.href, labelKey: b.labelKey }))];
  }
  return [
    first,
    { kind: "literal", href: afterFirst.href, label: afterFirst.label },
    ...items.slice(1).map((b) => ({ kind: "i18n" as const, href: b.href, labelKey: b.labelKey })),
  ];
}

export default function ContentHeader({
  locale,
  pathname,
  drawerOpen,
  onOpenDrawer,
  burgerButtonRef,
}: ContentHeaderProps) {
  const t = useTranslations("appLayout");
  const { title: titleOverride, breadcrumbAfterStores } = useHeaderTitle();
  const pageHeader = getPageHeader(pathname, locale);
  const displayBreadcrumbs = toDisplayBreadcrumbs(pageHeader.breadcrumbs, breadcrumbAfterStores);
  const pageTitle = titleOverride ?? t(pageHeader.titleKey);
  const appShellBreadcrumbLabel = t("accessibility.breadcrumbNavigation");
  const appShellLanguageLabel = t("accessibility.languageNavigation");

  return (
    <header className="border-border bg-background/95 supports-backdrop-filter:bg-background/85 sticky top-(--app-banner-offset,0px) z-40 shrink-0 border-b backdrop-blur">
      <div
        className={cn(
          "mx-auto flex h-14 w-full items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8",
          APP_SHELL_CONTENT_MAX_WIDTH_CLASSNAME,
        )}
      >
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
          <div className="flex min-w-0 flex-1 flex-row items-center gap-1.5 sm:gap-2">
            {displayBreadcrumbs.length > 0 && (
              <>
                <nav
                  aria-label={appShellBreadcrumbLabel}
                  className="flex max-w-[min(11rem,45%)] shrink-0 items-center gap-1.5 text-sm sm:max-w-none"
                >
                  {displayBreadcrumbs.map((crumb, index) => {
                    const label = crumb.kind === "i18n" ? t(crumb.labelKey) : crumb.label;
                    const key = `${crumb.href}-${index}`;
                    return (
                      <span key={key} className="flex min-w-0 items-center gap-1.5">
                        {index > 0 && <ChevronRight className="text-text-muted h-4 w-4 shrink-0" aria-hidden />}
                        <Link
                          href={crumb.href}
                          className="text-link focus-visible:ring-ring focus-visible:ring-offset-background min-w-0 truncate rounded hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:max-w-48"
                        >
                          {label}
                        </Link>
                      </span>
                    );
                  })}
                </nav>
                <ChevronRight className="text-text-muted h-4 w-4 shrink-0" aria-hidden />
              </>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-text-title truncate text-lg leading-tight font-semibold tracking-tighter">
                {pageTitle}
              </p>
            </div>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:gap-3 lg:flex">
          <LanguageToggle
            ariaLabel={appShellLanguageLabel}
            posthogEvent={POSTHOG_EVENTS.APP_SHELL.LOCALE_CHANGED}
            getPosthogProps={(targetLocale) => ({
              locale: targetLocale,
              route: pathname,
            })}
          />
          <ThemeToggle posthogEvent={POSTHOG_EVENTS.APP_SHELL.THEME_CHANGED} posthogProps={{ route: pathname }} />
        </div>
      </div>
    </header>
  );
}
