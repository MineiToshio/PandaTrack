"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/types/locale";

/**
 * Compact ES/EN language switch for public surfaces (`.mk-lang`). Current locale
 * is shown plain; the alternate is a real link that preserves the current path.
 */
export default function PublicLanguageToggle() {
  const pathname = usePathname();
  const locale = useLocale() as Locale;
  const t = useTranslations("common.languageToggle");

  const alternateLocale = (routing.locales.find((l) => l !== locale) ?? locale) as Locale;
  const alternateHref =
    pathname.replace(new RegExp(`^/${locale}(?=/|$)`), `/${alternateLocale}`) || `/${alternateLocale}`;

  return (
    <span className="mk-lang">
      {routing.locales.map((loc, index) => {
        const isCurrent = loc === locale;
        const label = loc === "en" ? t("en") : t("es");
        const ariaLabel = loc === "en" ? t("ariaEn") : t("ariaEs");

        return (
          <Fragment key={loc}>
            {index > 0 ? (
              <span className="sep" aria-hidden="true">
                /
              </span>
            ) : null}
            {isCurrent ? (
              <span className="is-cur" aria-current="true">
                {label}
              </span>
            ) : (
              <Link href={alternateHref} aria-label={ariaLabel}>
                {label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </span>
  );
}
