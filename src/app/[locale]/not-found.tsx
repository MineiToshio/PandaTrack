import { Compass, Home } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import EmptyState from "@/components/modules/EmptyState";

/**
 * Root 404 for any unmatched URL under `/[locale]` — including public/anonymous routes
 * after the S11 go-live. The `(app)` segment keeps its own not-found for in-shell
 * `notFound()` calls; this one is the fallback so a mistyped public URL stays on-brand
 * (Velvet, localized) instead of falling through to Next's default 404. Neutral tone,
 * no Sentry capture — a missing page is not an error (ADR 0013).
 */
export default function LocaleNotFound() {
  const t = useTranslations("common.notFound");
  const locale = useLocale();

  return (
    <EmptyState
      appearance="page"
      headingAs="h1"
      iconTone="neutral"
      icon={<Compass width={32} height={32} aria-hidden />}
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("description")}
      actions={
        <Button as="a" href={`/${locale}`} variant="primary" size="md" leadingIcon={<Home size={16} aria-hidden />}>
          {t("homeCta")}
        </Button>
      }
    />
  );
}
