"use client";

import { useTranslations } from "next-intl";
import PrivateNoteCard, { type PrivateNoteSaveResult } from "@/components/modules/PrivateNoteCard";
import { saveOrderNoteAction } from "../_actions/orderNoteActions";

type OrderPrivateNoteCardProps = {
  orderId: string;
  initialNote: string | null;
  initialUpdatedAt: Date | null;
  locale: string;
  className?: string;
};

/**
 * Order-detail wrapper around the canonical `<PrivateNoteCard>` module. Owns the orders-namespace
 * i18n strings and the orders-specific server action; UI + autosave behavior live in the module.
 */
export default function OrderPrivateNoteCard({
  orderId,
  initialNote,
  initialUpdatedAt,
  locale,
  className,
}: OrderPrivateNoteCardProps) {
  const t = useTranslations("orders");

  const handleSave = async (note: string | null): Promise<PrivateNoteSaveResult> => {
    const result = await saveOrderNoteAction(orderId, note);
    if (result.ok) return { ok: true, updatedAt: result.updatedAt };
    return { ok: false, error: result.error };
  };

  return (
    <PrivateNoteCard
      title={t("detail.note.sectionTitle")}
      subtitle={t("detail.note.description")}
      initialNote={initialNote}
      initialUpdatedAt={initialUpdatedAt}
      locale={locale}
      maxLength={2000}
      rows={4}
      placeholder={t("detail.note.placeholder")}
      onSave={handleSave}
      labels={{
        saving: t("detail.note.saving"),
        savedAt: (time) => t("detail.note.lastUpdated", { date: time }),
        errorGeneric: t("detail.note.errorSave"),
      }}
      className={className}
      inputId={`order-note-${orderId}`}
      textareaAriaLabel={t("detail.note.sectionTitle")}
    />
  );
}
