"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/styles";
import { routing } from "@/i18n/routing";
import { getPosthogDataAttributes } from "@/lib/analytics/posthogDataAttributes";
import type { Locale } from "@/types/locale";

const MIN_TOUCH_TARGET_PX = 44;

type LangToggleProps = {
  className?: string;
  onNavigate?: () => void;
  ariaLabel?: string;
  posthogEvent?: string;
  getPosthogProps?: (targetLocale: Locale) => Record<string, unknown>;
};

export default function LangToggle({
  className,
  onNavigate,
  ariaLabel,
  posthogEvent,
  getPosthogProps,
}: LangToggleProps) {
  const pathname = usePathname();
  const locale = useLocale() as Locale;
  const t = useTranslations("common.languageToggle");

  const alternateLocale = (routing.locales.find((l) => l !== locale) ?? locale) as Locale;
  const alternateHref =
    pathname.replace(new RegExp(`^/${locale}(?=/|$)`), `/${alternateLocale}`) || `/${alternateLocale}`;

  return (
    <nav
      aria-label={ariaLabel ?? t("label")}
      className={cn("font-secondary text-text-body flex items-center gap-0.5 text-sm", className)}
    >
      {routing.locales.map((loc, index) => {
        const isCurrent = loc === locale;
        const label = loc === "en" ? t("en") : t("es");
        const localeAriaLabel = loc === "en" ? t("ariaEn") : t("ariaEs");
        const posthogDataAttributes = getPosthogDataAttributes(
          posthogEvent,
          getPosthogProps ? getPosthogProps(loc as Locale) : undefined,
        );

        return (
          <span key={loc} className="flex items-center gap-0.5">
            {index > 0 ? (
              <span aria-hidden className="text-text-muted px-0.5">
                |
              </span>
            ) : null}
            {isCurrent ? (
              <span
                aria-current="true"
                className="text-foreground flex items-center justify-center py-2 font-semibold"
                style={{ minHeight: MIN_TOUCH_TARGET_PX, minWidth: MIN_TOUCH_TARGET_PX }}
              >
                {label}
              </span>
            ) : (
              <Link
                href={alternateHref}
                aria-label={localeAriaLabel}
                onClick={onNavigate}
                className="hover:text-text-title focus-visible:ring-ring focus-visible:ring-offset-background flex items-center justify-center rounded-md py-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                style={{ minHeight: MIN_TOUCH_TARGET_PX, minWidth: MIN_TOUCH_TARGET_PX }}
                {...posthogDataAttributes}
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
