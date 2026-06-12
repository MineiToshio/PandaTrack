import { Package, Plus, SearchX, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Button from "@/components/core/Button/Button";
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
      <div className="flex flex-col items-center gap-1.5 rounded-[var(--radius-2xl)] px-6 py-12 text-center [background:var(--surface-elevated)] [border:1px_dashed_var(--border)]">
        <span
          aria-hidden
          className="mb-1.5 inline-flex h-14 w-14 items-center justify-center rounded-[18px] [color:var(--text-muted)] [background:color-mix(in_oklch,var(--accent)_8%,transparent)]"
        >
          <SearchX width={26} height={26} />
        </span>
        <h2 className="[font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
          {t("list.empty.noResults.title")}
        </h2>
        <p className="max-w-[40ch] [font-size:var(--text-body)] [color:var(--text-secondary)]">
          {searchTerm
            ? t.rich("list.empty.noResults.descriptionWithTerm", {
                term: searchTerm,
                strong: (chunks) => <strong>{chunks}</strong>,
              })
            : t("list.empty.noResults.description")}
        </p>
        <Button
          as="a"
          href={resetHref ?? `/${locale}${ROUTES.deliveries}?status=`}
          variant="ghost"
          size="md"
          className="mt-3.5"
        >
          {t("list.empty.noResults.cta")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-[var(--radius-2xl)] px-6 py-14 text-center [background:var(--surface-elevated)] [border:1px_dashed_var(--border)]">
      <span
        aria-hidden
        className="mb-2 inline-flex h-16 w-16 items-center justify-center rounded-[20px] [color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_10%,transparent)]"
      >
        <Truck width={30} height={30} />
      </span>
      <h2 className="[font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
        {t("list.empty.noDeliveries.title")}
      </h2>
      <p className="max-w-[46ch] [font-size:var(--text-body)] [color:var(--text-secondary)]">
        {t("list.empty.noDeliveries.description")}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
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
      </div>
    </div>
  );
}
