import { useLocale, useTranslations } from "next-intl";
import { ROUTES } from "@/lib/constants";
import BrandMark from "./BrandMark";
import PublicLanguageToggle from "./PublicLanguageToggle";
import PublicThemeToggle from "./PublicThemeToggle";

/**
 * Slim public chrome for auth + legal surfaces (`.mk-minibar`):
 * brand (→ localized home) + language + theme. Server component; the toggles
 * are the only client islands.
 */
export default function PublicMinibar() {
  const locale = useLocale();
  const t = useTranslations("landing.header");

  return (
    <header className="mk-minibar">
      <div className="mk-container mk-minibar-inner">
        <BrandMark href={`/${locale}${ROUTES.home}`} ariaLabel={t("brandHome")} />
        <div className="mk-header-spacer" />
        <div className="mk-utils">
          <PublicLanguageToggle />
          <PublicThemeToggle />
        </div>
      </div>
    </header>
  );
}
