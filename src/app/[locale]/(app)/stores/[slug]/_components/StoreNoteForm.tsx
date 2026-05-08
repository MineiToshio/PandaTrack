"use client";

import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition, type ChangeEvent } from "react";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";
import type { StoreViewerNote } from "@/queries/store";
import { saveStoreNote } from "../_actions/saveStoreNote";

type StoreNoteFormProps = {
  locale: string;
  storeSlug: string;
  existingNote: StoreViewerNote | null;
};

const AUTOSAVE_DEBOUNCE_MS = 800;

function translateNoteError(t: ReturnType<typeof useTranslations>, errorKey: string) {
  return t.has(`detail.privateNote.form.errors.${errorKey}`)
    ? t(`detail.privateNote.form.errors.${errorKey}`)
    : t("error.validation_failed");
}

type SaveState =
  | { kind: "idle"; lastSavedAt: Date | null }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string };

/**
 * Autosaving private note (matches `_notes/demo-screens.html` aside note pattern):
 *   - Textarea live-bound to local state
 *   - Debounced save 800ms after last keystroke (or on blur)
 *   - Inline indicator below: check + "Guardada hace Xm" / spinner + "Guardando…" / error
 *   - No manual save button
 *
 * Optimistic-by-design: the textarea reflects user input immediately; persistence is implicit.
 */
export default function StoreNoteForm({ locale, storeSlug, existingNote }: StoreNoteFormProps) {
  const t = useTranslations("stores");
  const [draftContent, setDraftContent] = useState(existingNote?.content ?? "");
  const [saveState, setSaveState] = useState<SaveState>({
    kind: "idle",
    lastSavedAt: existingNote?.updatedAt ?? null,
  });
  const [, startTransition] = useTransition();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedRef = useRef<string>(existingNote?.content ?? "");

  const persist = (value: string) => {
    if (value === lastPersistedRef.current) return;
    setSaveState({ kind: "saving" });
    const formData = new FormData();
    formData.set("slug", storeSlug);
    formData.set("locale", locale);
    formData.set("content", value);
    startTransition(async () => {
      const result = await saveStoreNote(null, formData);
      if (result?.success === false) {
        const errorKey =
          ("error" in result && result.error) || (result.fieldErrors?.content?.[0] ?? "validation_failed");
        setSaveState({ kind: "error", message: translateNoteError(t, errorKey) });
        return;
      }
      lastPersistedRef.current = value;
      setSaveState({ kind: "saved", at: new Date() });
    });
  };

  const scheduleSave = (value: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => persist(value), AUTOSAVE_DEBOUNCE_MS);
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    setDraftContent(next);
    scheduleSave(next);
  };

  const handleBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    persist(draftContent);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const renderIndicator = () => {
    if (saveState.kind === "saving") {
      return (
        <span className="inline-flex items-center gap-1.5 [color:var(--text-muted)]">
          <Loader2 size={12} aria-hidden="true" className="animate-spin" />
          <span>{t("detail.privateNote.form.submitting")}</span>
        </span>
      );
    }
    if (saveState.kind === "error") {
      return (
        <span className="[color:var(--destructive)]" role="alert">
          {saveState.message}
        </span>
      );
    }
    const savedAt = saveState.kind === "saved" ? saveState.at : saveState.lastSavedAt;
    if (!savedAt) {
      // No save yet — keep the row collapsed so the description above the textarea isn't duplicated.
      return null;
    }
    const formatted = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(savedAt);
    return (
      <span className="inline-flex items-center gap-1.5 [color:var(--text-muted)]">
        <Check size={12} aria-hidden="true" className="[color:var(--success)]" />
        <span>{t("detail.privateNote.lastUpdated", { date: formatted })}</span>
      </span>
    );
  };

  const indicator = renderIndicator();

  return (
    <div className="flex flex-col gap-2">
      <Typography size="xs" className="text-text-muted">
        {t("detail.privateNote.description")}
      </Typography>
      <Textarea
        id="store-private-note"
        name="content"
        value={draftContent}
        onChange={handleChange}
        onBlur={handleBlur}
        rows={4}
        maxLength={2000}
        placeholder={t("detail.privateNote.form.contentPlaceholder")}
        className={cn("resize-y")}
      />
      {indicator && <div className="[font-size:12px]">{indicator}</div>}
    </div>
  );
}
