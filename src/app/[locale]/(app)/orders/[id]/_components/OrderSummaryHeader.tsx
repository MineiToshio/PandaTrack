import { getTranslations } from "next-intl/server";
import { ArrowLeftRight, Calendar, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { STORE_HERO_META_PILL_CLASSNAME } from "@/app/[locale]/(app)/stores/_components/share/storePublicChipClassnames";
import { AUTH_RETURN_TO_PARAM } from "@/lib/auth/authRedirect";
import { cn } from "@/lib/styles";
import BackNavLink from "@/components/core/BackNavLink";
import AppPageHero from "@/components/modules/AppPageHero";
import { ROUTES } from "@/lib/constants";
import type { OrderDetailFull } from "@/lib/data/orders/orderQueries";
import OrderStatusBadge from "../../_components/share/OrderStatusBadge";
import OrderUnpaidPill from "../../_components/share/OrderUnpaidPill";
import OrderActionBar from "./OrderActionBar";

type OrderSummaryHeaderProps = {
  order: Pick<
    OrderDetailFull,
    | "id"
    | "humanReadableId"
    | "store"
    | "orderDate"
    | "expectedDeliveryFrom"
    | "expectedDeliveryTo"
    | "currencyCode"
    | "exchangeRate"
    | "status"
    | "hasUnpaidBalance"
    | "eligibility"
    | "flags"
  >;
  locale: string;
  baseCurrencyCode: string | null;
  backHref?: string | null;
  detailHref: string;
};

function formatDate(date: Date, locale: string) {
  return date.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

type MetaChipVariant = "orderDate" | "delivery" | "fx";

/** Icon tint only; pill surface matches store profile hero (`STORE_HERO_META_PILL_CLASSNAME`). */
const META_CHIP_ICON_CLASS: Record<MetaChipVariant, string> = {
  orderDate: "text-primary",
  delivery: "text-info",
  fx: "text-highlight",
};

const STORE_RETURN_LABEL_PARAM = "returnLabel";

export default async function OrderSummaryHeader({
  order,
  locale,
  baseCurrencyCode,
  backHref,
  detailHref,
}: OrderSummaryHeaderProps) {
  const t = await getTranslations({ locale, namespace: "orders" });

  const hasUnpaidAndCompleted = order.status === "COMPLETED" && order.hasUnpaidBalance;

  type MetaChip = { icon: LucideIcon; label: string; variant: MetaChipVariant };
  const metaItems: MetaChip[] = [];
  metaItems.push({
    icon: Calendar,
    variant: "orderDate",
    label: t("detail.metaOrderDate", { date: formatDate(order.orderDate, locale) }),
  });
  if (order.expectedDeliveryFrom && order.expectedDeliveryTo) {
    metaItems.push({
      icon: Truck,
      variant: "delivery",
      label: t("detail.metaDelivery", {
        from: formatDate(order.expectedDeliveryFrom, locale),
        to: formatDate(order.expectedDeliveryTo, locale),
      }),
    });
  } else if (order.expectedDeliveryFrom) {
    metaItems.push({
      icon: Truck,
      variant: "delivery",
      label: t("detail.metaDeliveryFrom", { from: formatDate(order.expectedDeliveryFrom, locale) }),
    });
  }
  if (order.exchangeRate && baseCurrencyCode && baseCurrencyCode !== order.currencyCode) {
    metaItems.push({
      icon: ArrowLeftRight,
      variant: "fx",
      label: t("detail.metaFxBadge", {
        from: order.currencyCode,
        rate: order.exchangeRate,
        to: baseCurrencyCode,
      }),
    });
  }

  const storeHref = `/${locale}${ROUTES.stores}/${order.store.slug}?${new URLSearchParams({
    [AUTH_RETURN_TO_PARAM]: detailHref,
    [STORE_RETURN_LABEL_PARAM]: order.humanReadableId,
  }).toString()}`;

  return (
    <div className="space-y-5">
      <BackNavLink href={backHref ?? `/${locale}${ROUTES.orders}`} appearance="pill">
        {t("detail.backToList")}
      </BackNavLink>

      <AppPageHero
        title={
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span>{order.store.name}</span>
            <span className="text-text-muted font-normal select-none" aria-hidden>
              ·
            </span>
            <span className="text-text-body font-mono font-medium tracking-tight">{order.humanReadableId}</span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            {hasUnpaidAndCompleted && <OrderUnpaidPill label={t("detail.unpaidPill")} />}
            {metaItems.map(({ icon: Icon, label, variant }, i) => (
              <span key={i} className={STORE_HERO_META_PILL_CLASSNAME}>
                <Icon className={cn("size-3.5 shrink-0", META_CHIP_ICON_CLASS[variant])} aria-hidden />
                {label}
              </span>
            ))}
          </span>
        }
        aside={
          <div className="w-full lg:w-auto">
            <OrderActionBar
              orderId={order.id}
              status={order.status}
              eligibility={order.eligibility}
              flags={order.flags}
              locale={locale}
              humanReadableId={order.humanReadableId}
              storeName={order.store.name}
              storeHref={storeHref}
              storeId={order.store.id}
              storeSlug={order.store.slug}
            />
          </div>
        }
      />
    </div>
  );
}
