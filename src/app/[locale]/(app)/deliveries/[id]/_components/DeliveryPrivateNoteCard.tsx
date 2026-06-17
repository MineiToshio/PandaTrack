"use client";

import { useTranslations } from "next-intl";
import PrivateNoteCard, { type PrivateNoteSaveResult } from "@/components/modules/PrivateNoteCard";
import { saveDeliveryNoteAction } from "../_actions/deliveryNoteActions";

type DeliveryPrivateNoteCardProps = {
  deliveryId: string;
  initialNote: string | null;
  initialUpdatedAt: Date | null;
  locale: string;
  className?: string;
};

const NOTE_MAX_LENGTH = 2000;

/**
 * Delivery-detail wrapper around the canonical `<PrivateNoteCard>` (FR-08-25 / BR-08-06).
 * Same autosave behavior as orders/stores; copy suggests tracking / courier context.
 */
export default function DeliveryPrivateNoteCard({
  deliveryId,
  initialNote,
  initialUpdatedAt,
  locale,
  className,
}: DeliveryPrivateNoteCardProps) {
  const t = useTranslations("deliveries");

  const handleSave = async (note: string | null): Promise<PrivateNoteSaveResult> => {
    const result = await saveDeliveryNoteAction(deliveryId, note);
    if (result.ok) return { ok: true, updatedAt: result.updatedAt };
    return { ok: false, error: result.error };
  };

  return (
    <PrivateNoteCard
      title={t("detail.note.title")}
      subtitle={t("detail.note.helper")}
      initialNote={initialNote}
      initialUpdatedAt={initialUpdatedAt}
      locale={locale}
      maxLength={NOTE_MAX_LENGTH}
      rows={3}
      placeholder={t("detail.note.placeholder")}
      onSave={handleSave}
      labels={{
        saving: t("detail.note.saving"),
        savedAt: (time) => t("detail.note.savedAt", { date: time }),
        errorGeneric: t("detail.note.errorSave"),
      }}
      className={className}
      inputId={`delivery-note-${deliveryId}`}
      textareaAriaLabel={t("detail.note.title")}
    />
  );
}
