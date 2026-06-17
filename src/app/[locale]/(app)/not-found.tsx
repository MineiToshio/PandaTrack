import { Compass, Home } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import EmptyState from "@/components/modules/EmptyState";
import { ROUTES } from "@/lib/constants";

/**
 * 404 for the authenticated app shell (ADR 0013). A missing page is not an error — neutral tone,
 * no Sentry capture. Keeps the shell (sidebar + topbar); offers a way back to known ground.
 */
export default function AppNotFound() {
  const t = useTranslations("appLayout.notFound");
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
        <>
          <Button
            as="a"
            href={`/${locale}${ROUTES.dashboard}`}
            variant="primary"
            size="md"
            leadingIcon={<Home size={16} aria-hidden />}
          >
            {t("homeCta")}
          </Button>
          <Button as="a" href={`/${locale}${ROUTES.orders}`} variant="ghost" size="md">
            {t("ordersCta")}
          </Button>
        </>
      }
    />
  );
}
