"use client";

import { useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { NotebookPen } from "lucide-react";
import Button from "@/components/core/Button/Button";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import SectionSurfaceCard from "@/components/modules/SectionSurfaceCard";
import { saveOrderNoteAction } from "../_actions/orderNoteActions";

type OrderNoteFormProps = {
  orderId: string;
  initialNote: string | null;
  locale: string;
};

export default function OrderNoteForm({ orderId, initialNote, locale }: OrderNoteFormProps) {
  const t = useTranslations("orders");
  const persistedNote = initialNote ?? "";
  const [draft, setDraft] = useState(persistedNote);
  const [savedNote, setSavedNote] = useState(initialNote);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const draftTrimmed = draft.trim();
  const persistedTrimmed = (savedNote ?? "").trim();
  const canSave = draftTrimmed !== persistedTrimmed;
  const submitDisabled = isPending || !canSave;

  const disabledAriaLabel =
    !isPending && !canSave
      ? draftTrimmed.length === 0
        ? `${t("detail.note.save")}. ${t("detail.note.saveDisabledEmpty")}`
        : `${t("detail.note.save")}. ${t("detail.note.saveDisabledUnchanged")}`
      : undefined;

  async function handleSave() {
    setIsPending(true);
    setError(null);
    const noteToSave = draftTrimmed.length > 0 ? draftTrimmed : null;
    const result = await saveOrderNoteAction(orderId, noteToSave);
    setIsPending(false);
    if (result.ok) {
      setSavedNote(result.note);
      setDraft(result.note ?? "");
      setLastSavedAt(new Date());
    } else {
      setError(t("detail.note.errorSave"));
    }
  }

  const updatedAtLabel = lastSavedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(lastSavedAt)
    : null;

  return (
    <SectionSurfaceCard
      title={t("detail.note.sectionTitle")}
      titleAs="h2"
      titleId="order-note-heading"
      icon={NotebookPen}
      iconClassName="text-info"
    >
      <section aria-labelledby="order-note-heading" className="space-y-3">
        <div className="space-y-1">
          <Typography size="xs" className="text-text-muted">
            {t("detail.note.description")}
          </Typography>
          {updatedAtLabel && (
            <Typography size="xs" className="text-text-muted">
              {t("detail.note.lastUpdated", { date: updatedAtLabel })}
            </Typography>
          )}
        </div>

        <Textarea
          id="order-private-note"
          value={draft}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value)}
          rows={5}
          maxLength={2000}
          disabled={isPending}
          aria-labelledby="order-note-heading"
          placeholder={t("detail.note.placeholder")}
          className="resize-y"
        />

        {error && (
          <Typography size="xs" className="text-destructive" role="alert">
            {error}
          </Typography>
        )}

        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={submitDisabled}
          aria-label={disabledAriaLabel}
          onClick={handleSave}
          className="w-full sm:w-auto"
        >
          {isPending ? t("detail.note.saving") : t("detail.note.save")}
        </Button>
      </section>
    </SectionSurfaceCard>
  );
}
