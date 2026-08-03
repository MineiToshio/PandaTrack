import { PackageOpen, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Button from "@/components/core/Button/Button";
import EmptyState from "@/components/modules/EmptyState";
import { getIsAdmin, getSession } from "@/lib/auth/auth-server";
import { ROUTES } from "@/lib/constants";
import { getImageIntakeQuotaSnapshotCached } from "@/lib/data/imageIntake/imageIntakeQuotaQueries";
import OrderCreateMethodSelector from "@/components/modules/OrderCreateMethodSelector/OrderCreateMethodSelector";
import type { PhotoCounterSnapshot } from "./share/photoCounterContract";

type OrderListEmptyStateProps = {
  locale: string;
  variant: "noOrders" | "noResults";
  resetHref?: string;
};

export default async function OrderListEmptyState({ locale, variant, resetHref }: OrderListEmptyStateProps) {
  const t = await getTranslations({ locale, namespace: "orderListing" });
  const isNoOrders = variant === "noOrders";

  if (isNoOrders) {
    // Read only on the path that actually renders the selector, and through the request-scoped
    // memo the shell already primed, so the empty state costs no extra query in practice.
    const session = await getSession();
    const photoCounter: PhotoCounterSnapshot | null = session?.user?.id
      ? await getImageIntakeQuotaSnapshotCached(session.user.id, getIsAdmin(session))
      : null;

    // No orders yet: the single "Nuevo pedido" entry point renders inline as the two method
    // cards instead of a single CTA, so a brand-new account can reach an order from an image
    // without creating a store first.
    return (
      <EmptyState
        appearance="card"
        headingAs="h2"
        icon={<PackageOpen width={28} height={28} />}
        iconTone="accent"
        title={t("empty.noOrders.title")}
        subtitle={t("empty.noOrders.description")}
        actions={
          <OrderCreateMethodSelector
            presentation="inline"
            locale={locale}
            className="max-w-[26rem]"
            photoCounter={photoCounter}
          />
        }
      />
    );
  }

  const ctaHref = resetHref ?? `/${locale}${ROUTES.orders}`;

  return (
    <EmptyState
      appearance="card"
      headingAs="h2"
      icon={<SearchX width={28} height={28} />}
      iconTone="neutral"
      title={t("empty.noResults.title")}
      subtitle={t("empty.noResults.description")}
      actions={
        <Button as="a" href={ctaHref} variant="ghost" size="md">
          {t("empty.noResults.cta")}
        </Button>
      }
    />
  );
}
