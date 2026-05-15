"use client";

import { Plus, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import BackNavLink from "@/components/core/BackNavLink";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn } from "@/lib/styles";
import { AUTH_RETURN_TO_PARAM } from "@/lib/auth/authRedirect";
import { RETURN_TO_ORDER_CREATE, ROUTES } from "@/lib/constants";
import { useIsMobile } from "@/hooks/useIsMobile";

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

      <div
        className={cn(
          "rounded-[16px] [background:var(--surface-elevated)] [border:1px_solid_var(--border)]",
          "px-5 py-7 md:px-7 md:py-10",
          "flex flex-col items-center gap-3.5 text-center",
        )}
      >
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl",
            "[background:color-mix(in_oklch,var(--accent)_10%,transparent)]",
            "[color:var(--accent)]",
          )}
          aria-hidden
        >
          <Store size={22} />
        </div>
        <div className="space-y-1.5">
          <p className="text-[15px] font-semibold [color:var(--text-primary)]">
            {isMobile ? t("mobileTitle") : t("title")}
          </p>
          <p className="max-w-[44ch] text-[13px] leading-[1.5] [color:var(--text-muted)]">
            {isMobile ? t("mobileDescription") : t("description")}
          </p>
        </div>
        <Link
          href={createStoreHref}
          className={cn(buttonVariants({ variant: "primary", size: "md" }), "mt-2 inline-flex items-center gap-1.5")}
        >
          <Plus size={16} aria-hidden />
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
