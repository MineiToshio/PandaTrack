"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import type { StoreViewerNote } from "@/queries/store";
import StoreSectionLabel from "../../_components/share/StoreSectionLabel";
import StoreSurfaceCard from "../../_components/share/StoreSurfaceCard";
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

export default function StoreNoteForm({ locale, storeSlug, existingNote }: StoreNoteFormProps) {
  const t = useTranslations("stores");
  const [state, formAction, isPending] = useActionState(saveStoreNote, null);
  const persistedContent = existingNote?.content ?? "";
  const [draftContent, setDraftContent] = useState(persistedContent);

  const handleDraftChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDraftContent(event.target.value);
  };

  const persistedNormalized = persistedContent.trim();
  const draftNormalized = draftContent.trim();
  const canSubmit = draftNormalized.length > 0 && draftNormalized !== persistedNormalized;
  const submitDisabled = isPending || !canSubmit;
  const submitCtaVisible = existingNote
    ? t("detail.privateNote.form.updateCta")
    : t("detail.privateNote.form.submitCta");
  const submitDisabledAriaLabel =
    !isPending && !canSubmit
      ? `${submitCtaVisible}. ${
          draftNormalized.length === 0
            ? t("detail.privateNote.form.submitDisabledEmpty")
            : t("detail.privateNote.form.submitDisabledUnchanged")
        }`
      : undefined;

  const fieldErrors = state?.success === false ? state.fieldErrors : undefined;
  const contentError = fieldErrors?.content?.[0];
  const formError = state?.success === false && "error" in state && state.error ? state.error : null;
  const updatedAtLabel = existingNote
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(existingNote.updatedAt)
    : null;

  return (
    <StoreSurfaceCard>
      <div className="space-y-1">
        <StoreSectionLabel id="store-private-note-heading">{t("detail.privateNote.title")}</StoreSectionLabel>
        <Typography size="sm" className="text-text-muted">
          {t("detail.privateNote.description")}
        </Typography>
        {updatedAtLabel && (
          <Typography size="xs" className="text-text-muted">
            {t("detail.privateNote.lastUpdated", { date: updatedAtLabel })}
          </Typography>
        )}
      </div>

      <form action={formAction} className="mt-5 space-y-4" aria-busy={isPending}>
        <input type="hidden" name="slug" value={storeSlug} />
        <input type="hidden" name="locale" value={locale} />

        <div>
          <Textarea
            id="store-private-note"
            name="content"
            value={draftContent}
            onChange={handleDraftChange}
            rows={6}
            maxLength={2000}
            disabled={isPending}
            error={Boolean(contentError)}
            aria-invalid={Boolean(contentError)}
            aria-labelledby="store-private-note-heading"
            placeholder={t("detail.privateNote.form.contentPlaceholder")}
            className="resize-y"
          />
          <Typography size="xs" className="text-text-muted mt-1">
            {t("detail.privateNote.form.helper")}
          </Typography>
          {contentError && (
            <Typography size="xs" className="text-destructive mt-1" role="alert">
              {translateNoteError(t, contentError)}
            </Typography>
          )}
        </div>

        {state?.success && (
          <Typography size="xs" className="text-text-body" role="status" aria-live="polite">
            {t("detail.privateNote.form.success")}
          </Typography>
        )}

        {formError && (
          <Typography size="xs" className="text-destructive" role="alert">
            {translateNoteError(t, formError)}
          </Typography>
        )}

        <Button
          type="submit"
          variant="secondary"
          size="lg"
          disabled={submitDisabled}
          aria-label={submitDisabledAriaLabel}
          className="w-full sm:w-auto"
        >
          {isPending
            ? t("detail.privateNote.form.submitting")
            : existingNote
              ? t("detail.privateNote.form.updateCta")
              : t("detail.privateNote.form.submitCta")}
        </Button>
      </form>
    </StoreSurfaceCard>
  );
}
