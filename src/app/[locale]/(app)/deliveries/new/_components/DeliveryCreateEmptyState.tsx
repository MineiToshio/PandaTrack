import { Package, PackageX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import BackNavLink from "@/components/core/BackNavLink";
import Button from "@/components/core/Button/Button";
import EmptyState from "@/components/modules/EmptyState";
import { ROUTES } from "@/lib/constants";

type DeliveryCreateEmptyStateProps = {
  locale: string;
};

/**
 * Eligibility empty state (`#s9-delivery-create-empty`): no store has a
 * single eligible product, so the wizard cannot start.
 */
export default async function DeliveryCreateEmptyState({ locale }: DeliveryCreateEmptyStateProps) {
  const t = await getTranslations({ locale, namespace: "deliveries" });

  // Width + horizontal padding come from the shell `<main>` (APP_SHELL_MAIN_CLASSNAME).
  return (
    <div className="space-y-4">
      <BackNavLink href={`/${locale}${ROUTES.deliveries}`}>{t("create.backToDeliveries")}</BackNavLink>
      <h1 className="hidden text-[28px] leading-tight font-semibold [color:var(--text-primary)] md:block">
        {t("create.title")}
      </h1>
      <EmptyState
        appearance="card"
        headingAs="h2"
        icon={<PackageX width={28} height={28} />}
        iconTone="accent"
        title={t("create.empty.title")}
        subtitle={t("create.empty.description")}
        actions={
          <>
            <Button
              as="a"
              href={`/${locale}${ROUTES.orders}`}
              variant="primary"
              size="md"
              leadingIcon={<Package size={16} aria-hidden />}
            >
              {t("create.empty.cta")}
            </Button>
            <Button as="a" href={`/${locale}${ROUTES.deliveries}`} variant="ghost" size="md">
              {t("create.empty.secondaryCta")}
            </Button>
          </>
        }
      />
    </div>
  );
}
