import { Package, PackageX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import BackNavLink from "@/components/core/BackNavLink";
import Button from "@/components/core/Button/Button";
import { ROUTES } from "@/lib/constants";

type DeliveryCreateEmptyStateProps = {
  locale: string;
};

/**
 * Eligibility empty state (`#s9-delivery-create-empty`, FR-08-17): no store has a
 * single eligible product, so the wizard cannot start.
 */
export default async function DeliveryCreateEmptyState({ locale }: DeliveryCreateEmptyStateProps) {
  const t = await getTranslations({ locale, namespace: "deliveries" });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 lg:px-0">
      <BackNavLink href={`/${locale}${ROUTES.deliveries}`}>{t("create.backToDeliveries")}</BackNavLink>
      <h1 className="hidden text-[28px] leading-tight font-semibold [color:var(--text-primary)] md:block">
        {t("create.title")}
      </h1>
      <div className="flex flex-col items-center gap-1.5 rounded-[var(--radius-2xl)] px-6 py-14 text-center [background:var(--surface-elevated)] [border:1px_dashed_var(--border)]">
        <span
          aria-hidden
          className="mb-2 inline-flex h-16 w-16 items-center justify-center rounded-[20px] [color:var(--text-muted)] [background:color-mix(in_oklch,var(--accent)_8%,transparent)]"
        >
          <PackageX width={30} height={30} />
        </span>
        <h2 className="[font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
          {t("create.empty.title")}
        </h2>
        <p className="max-w-[48ch] [font-size:var(--text-body)] [color:var(--text-secondary)]">
          {t("create.empty.description")}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
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
        </div>
      </div>
    </div>
  );
}
