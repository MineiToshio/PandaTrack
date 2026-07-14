"use client";

import { Languages } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { updateLanguageAction } from "@/app/[locale]/(app)/settings/_actions/preferencesActions";
import { cn } from "@/lib/styles";
import { routing } from "@/i18n/routing";
import { getPosthogDataAttributes } from "@/lib/analytics/posthogDataAttributes";
import type { Locale } from "@/types/locale";

type LangToggleProps = {
  className?: string;
  onNavigate?: () => void;
  ariaLabel?: string;
  posthogEvent?: string;
  getPosthogProps?: (targetLocale: Locale) => Record<string, unknown>;
};

/**
 * Compact mono-uppercase language toggle button. Visual contract: see the Velvet design system at `docs/design/` (`components.md`).
 * Single button that links to the same path under the alternate locale, displaying the CURRENT
 * locale code (so the user knows what they have, and clicking switches).
 */
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
  const alternateLabel = alternateLocale === "en" ? t("ariaEn") : t("ariaEs");
  const visibleLabel = locale === "en" ? t("en") : t("es");
  const dataAttrs = getPosthogDataAttributes(
    posthogEvent,
    getPosthogProps ? getPosthogProps(alternateLocale) : undefined,
  );

  // Best-effort: the stored language must follow what the user actually reads, but the
  // navigation owns the switch and must never wait on (or be broken by) the write.
  const handleClick = () => {
    void updateLanguageAction(alternateLocale).catch(() => {});
    onNavigate?.();
  };

  return (
    <Link
      href={alternateHref}
      onClick={handleClick}
      aria-label={ariaLabel ?? alternateLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-[8px] px-2 py-1 transition-colors",
        "[background:transparent] [border:1px_solid_var(--border)]",
        "[font-family:var(--font-mono)] [font-size:12px] [letter-spacing:0.04em]",
        "[color:var(--text-secondary)]",
        "hover:[color:var(--text-primary)] hover:[background:color-mix(in_oklch,var(--text-primary)_5%,transparent)]",
        "[outline:none] focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:2px]",
        className,
      )}
      {...dataAttrs}
    >
      <Languages size={12} aria-hidden="true" />
      {visibleLabel}
    </Link>
  );
}
