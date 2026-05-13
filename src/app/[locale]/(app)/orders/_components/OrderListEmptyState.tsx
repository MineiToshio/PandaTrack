import { PackageOpen, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Button from "@/components/core/Button/Button";
import { ROUTES } from "@/lib/constants";

type OrderListEmptyStateProps = {
  locale: string;
  variant: "noOrders" | "noResults";
  resetHref?: string;
};

export default async function OrderListEmptyState({ locale, variant, resetHref }: OrderListEmptyStateProps) {
  const t = await getTranslations({ locale, namespace: "orderListing" });
  const isNoOrders = variant === "noOrders";
  const Icon = isNoOrders ? PackageOpen : SearchX;
  const titleKey = isNoOrders ? "empty.noOrders.title" : "empty.noResults.title";
  const descKey = isNoOrders ? "empty.noOrders.description" : "empty.noResults.description";
  const ctaKey = isNoOrders ? "empty.noOrders.cta" : "empty.noResults.cta";
  const ctaHref = isNoOrders ? `/${locale}${ROUTES.ordersNew}` : (resetHref ?? `/${locale}${ROUTES.orders}`);

  return (
    <div className="flex flex-col items-center gap-4 rounded-[var(--radius-2xl)] px-6 py-10 text-center [background:var(--surface-elevated)] [border:1px_dashed_var(--border)]">
      <span
        aria-hidden
        className="inline-flex h-16 w-16 items-center justify-center rounded-full [color:var(--text-secondary)] [background:color-mix(in_oklch,var(--text-primary)_5%,transparent)]"
      >
        <Icon width={28} height={28} />
      </span>
      <h2 className="[font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
        {t(titleKey)}
      </h2>
      <p className="max-w-[40ch] [font-size:var(--text-body)] [color:var(--text-secondary)]">{t(descKey)}</p>
      <Button as="a" href={ctaHref} variant={isNoOrders ? "primary" : "ghost"} size="md">
        {t(ctaKey)}
      </Button>
    </div>
  );
}
