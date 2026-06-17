import { Package, Plus, SearchX, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Button from "@/components/core/Button/Button";
import EmptyState from "@/components/modules/EmptyState";
import { ROUTES } from "@/lib/constants";

type DeliveryListEmptyStateProps = {
  locale: string;
  variant: "noDeliveries" | "noResults";
  /** Echoed search term for the filtered-empty copy. */
  searchTerm?: string;
  resetHref?: string;
};

export default async function DeliveryListEmptyState({
  locale,
  variant,
  searchTerm,
  resetHref,
}: DeliveryListEmptyStateProps) {
  const t = await getTranslations({ locale, namespace: "deliveries" });

  if (variant === "noResults") {
    return (
      <EmptyState
        appearance="card"
        headingAs="h2"
        icon={<SearchX width={28} height={28} />}
        iconTone="neutral"
        title={t("list.empty.noResults.title")}
        subtitle={
          searchTerm
            ? t.rich("list.empty.noResults.descriptionWithTerm", {
                term: searchTerm,
                strong: (chunks) => <strong>{chunks}</strong>,
              })
            : t("list.empty.noResults.description")
        }
        actions={
          <Button as="a" href={resetHref ?? `/${locale}${ROUTES.deliveries}?status=`} variant="ghost" size="md">
            {t("list.empty.noResults.cta")}
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      appearance="card"
      headingAs="h2"
      icon={<Truck width={28} height={28} />}
      iconTone="accent"
      title={t("list.empty.noDeliveries.title")}
      subtitle={t("list.empty.noDeliveries.description")}
      actions={
        <>
          <Button
            as="a"
            href={`/${locale}${ROUTES.deliveriesNew}`}
            variant="primary"
            size="md"
            leadingIcon={<Plus size={16} aria-hidden />}
          >
            {t("list.empty.noDeliveries.cta")}
          </Button>
          <Button
            as="a"
            href={`/${locale}${ROUTES.orders}`}
            variant="ghost"
            size="md"
            leadingIcon={<Package size={16} aria-hidden />}
          >
            {t("list.empty.noDeliveries.secondaryCta")}
          </Button>
        </>
      }
    />
  );
}
