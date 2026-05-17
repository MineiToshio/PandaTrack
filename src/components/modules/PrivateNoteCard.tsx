"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";

const AUTOSAVE_DEBOUNCE_MS = 800;

export type PrivateNoteSaveResult = { ok: true; updatedAt: Date } | { ok: false; error: string };

export type PrivateNoteCardProps = {
  /** Section title — rendered as eyebrow above the description. */
  title: string;
  /** Secondary copy under the title (the "what is this note for" sentence). Optional. */
  subtitle?: string;
  /** Initial textarea content. */
  initialNote: string | null;
  /** Last persisted-at timestamp (drives the "Guardada hace …" indicator). */
  initialUpdatedAt: Date | null;
  /** Locale used to format the saved-at indicator's time. */
  locale: string;
  /** Max characters allowed by the textarea. */
  maxLength?: number;
  /** Number of textarea rows. */
  rows?: number;
  /** Placeholder copy for the textarea. */
  placeholder?: string;
  /** Server action invoked on debounced save + on blur. Receives the trimmed note (or null). */
  onSave: (note: string | null) => Promise<PrivateNoteSaveResult>;
  /** Copy bundle for the indicator + error labels (i18n is the caller's responsibility). */
  labels: {
    saving: string;
    /** Receives `{ time: string }` — formatted "HH:mm" of `updatedAt`. */
    savedAt: (time: string) => string;
    /** Generic error toast / inline label. */
    errorGeneric: string;
  };
  /** Optional className applied to the outer section. */
  className?: string;
  /** Stable form-field id (defaults to a stable internal id). */
  inputId?: string;
  /** Optional accessible label for the textarea when no visible label is rendered. */
  textareaAriaLabel?: string;
  /** Optional render slot for custom indicator content (overrides the default indicator). */
  renderExtraFooter?: ReactNode;
};

type SaveState =
  | { kind: "idle"; lastSavedAt: Date | null }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string };

/**
 * Canonical autosaving private note card. Used by stores detail (`StoreNoteForm` wraps it) and
 * orders detail (`OrderPrivateNoteCard` wraps it). Behavior:
 *
 *   - Live-bound textarea + debounce 800ms after the last keystroke
 *   - Save on blur too (resets debounce)
 *   - Inline indicator: spinner "Guardando…" / check "Guardada hace …" / error message
 *   - No manual save button
 *
 * The caller owns the server action + i18n; this module owns the UI + debounce + state machine.
 */
export default function PrivateNoteCard({
  title,
  subtitle,
  initialNote,
  initialUpdatedAt,
  locale,
  maxLength = 2000,
  rows = 4,
  placeholder,
  onSave,
  labels,
  className,
  inputId = "private-note",
  textareaAriaLabel,
  renderExtraFooter,
}: PrivateNoteCardProps) {
  const [draftContent, setDraftContent] = useState(initialNote ?? "");
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle", lastSavedAt: initialUpdatedAt });
  const [, startTransition] = useTransition();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedRef = useRef<string>(initialNote ?? "");

  const persist = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === lastPersistedRef.current.trim()) return;
    setSaveState({ kind: "saving" });
    const noteToSave = trimmed.length > 0 ? trimmed : null;
    startTransition(async () => {
      const result = await onSave(noteToSave);
      if (!result.ok) {
        setSaveState({ kind: "error", message: labels.errorGeneric });
        return;
      }
      lastPersistedRef.current = trimmed;
      setSaveState({ kind: "saved", at: result.updatedAt });
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

  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    },
    [],
  );

  const renderIndicator = () => {
    if (saveState.kind === "saving") {
      return (
        <span className="inline-flex items-center gap-1.5 [color:var(--text-muted)]">
          <Loader2 size={12} aria-hidden="true" className="animate-spin" />
          <span>{labels.saving}</span>
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
    if (!savedAt) return null;
    const formatted = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(savedAt);
    return (
      <span className="inline-flex items-center gap-1.5 [color:var(--text-muted)]">
        <Check size={12} aria-hidden="true" className="[color:var(--success)]" />
        <span>{labels.savedAt(formatted)}</span>
      </span>
    );
  };

  const indicator = renderIndicator();

  return (
    <section
      aria-labelledby={`${inputId}-heading`}
      className={cn(
        "bg-surface-elevated border-border rounded-2xl border p-[18px] [box-shadow:var(--elevation-2)] sm:p-[22px]",
        className,
      )}
    >
      <h2
        id={`${inputId}-heading`}
        className="text-text-muted mb-2 font-mono text-[11px] font-medium tracking-[0.08em] uppercase"
      >
        {title}
      </h2>
      {subtitle && (
        <Typography size="xs" className="text-text-muted mb-2">
          {subtitle}
        </Typography>
      )}
      <Textarea
        id={inputId}
        name="content"
        value={draftContent}
        onChange={handleChange}
        onBlur={handleBlur}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={textareaAriaLabel}
        className="resize-y"
      />
      {indicator && (
        <div className="mt-2 text-[12px]" aria-live="polite">
          {indicator}
        </div>
      )}
      {renderExtraFooter}
    </section>
  );
}
