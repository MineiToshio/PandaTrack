"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleDollarSign, RotateCcw, Truck } from "lucide-react";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { formatAmount } from "@/lib/currency";
import type { OrderStatus } from "../../../../../../../generated/prisma/client";
import { reactivateOrderAction } from "../_actions/orderLifecycleActions";

type OrderDetailStickyActionBarProps = {
  orderId: string;
  status: OrderStatus;
  isOverdue: boolean;
  remainingAmount: number;
  currencyCode: string;
  hasUnpaidBalance: boolean;
  /** False once every product is in a delivery or already delivered — see `hasStickyBarActions`. */
  canCreateDelivery: boolean;
  locale: string;
  onAnnotatePayment: () => void;
};

export type StickyBarActionContext = {
  status: OrderStatus;
  hasUnpaidBalance: boolean;
  remainingAmount: number;
  canCreateDelivery: boolean;
};

/**
 * Whether the bar still has anything to offer. Exported because the detail also reserves scroll
 * space for the bar, and that spacer has to disappear with it: a fully paid, fully delivered order
 * has no mobile action left, and reserving 76px for a bar that never renders leaves dead space.
 */
export function hasStickyBarActions({
  status,
  hasUnpaidBalance,
  remainingAmount,
  canCreateDelivery,
}: StickyBarActionContext): boolean {
  if (status === "CANCELLED") return true; // reactivate
  if (status === "COMPLETED" && hasUnpaidBalance) return true; // settle the balance
  // Fully paid: creating a delivery is the only action this branch offers.
  if (remainingAmount === 0) return canCreateDelivery;
  return true; // still owing → "Anotar pago" is always available
}

export default function OrderDetailStickyActionBar({
  orderId,
  status,
  isOverdue,
  remainingAmount,
  currencyCode,
  hasUnpaidBalance,
  canCreateDelivery,
  locale,
  onAnnotatePayment,
}: OrderDetailStickyActionBarProps) {
  const t = useTranslations("orders");
  const router = useRouter();
  const [isReactivating, setIsReactivating] = useState(false);

  const isCancelled = status === "CANCELLED";
  const isCompleted = status === "COMPLETED";
  const completedUnpaid = isCompleted && hasUnpaidBalance;
  // Active + already fully paid → the "Anotar pago" button is meaningless. Hide it and
  // promote "Crear entrega" to the full-width primary slot. The desktop aside already
  // gates its own "Anotar pago" via `canAddPayment = !isCancelled && !isFullyPaid` —
  // this brings the mobile sticky bar to parity.
  const isFullyPaid = remainingAmount === 0;

  async function handleReactivate() {
    setIsReactivating(true);
    const result = await reactivateOrderAction(orderId);
    if (result.ok) router.refresh();
    setIsReactivating(false);
  }

  const primaryBtnClass =
    "bg-primary text-primary-foreground hover:bg-primary/90 inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-sm transition-colors";
  const tonalBtnClass =
    "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors";

  // Nothing left to do on this order from a phone (typically fully paid and fully delivered):
  // render no bar at all rather than a strip whose only action leads to an empty wizard.
  if (!hasStickyBarActions({ status, hasUnpaidBalance, remainingAmount, canCreateDelivery })) {
    return null;
  }

  let content: React.ReactNode;

  if (isCancelled) {
    content = (
      <button
        type="button"
        onClick={handleReactivate}
        disabled={isReactivating}
        className={cn(primaryBtnClass, "w-full")}
        data-ph-event={POSTHOG_EVENTS.ORDER.STICKY_BAR_PRIMARY_CLICKED}
        data-ph-props={JSON.stringify({ orderId, action: "reactivate" })}
      >
        <RotateCcw className="size-4 shrink-0" aria-hidden />
        {isReactivating ? "…" : t("detail.stickyBar.reactivate")}
      </button>
    );
  } else if (completedUnpaid) {
    content = (
      <button
        type="button"
        onClick={onAnnotatePayment}
        className={cn(primaryBtnClass, "w-full")}
        data-ph-event={POSTHOG_EVENTS.ORDER.STICKY_BAR_PRIMARY_CLICKED}
        data-ph-props={JSON.stringify({ orderId, action: "settle" })}
      >
        <CircleDollarSign className="size-4 shrink-0" aria-hidden />
        {t("detail.stickyBar.settle", { amount: formatAmount(remainingAmount, currencyCode) })}
      </button>
    );
  } else if (isFullyPaid) {
    // Fully paid → drop the payment action; "Crear entrega" takes the full-width slot.
    // Use the long label ("Crear entrega") even on overdue, since the compact "Entrega"
    // is meant for the two-button layout where space is constrained.
    content = (
      <Link
        href={`/${locale}${ROUTES.deliveriesNew}?sourceOrderId=${orderId}`}
        className={cn(primaryBtnClass, "w-full")}
        data-ph-event={POSTHOG_EVENTS.ORDER.CREATE_DELIVERY_CLICKED}
        data-ph-props={JSON.stringify({ orderId, status })}
      >
        <Truck className="size-4 shrink-0" aria-hidden />
        {t("detail.stickyBar.createDelivery")}
      </Link>
    );
  } else {
    const primaryLabel = isOverdue ? t("detail.stickyBar.payRemaining") : t("detail.stickyBar.annotatePayment");
    const secondaryLabel = isOverdue ? t("detail.stickyBar.delivery") : t("detail.stickyBar.createDelivery");
    content = (
      <>
        {canCreateDelivery && (
          <Link
            href={`/${locale}${ROUTES.deliveriesNew}?sourceOrderId=${orderId}`}
            className={tonalBtnClass}
            data-ph-event={POSTHOG_EVENTS.ORDER.CREATE_DELIVERY_CLICKED}
            data-ph-props={JSON.stringify({ orderId, status })}
          >
            <Truck className="size-4 shrink-0" aria-hidden />
            {secondaryLabel}
          </Link>
        )}
        <button
          type="button"
          onClick={onAnnotatePayment}
          className={primaryBtnClass}
          data-ph-event={POSTHOG_EVENTS.ORDER.STICKY_BAR_PRIMARY_CLICKED}
          data-ph-props={JSON.stringify({ orderId, action: "annotate-payment" })}
          aria-keyshortcuts="P"
        >
          <CircleDollarSign className="size-4 shrink-0" aria-hidden />
          {primaryLabel}
        </button>
      </>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label={t("detail.stickyBar.ariaLabel")}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 lg:hidden",
        "border-border bg-surface-elevated/95 border-t backdrop-blur",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center gap-2 px-3 py-3">{content}</div>
    </div>
  );
}
