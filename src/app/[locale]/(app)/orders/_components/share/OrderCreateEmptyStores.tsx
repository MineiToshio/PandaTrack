"use client";

import { Plus, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import BackNavLink from "@/components/core/BackNavLink";
import Button from "@/components/core/Button/Button";
import EmptyState from "@/components/modules/EmptyState";
import { AUTH_RETURN_TO_PARAM } from "@/lib/auth/authRedirect";
import { RETURN_TO_ORDER_CREATE, ROUTES } from "@/lib/constants";
import { useIsMobile } from "@/hooks/useIsMobile";

/**
 * Gating empty state for order creation when the user has no stores yet (a store is required
 * to record an order). Consolidated onto the canonical `<EmptyState appearance="card">` — same
 * shape as `DeliveryCreateEmptyState`.
 */
export default function OrderCreateEmptyStores() {
  const t = useTranslations("orders.create.emptyStores");
  const tCreate = useTranslations("orders.create");
  const locale = useLocale();
  const isMobile = useIsMobile();

  const ordersHref = `/${locale}${ROUTES.orders}`;
  const createStoreHref = `/${locale}${ROUTES.storesNew}?${AUTH_RETURN_TO_PARAM}=${RETURN_TO_ORDER_CREATE}`;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <BackNavLink href={ordersHref}>{tCreate("backToList")}</BackNavLink>

      <h1 className="hidden text-[28px] leading-tight font-semibold [color:var(--text-primary)] md:block">
        {tCreate("title")}
      </h1>

      <EmptyState
        appearance="card"
        headingAs="h2"
        icon={<Store width={28} height={28} />}
        iconTone="accent"
        title={isMobile ? t("mobileTitle") : t("title")}
        subtitle={isMobile ? t("mobileDescription") : t("description")}
        actions={
          <Button
            as="a"
            href={createStoreHref}
            variant="primary"
            size="md"
            leadingIcon={<Plus size={16} aria-hidden />}
          >
            {t("cta")}
          </Button>
        }
      />
    </div>
  );
}
