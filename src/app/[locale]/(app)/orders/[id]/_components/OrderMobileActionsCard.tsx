"use client";

import Link from "next/link";
import { ChevronRight, Ban, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { OrderEligibility } from "@/lib/data/orders/orderQueries";
import type { OrderStatus } from "../../../../../../../generated/prisma/client";

type OrderMobileActionsCardProps = {
  orderId: string;
  locale: string;
  status: OrderStatus;
  eligibility: OrderEligibility;
  onCancel: () => void;
  onDelete: () => void;
};

export default function OrderMobileActionsCard({
  orderId,
  locale,
  status,
  eligibility,
  onCancel,
  onDelete,
}: OrderMobileActionsCardProps) {
  const t = useTranslations("orders");
  const isCancelled = status === "CANCELLED";
  const isCompleted = status === "COMPLETED";

  const showEdit = !isCancelled;
  const showCancel = !isCancelled && !isCompleted;

  const rowClass =
    "flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium text-text-body hover:bg-muted/30 transition-colors";
  const destructiveRowClass =
    "flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors";

  return (
    <section
      aria-labelledby="mobile-actions-heading"
      className="bg-surface-elevated border-border mt-4 overflow-hidden rounded-2xl border [box-shadow:var(--elevation-2)] lg:hidden"
    >
      <div className="border-border border-b px-[18px] py-3">
        <h2
          id="mobile-actions-heading"
          className="text-text-muted font-mono text-[11px] font-medium tracking-[0.08em] uppercase"
        >
          {t("detail.mobileActions.sectionTitle")}
        </h2>
      </div>
      <div className="divide-border/60 divide-y">
        {showEdit && (
          <Link href={`/${locale}${ROUTES.orders}/${orderId}/edit`} className={rowClass}>
            <Pencil className="text-text-secondary size-4 shrink-0" aria-hidden />
            <span className="flex-1">{t("detail.mobileActions.edit")}</span>
            <ChevronRight className="text-text-muted size-4 shrink-0" aria-hidden />
          </Link>
        )}
        {showCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={!eligibility.canCancel}
            className={cn(rowClass, !eligibility.canCancel && "cursor-not-allowed opacity-50")}
          >
            <Ban className="text-text-secondary size-4 shrink-0" aria-hidden />
            <span className="flex-1">{t("detail.mobileActions.cancel")}</span>
            <ChevronRight className="text-text-muted size-4 shrink-0" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={!eligibility.canDelete}
          className={cn(destructiveRowClass, !eligibility.canDelete && "cursor-not-allowed opacity-50")}
        >
          <Trash2 className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">{t("detail.mobileActions.delete")}</span>
          <ChevronRight className="text-destructive/60 size-4 shrink-0" aria-hidden />
        </button>
      </div>
    </section>
  );
}
