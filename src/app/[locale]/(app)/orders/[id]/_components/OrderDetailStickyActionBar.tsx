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
  locale: string;
  onAnnotatePayment: () => void;
};

export default function OrderDetailStickyActionBar({
  orderId,
  status,
  isOverdue,
  remainingAmount,
  currencyCode,
  hasUnpaidBalance,
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
        <Link
          href={`/${locale}${ROUTES.deliveriesNew}?sourceOrderId=${orderId}`}
          className={tonalBtnClass}
          data-ph-event={POSTHOG_EVENTS.ORDER.CREATE_DELIVERY_CLICKED}
          data-ph-props={JSON.stringify({ orderId, status })}
        >
          <Truck className="size-4 shrink-0" aria-hidden />
          {secondaryLabel}
        </Link>
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
