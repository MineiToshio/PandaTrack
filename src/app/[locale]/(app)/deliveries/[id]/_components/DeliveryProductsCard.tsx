"use client";

import Link from "next/link";
import { Boxes, Package } from "lucide-react";
import { useTranslations } from "next-intl";
import CollapsibleSubcard from "@/components/modules/CollapsibleSubcard";
import Eyebrow from "@/components/core/Eyebrow";
import StatusChip from "@/components/core/StatusChip";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { formatDomainDate } from "@/lib/domainDate";
import { ROUTES } from "@/lib/constants";
import type { DeliveryStatus } from "../../../../../../../generated/prisma/client";
import type { DeliveryDetailSourceOrderGroup } from "@/lib/data/deliveries/deliveryQueries";

type DeliveryProductsCardProps = {
  sourceOrders: DeliveryDetailSourceOrderGroup[];
  /** Live (optimistic) delivery status — drives every per-item state chip. */
  status: DeliveryStatus;
  productCount: number;
  locale: string;
};

/** Per-item state mirrors the delivery lifecycle (spec §3). */
function itemStateForStatus(status: DeliveryStatus): "IN_TRANSIT" | "DELIVERED" | "ARRIVED_AT_STORE" {
  if (status === "DELIVERED") return "DELIVERED";
  if (status === "CANCELLED") return "ARRIVED_AT_STORE";
  return "IN_TRANSIT";
}

function formatDate(date: Date, locale: string) {
  return formatDomainDate(date, locale);
}

export default function DeliveryProductsCard({
  sourceOrders,
  status,
  productCount,
  locale,
}: DeliveryProductsCardProps) {
  const t = useTranslations("deliveries");
  const itemState = itemStateForStatus(status);

  return (
    <CollapsibleSubcard
      eyebrow={
        <Eyebrow variant="chip" tone="cool" icon={Boxes}>
          {t("detail.products.title")}
        </Eyebrow>
      }
      meta={productCount}
      topAccent="cool"
      defaultOpen
    >
      <div className="flex flex-col">
        {sourceOrders.map((group, groupIdx) => (
          <div key={group.orderId} className={groupIdx > 0 ? "mt-3.5" : undefined}>
            {/* "DESDE ORD-… · {fecha}" — mono uppercase label, ORD code links to the order
                detail (traceability lives here, not in the list). */}
            <div className="text-text-muted mb-1.5 flex items-center gap-1.5 text-[11px] tracking-[0.06em] uppercase">
              <Package className="size-3 shrink-0" aria-hidden />
              <span>
                {t("detail.products.fromOrder")}{" "}
                <Link
                  href={`/${locale}${ROUTES.orders}/${group.orderId}`}
                  className="text-accent font-mono normal-case hover:underline"
                >
                  {group.orderHumanReadableId}
                </Link>{" "}
                · {formatDate(group.orderDate, locale)}
              </span>
            </div>
            <ul role="list" className="flex flex-col">
              {group.items.map((item, idx) => {
                const ItemIcon = getStoreProductTypeIcon(item.productTypeKey ?? "");
                const isLast = idx === group.items.length - 1;
                return (
                  <li
                    key={item.id}
                    className={`grid [grid-template-columns:32px_minmax(0,1fr)_50px] items-center gap-3 py-2 ${
                      !isLast ? "[border-bottom:1px_solid_var(--border)]" : ""
                    }`}
                  >
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] [color:var(--accent-cool)] [background:color-mix(in_oklch,var(--accent-cool)_10%,transparent)]"
                      aria-hidden
                    >
                      <ItemIcon width={14} height={14} />
                    </span>
                    <div className="flex min-w-0 flex-col items-start gap-1">
                      <span className="w-full min-w-0 truncate [font-size:var(--text-body)] [color:var(--text-primary)]">
                        {item.name}
                      </span>
                      <StatusChip kind="itemDeliveryState" value={itemState} size="sm" />
                    </div>
                    <span className="text-right [font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
                      {t("list.card.itemQuantity", { quantity: item.quantity })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </CollapsibleSubcard>
  );
}
