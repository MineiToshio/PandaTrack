"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import Input from "@/components/core/Input";
import { formatAmountWithSymbol } from "@/lib/currency";
import { formatArrivalWindow } from "@/lib/arrivalWindow";
import { formatDomainDate } from "@/lib/domainDate";
import { sanitizeDecimalInput } from "@/lib/decimalInput";
import { cn } from "@/lib/styles";
import type { AssignableOrder } from "@/lib/data/orders/storePaymentAssignableOrdersQueries";

type StorePaymentOrderAllocationRowProps = {
  order: AssignableOrder;
  locale: string;
  orderAmount: string;
  itemAmounts: Record<string, string>;
  itemSettled: Record<string, boolean>;
  isOrderOverAssignable: boolean;
  /** True when this order carries a declaration dated before the order's own date. */
  isDateBeforeOrder: boolean;
  itemErrors: ReadonlySet<string>;
  onOrderAmountChange: (orderId: string, raw: string) => void;
  onItemAmountChange: (orderId: string, itemId: string, raw: string) => void;
  onItemSettledToggle: (orderId: string, itemId: string) => void;
};

/**
 * One order's declaration block inside the store payment sheet's "¿A qué va este pago?" list: the
 * order's own header + amount field, and nested under it, one row per product with its own amount
 * field and a "Saldado" toggle that works without a price (`settlesTarget`).
 */
export default function StorePaymentOrderAllocationRow({
  order,
  locale,
  orderAmount,
  itemAmounts,
  itemSettled,
  isOrderOverAssignable,
  isDateBeforeOrder,
  itemErrors,
  onOrderAmountChange,
  onItemAmountChange,
  onItemSettledToggle,
}: StorePaymentOrderAllocationRowProps) {
  const t = useTranslations("orders.detail.storePayment");
  const arrivalWindow = formatArrivalWindow(order.expectedDeliveryFrom, order.expectedDeliveryTo, locale);

  return (
    <li className="rounded-xl px-3 py-2.5 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              "[font-size:var(--text-caption)] font-medium",
              isDateBeforeOrder ? "[color:var(--destructive)]" : "[color:var(--text-primary)]",
            )}
          >
            {formatDomainDate(order.orderDate, locale)}
          </p>
          <p className="[font-size:11px] [color:var(--text-muted)]">
            {arrivalWindow ? t("orderArrival", { window: arrivalWindow }) : t("orderArrivalUnknown")}
            {" · "}
            {t("orderAssignable", {
              amount: formatAmountWithSymbol(order.assignableMinor, order.currencyCode, locale),
            })}
          </p>
        </div>
        <div className="w-28 shrink-0">
          <Input
            aria-label={t("orderAmountAria", { date: formatDomainDate(order.orderDate, locale) })}
            type="text"
            inputMode="decimal"
            value={orderAmount}
            placeholder="0.00"
            error={isOrderOverAssignable}
            inputClassName="text-right"
            onChange={(event) =>
              onOrderAmountChange(order.orderId, sanitizeDecimalInput(event.target.value, order.currencyCode))
            }
          />
        </div>
      </div>

      {order.items.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5 border-l-2 [border-color:var(--border)] pl-3">
          {order.items.map((item) => {
            const remainingBaseMinor =
              item.basePagableMinor != null ? item.basePagableMinor - item.allocatedMinor : null;
            const isSettled = itemSettled[item.itemId] ?? false;
            const isOverBase = itemErrors.has(item.itemId);
            return (
              <li key={item.itemId} className="flex flex-wrap items-center justify-between gap-2 py-1">
                <div className="min-w-0">
                  <p className="truncate [font-size:var(--text-caption)] [color:var(--text-secondary)]">{item.name}</p>
                  <p className="[font-size:11px] [color:var(--text-muted)]">
                    {remainingBaseMinor != null
                      ? t("itemRemaining", {
                          amount: formatAmountWithSymbol(remainingBaseMinor, order.currencyCode, locale),
                        })
                      : t("itemRemainingUnknown")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <div className="w-24">
                    <Input
                      aria-label={t("itemAmountAria", { name: item.name })}
                      type="text"
                      inputMode="decimal"
                      value={itemAmounts[item.itemId] ?? ""}
                      placeholder="0.00"
                      error={isOverBase}
                      inputClassName="text-right"
                      onChange={(event) =>
                        onItemAmountChange(
                          order.orderId,
                          item.itemId,
                          sanitizeDecimalInput(event.target.value, order.currencyCode),
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    aria-pressed={isSettled}
                    aria-label={t("itemSettledAria", { name: item.name })}
                    onClick={() => onItemSettledToggle(order.orderId, item.itemId)}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 [font-size:11px] font-medium transition-colors",
                      isSettled
                        ? "[color:var(--success-chip-text)] [background:color-mix(in_oklch,var(--success)_14%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--success)_28%,transparent)]"
                        : "[color:var(--text-muted)] [border:1px_solid_var(--border)] hover:[color:var(--text-secondary)]",
                    )}
                  >
                    <Check size={11} aria-hidden />
                    {t("itemSettled")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
