"use client";

import Link from "next/link";
import { Ellipsis, PackageCheck, Pencil, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS } from "@/lib/constants";
import type { DeliveryStatus } from "../../../../../../../generated/prisma/client";

type DeliveryStickyActionBarProps = {
  deliveryId: string;
  /** Live (optimistic) lifecycle state. */
  status: DeliveryStatus;
  editHref: string;
  isReopening: boolean;
  onMarkDelivered: () => void;
  onReopen: () => void;
  onOpenActionsSheet: () => void;
};

/**
 * Mobile sticky action bar — single-primary per state (§9.16 + ADR 0011):
 *   IN_TRANSIT → [⋯ overflow] [Editar tonal] [Marcar llegada primary]
 *   DELIVERED  → [Reabrir primary full-width] (edit/delete locked)
 *   CANCELLED  → [⋯ overflow (Eliminar)] [Reabrir primary]
 */
export default function DeliveryStickyActionBar({
  deliveryId,
  status,
  editHref,
  isReopening,
  onMarkDelivered,
  onReopen,
  onOpenActionsSheet,
}: DeliveryStickyActionBarProps) {
  const t = useTranslations("deliveries");

  const primaryBtnClass =
    "bg-primary text-primary-foreground hover:bg-primary/90 inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-sm transition-colors";
  const tonalBtnClass =
    "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors";
  const overflowBtnClass =
    "border-border-strong text-text-secondary hover:text-text-primary inline-flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors";

  let content: React.ReactNode;

  if (status === "IN_TRANSIT") {
    content = (
      <>
        <button
          type="button"
          onClick={onOpenActionsSheet}
          aria-label={t("detail.stickyBar.moreActions")}
          aria-haspopup="dialog"
          className={overflowBtnClass}
          data-ph-event={POSTHOG_EVENTS.DELIVERY.ACTIONS_SHEET_OPENED}
          data-ph-props={JSON.stringify({ deliveryId })}
        >
          <Ellipsis className="size-5" aria-hidden />
        </button>
        <Link href={editHref} className={tonalBtnClass}>
          <Pencil className="size-4 shrink-0" aria-hidden />
          {t("detail.stickyBar.edit")}
        </Link>
        <button
          type="button"
          onClick={onMarkDelivered}
          className={cn(primaryBtnClass, "flex-[1.4]")}
          data-ph-event={POSTHOG_EVENTS.DELIVERY.STICKY_BAR_PRIMARY_CLICKED}
          data-ph-props={JSON.stringify({ deliveryId, action: "mark-delivered" })}
        >
          <PackageCheck className="size-4 shrink-0" aria-hidden />
          {t("detail.stickyBar.markDelivered")}
        </button>
      </>
    );
  } else if (status === "CANCELLED") {
    content = (
      <>
        <button
          type="button"
          onClick={onOpenActionsSheet}
          aria-label={t("detail.stickyBar.moreActions")}
          aria-haspopup="dialog"
          className={overflowBtnClass}
          data-ph-event={POSTHOG_EVENTS.DELIVERY.ACTIONS_SHEET_OPENED}
          data-ph-props={JSON.stringify({ deliveryId })}
        >
          <Ellipsis className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onReopen}
          disabled={isReopening}
          aria-busy={isReopening}
          className={cn(primaryBtnClass)}
          data-ph-event={POSTHOG_EVENTS.DELIVERY.STICKY_BAR_PRIMARY_CLICKED}
          data-ph-props={JSON.stringify({ deliveryId, action: "reopen" })}
        >
          <RotateCcw className="size-4 shrink-0" aria-hidden />
          {isReopening ? t("detail.stickyBar.reopening") : t("detail.stickyBar.reopen")}
        </button>
      </>
    );
  } else {
    content = (
      <button
        type="button"
        onClick={onReopen}
        disabled={isReopening}
        aria-busy={isReopening}
        className={cn(primaryBtnClass, "w-full")}
        data-ph-event={POSTHOG_EVENTS.DELIVERY.STICKY_BAR_PRIMARY_CLICKED}
        data-ph-props={JSON.stringify({ deliveryId, action: "reopen" })}
      >
        <RotateCcw className="size-4 shrink-0" aria-hidden />
        {isReopening ? t("detail.stickyBar.reopening") : t("detail.stickyBar.reopen")}
      </button>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label={t("detail.stickyBar.ariaLabel")}
      className={cn("fixed inset-x-0 bottom-0 z-30 lg:hidden", "border-border border-t backdrop-blur")}
      // oklab, not oklch — alpha over neutral tokens drifts pink in oklch (L074).
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "color-mix(in oklab, var(--background) 92%, transparent)",
      }}
    >
      <div className="flex items-center gap-2.5 px-4 py-3">{content}</div>
    </div>
  );
}
