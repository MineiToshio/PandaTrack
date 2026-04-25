import { getTranslations } from "next-intl/server";
import { Package, Pencil, ShoppingBag } from "lucide-react";
import Typography from "@/components/core/Typography";
import SectionSurfaceCard from "@/components/modules/SectionSurfaceCard";
import { ROUTES } from "@/lib/constants";
import type { OrderItemWithDeliveryState } from "@/lib/data/orders/orderQueries";

type OrderItemsListProps = {
  orderId: string;
  items: OrderItemWithDeliveryState[];
  currencyCode: string;
  locale: string;
};

function formatMinorUnits(amount: number): string {
  return (amount / 100).toFixed(2);
}

export default async function OrderItemsList({ orderId, items, currencyCode, locale }: OrderItemsListProps) {
  const t = await getTranslations({ locale, namespace: "orders" });

  return (
    <SectionSurfaceCard
      title={t("detail.items.sectionTitle")}
      titleAs="h2"
      titleId="order-items-heading"
      icon={ShoppingBag}
      iconClassName="text-highlight"
      headerEnd={
        <a
          href={`/${locale}${ROUTES.purchases}/${orderId}/edit`}
          className="text-text-muted hover:text-text-body flex items-center gap-1 text-xs transition-colors duration-150"
          aria-label={t("detail.actions.edit")}
        >
          <Pencil className="size-3.5" aria-hidden />
          {t("detail.actions.edit")}
        </a>
      }
    >
      <section aria-labelledby="order-items-heading">
        {items.length === 0 ? (
          <div className="border-warning/30 bg-warning/10 text-warning flex items-start gap-2 rounded-xl border p-4 text-sm">
            <Package className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {t("detail.items.emptyWarning")}{" "}
              <a href={`/${locale}${ROUTES.purchases}/${orderId}/edit`} className="underline underline-offset-2">
                {t("detail.items.emptyWarningCta")}
              </a>
            </span>
          </div>
        ) : (
          <ul className="divide-border/50 -mx-1 divide-y" role="list">
            {items.map((item, i) => (
              <li key={item.id} className="order-item-animate py-0" style={{ animationDelay: `${i * 55}ms` }}>
                <div className="hover:bg-muted/40 mx-1 flex items-start gap-4 rounded-lg px-2 py-3 transition-colors duration-200 sm:gap-5">
                  <div className="w-0 max-w-xl min-w-0 flex-1 sm:max-w-2xl">
                    <Typography size="sm" className="text-text-body font-medium">
                      {item.name}
                    </Typography>
                    {item.productTypeKey && (
                      <Typography size="xs" className="text-text-muted capitalize">
                        {item.productTypeKey.replace(/_/g, " ")}
                      </Typography>
                    )}
                  </div>
                  <div className="text-text-muted flex shrink-0 flex-col items-end text-xs tabular-nums">
                    <span>{t("detail.items.quantity", { qty: item.quantity })}</span>
                    {item.unitPrice != null && (
                      <span>
                        {t("detail.items.unitPrice", {
                          price: `${currencyCode} ${formatMinorUnits(item.unitPrice)}`,
                        })}
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
