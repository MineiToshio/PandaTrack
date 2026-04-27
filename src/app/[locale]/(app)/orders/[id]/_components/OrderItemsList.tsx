import { getTranslations } from "next-intl/server";
import { Package, ShoppingBag } from "lucide-react";
import Typography from "@/components/core/Typography";
import SectionSurfaceCard from "@/components/modules/SectionSurfaceCard";
import { ROUTES } from "@/lib/constants";
import { formatAmount } from "@/lib/currency";
import type { OrderItemWithDeliveryState } from "@/lib/data/orders/orderQueries";

type OrderItemsListProps = {
  orderId: string;
  items: OrderItemWithDeliveryState[];
  currencyCode: string;
  locale: string;
};

export default async function OrderItemsList({ orderId, items, currencyCode, locale }: OrderItemsListProps) {
  const t = await getTranslations({ locale, namespace: "orders" });

  const itemCount = items.length;
  const totalMinorUnits = items.reduce(
    (sum, item) => (item.unitPrice != null ? sum + item.quantity * item.unitPrice : sum),
    0,
  );
  const hasAnyPrice = items.some((item) => item.unitPrice != null);

  const headerEndNode =
    itemCount === 0 ? null : (
      <span className="flex items-baseline gap-1.5">
        <span className="text-text-muted text-xs tabular-nums">
          {t("detail.items.headerCount", { count: itemCount })}
        </span>
        {hasAnyPrice && (
          <span className="text-text-title text-sm font-semibold tabular-nums">
            {formatAmount(totalMinorUnits, currencyCode)}
          </span>
        )}
      </span>
    );

  return (
    <SectionSurfaceCard
      title={t("detail.items.sectionTitle")}
      titleAs="h2"
      titleId="order-items-heading"
      icon={ShoppingBag}
      iconClassName="text-highlight"
      headerEnd={headerEndNode}
    >
      <section aria-labelledby="order-items-heading">
        {items.length === 0 ? (
          <div className="border-warning/30 bg-warning/10 text-warning flex items-start gap-2 rounded-xl border p-4 text-sm">
            <Package className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {t("detail.items.emptyWarning")}{" "}
              <a href={`/${locale}${ROUTES.orders}/${orderId}/edit`} className="underline underline-offset-2">
                {t("detail.items.emptyWarningCta")}
              </a>
            </span>
          </div>
        ) : (
          <ul className="divide-border/50 -mx-1 divide-y" role="list">
            {items.map((item, i) => (
              <li key={item.id} className="order-item-animate py-0" style={{ animationDelay: `${i * 55}ms` }}>
                <div className="hover:bg-muted/40 mx-1 flex items-start gap-4 rounded-lg px-2 py-3 transition-colors duration-200 sm:gap-5">
                  {/* Left: name + status badge, then product type */}
                  <div className="w-0 max-w-xl min-w-0 flex-1 sm:max-w-2xl">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Typography size="sm" as="span" className="text-text-title font-medium">
                        {item.name}
                      </Typography>
                      {item.deliveryState === "in_transit" && (
                        <span className="border-primary/35 bg-primary/15 text-primary inline-flex items-center rounded-full border px-1.5 py-px text-xs font-medium">
                          {t("detail.items.statusInTransit")}
                        </span>
                      )}
                      {item.deliveryState === "delivered" && (
                        <span className="border-success/35 bg-success/15 text-success inline-flex items-center rounded-full border px-1.5 py-px text-xs font-medium">
                          {t("detail.items.statusDelivered")}
                        </span>
                      )}
                    </div>
                    {item.productTypeKey && (
                      <Typography size="xs" as="span" className="text-text-muted capitalize">
                        {item.productTypeKey.replace(/_/g, " ")}
                      </Typography>
                    )}
                  </div>

                  {/* Right: price total (prominent) + unit context */}
                  <div className="flex shrink-0 flex-col items-end tabular-nums">
                    {item.unitPrice != null ? (
                      <>
                        <span className="text-text-title text-sm font-bold">
                          {formatAmount(item.quantity * item.unitPrice, currencyCode)}
                        </span>
                        {item.quantity > 1 && (
                          <span className="text-text-muted text-xs">
                            {t("detail.items.unitContext", {
                              qty: item.quantity,
                              unit: formatAmount(item.unitPrice, currencyCode),
                            })}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-text-muted text-sm font-medium">
                        {t("detail.items.quantity", { qty: item.quantity })}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SectionSurfaceCard>
  );
}
