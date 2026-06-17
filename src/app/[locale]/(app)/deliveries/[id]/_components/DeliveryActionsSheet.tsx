"use client";

import Link from "next/link";
import { Ban, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Sheet from "@/components/modules/Sheet/Sheet";
import type { DeliveryStatus } from "../../../../../../../generated/prisma/client";

type DeliveryActionsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  humanReadableId: string;
  storeName: string;
  /** Live (optimistic) lifecycle state — gates which rows render. */
  status: DeliveryStatus;
  editHref: string;
  onCancel: () => void;
  onDelete: () => void;
};

const ROW_CLASS =
  "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14.5px] font-medium transition-colors";

/**
 * Mobile "Más acciones" overflow sheet (ADR 0011, action-sheet variant):
 * each row IS the action — Editar / Cancelar (warning) / Eliminar (destructive).
 */
export default function DeliveryActionsSheet({
  open,
  onOpenChange,
  humanReadableId,
  storeName,
  status,
  editHref,
  onCancel,
  onDelete,
}: DeliveryActionsSheetProps) {
  const t = useTranslations("deliveries");

  const isInTransit = status === "IN_TRANSIT";

  function handleCancelRow() {
    onOpenChange(false);
    onCancel();
  }

  function handleDeleteRow() {
    onOpenChange(false);
    onDelete();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("detail.actionsSheet.title")}
      footer={
        <Button type="button" variant="ghost" size="md" fullWidth onClick={() => onOpenChange(false)}>
          {t("detail.actionsSheet.close")}
        </Button>
      }
    >
      <p className="text-text-muted -mt-1 mb-3 text-[12.5px]">
        {humanReadableId} · {storeName}
      </p>
      <div className="flex flex-col gap-1">
        {isInTransit && (
          <Link href={editHref} className={`${ROW_CLASS} text-text-primary hover:bg-muted/30`}>
            <Pencil className="text-text-secondary size-[18px] shrink-0" aria-hidden />
            {t("detail.actionsSheet.edit")}
          </Link>
        )}
        {isInTransit && (
          <button type="button" onClick={handleCancelRow} className={`${ROW_CLASS} text-warning hover:bg-warning/10`}>
            <Ban className="size-[18px] shrink-0" aria-hidden />
            {t("detail.actionsSheet.cancel")}
          </button>
        )}
        <button
          type="button"
          onClick={handleDeleteRow}
          className={`${ROW_CLASS} text-destructive hover:bg-destructive/10`}
        >
          <Trash2 className="size-[18px] shrink-0" aria-hidden />
          {t("detail.actionsSheet.delete")}
        </button>
      </div>
    </Sheet>
  );
}
