import { getTranslations } from "next-intl/server";
import { Package } from "lucide-react";
import Typography from "@/components/core/Typography";
import SectionTitleWithAccent from "@/components/modules/SectionTitleWithAccent";
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
    <section aria-labelledby="order-items-heading" className="space-y-4">
      <SectionTitleWithAccent as="h2" id="order-items-heading">
        {t("detail.items.sectionTitle")}
      </SectionTitleWithAccent>

      {items.length === 0 ? (
        <div className="border-warning/30 bg-warning/10 text-warning flex items-start gap-2 rounded-xl border p-4 text-sm">
          <Package className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {t("detail.items.emptyWarning")}{" "}
            <a href={`${ROUTES.purchases}/${orderId}/edit`} className="underline underline-offset-2">
              {t("detail.items.emptyWarningCta")}
            </a>
          </span>
        </div>
      ) : (
        <ul className="divide-border/50 divide-y" role="list">
          {items.map((item) => (
            <li key={item.id} className="py-0">
              <div className="hover:bg-muted/50 mx-1 flex items-start gap-4 rounded-lg px-2 py-3 transition-colors duration-200 sm:gap-5">
                {/* Cap line width on wide viewports so qty/price sit near the name (not screen-far right). */}
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
  );
}
