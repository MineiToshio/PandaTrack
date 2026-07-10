"use client";

import { useTranslations } from "next-intl";
import PrivateNoteCard, { type PrivateNoteSaveResult } from "@/components/modules/PrivateNoteCard";
import type { StoreViewerNote } from "@/lib/data/stores/storeQueries";
import { saveStoreNote } from "../_actions/saveStoreNote";

type StoreNoteFormProps = {
  locale: string;
  storeSlug: string;
  existingNote: StoreViewerNote | null;
};

function translateNoteError(t: ReturnType<typeof useTranslations>, errorKey: string) {
  return t.has(`detail.privateNote.form.errors.${errorKey}`)
    ? t(`detail.privateNote.form.errors.${errorKey}`)
    : t("error.validation_failed");
}

/**
 * Stores-detail wrapper around the canonical `<PrivateNoteCard>` module. Owns the stores-namespace
 * i18n strings and the `saveStoreNote` server action; UI + autosave behavior live in the module.
 */
export default function StoreNoteForm({ locale, storeSlug, existingNote }: StoreNoteFormProps) {
  const t = useTranslations("stores");

  const handleSave = async (note: string | null): Promise<PrivateNoteSaveResult> => {
    const formData = new FormData();
    formData.set("slug", storeSlug);
    formData.set("locale", locale);
    formData.set("content", note ?? "");
    const result = await saveStoreNote(null, formData);
    if (result?.success === false) {
      const errorKey = ("error" in result && result.error) || (result.fieldErrors?.content?.[0] ?? "validation_failed");
      return { ok: false, error: translateNoteError(t, errorKey) };
    }
    return { ok: true, updatedAt: new Date() };
  };

  return (
    <PrivateNoteCard
      title={t("detail.privateNote.title")}
      subtitle={t("detail.privateNote.description")}
      initialNote={existingNote?.content ?? null}
      initialUpdatedAt={existingNote?.updatedAt ?? null}
      locale={locale}
      maxLength={2000}
      rows={4}
      placeholder={t("detail.privateNote.form.contentPlaceholder")}
      onSave={handleSave}
      labels={{
        saving: t("detail.privateNote.form.submitting"),
        savedAt: (time) => t("detail.privateNote.lastUpdated", { date: time }),
        errorGeneric: t("detail.privateNote.form.errors.validation_failed"),
      }}
      inputId={`store-note-${storeSlug}`}
    />
  );
}
