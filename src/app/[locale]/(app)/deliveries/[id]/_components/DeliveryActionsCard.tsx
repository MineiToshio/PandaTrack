"use client";

import { Ban, Info, PackageCheck, Pencil, RotateCcw, Trash2, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Eyebrow from "@/components/core/Eyebrow";
import type { DeliveryStatus } from "../../../../../../../generated/prisma/client";

type DeliveryActionsCardProps = {
  /** Live (optimistic) lifecycle state — the action matrix follows it. */
  status: DeliveryStatus;
  editHref: string;
  isReopening: boolean;
  onMarkDelivered: () => void;
  onReopen: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

/**
 * Aside actions card — action matrix per delivery status:
 *   IN_TRANSIT → Marcar como llegada (primary) · Editar · Cancelar · Eliminar
 *   DELIVERED  → Reabrir (primary) · Editar/Eliminar disabled + helper
 *   CANCELLED  → Reabrir (primary) · Eliminar + helper
 * Reabrir runs without a modal (S9-D3) — the coordinator shows the neutral-undo toast.
 */
export default function DeliveryActionsCard({
  status,
  editHref,
  isReopening,
  onMarkDelivered,
  onReopen,
  onCancel,
  onDelete,
}: DeliveryActionsCardProps) {
  const t = useTranslations("deliveries");

  const isInTransit = status === "IN_TRANSIT";
  const isDelivered = status === "DELIVERED";
  const isCancelled = status === "CANCELLED";

  return (
    <section
      aria-labelledby="delivery-actions-heading"
      className="bg-surface-elevated border-border rounded-2xl border p-[18px] [box-shadow:var(--elevation-2)] [border-top:2px_solid_color-mix(in_oklch,var(--accent)_55%,transparent)] sm:p-[22px]"
    >
      <Eyebrow as="h2" variant="chip" tone="accent" icon={Zap} id="delivery-actions-heading">
        {t("detail.actions.title")}
      </Eyebrow>

      <div className="mt-3 flex flex-col gap-2">
        {isInTransit ? (
          <>
            <Button
              type="button"
              variant="primary"
              size="md"
              fullWidth
              onClick={onMarkDelivered}
              leadingIcon={<PackageCheck size={16} aria-hidden />}
              className="justify-start"
            >
              {t("detail.actions.markDelivered")}
            </Button>
            <Button
              as="a"
              href={editHref}
              variant="ghost"
              size="md"
              fullWidth
              leadingIcon={<Pencil size={16} aria-hidden />}
              className="justify-start"
            >
              {t("detail.actions.edit")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="md"
              fullWidth
              onClick={onCancel}
              leadingIcon={<Ban size={16} aria-hidden />}
              className="justify-start"
            >
              {t("detail.actions.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive-ghost"
              size="md"
              fullWidth
              onClick={onDelete}
              leadingIcon={<Trash2 size={16} aria-hidden />}
              className="justify-start"
            >
              {t("detail.actions.delete")}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="primary"
              size="md"
              fullWidth
              onClick={onReopen}
              disabled={isReopening}
              leadingIcon={<RotateCcw size={16} aria-hidden />}
              className="justify-start"
            >
              {isReopening ? "…" : t("detail.actions.reopen")}
            </Button>
            {isDelivered && (
              <Button
                type="button"
                variant="ghost"
                size="md"
                fullWidth
                disabled
                leadingIcon={<Pencil size={16} aria-hidden />}
                className="justify-start"
              >
                {t("detail.actions.edit")}
              </Button>
            )}
            <Button
              type="button"
              variant="destructive-ghost"
              size="md"
              fullWidth
              disabled={isDelivered}
              onClick={isCancelled ? onDelete : undefined}
              leadingIcon={<Trash2 size={16} aria-hidden />}
              className="justify-start"
            >
              {t("detail.actions.delete")}
            </Button>
          </>
        )}
      </div>

      {/* Disabled actions keep a textual helper explaining why (a11y — no opacity-only). */}
      {isDelivered && (
        <p className="text-text-muted mt-2.5 flex items-start gap-1.5 text-[12px] leading-snug">
          <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
          {t("detail.actions.deliveredHelper")}
        </p>
      )}
      {isCancelled && (
        <p className="text-text-muted mt-2.5 flex items-start gap-1.5 text-[12px] leading-snug">
          <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
          {t.rich("detail.actions.cancelledHelper", {
            strong: (chunks) => <strong className="text-text-secondary font-semibold">{chunks}</strong>,
          })}
        </p>
      )}
    </section>
  );
}
