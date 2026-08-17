"use client";

import { Check, Pencil, Plus, X } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Select from "@/components/core/Select";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";
import { getStoreContactChannelIcon } from "@/lib/catalog/storeContactChannelIcons";
import {
  type ContactChannelValueResolution,
  resolvePhoneValue,
  resolveWhatsAppValue,
} from "@/lib/store/contactChannelValue";
import { STORE_CONTACT_CHANNEL_TYPES, type StoreContactChannelType } from "./StoreContactChannelList";
import FieldErrorMsg from "@/components/core/FieldErrorMsg";

export type ContactChannelEntry = {
  id: number;
  type: StoreContactChannelType;
  value: string;
};

type Labels = {
  typeLabel: string;
  valueLabel: string;
  helper: string;
  addButton: string;
  addChannel: string;
  edit: string;
  save: string;
  cancel: string;
  remove: string;
  optionLabel: (type: StoreContactChannelType) => string;
  valuePlaceholder: (type: StoreContactChannelType) => string;
  validationError?: (errorKey: string) => string;
  /** Shown inside a bordered container when there are no entries and the add form is closed. */
  empty?: string;
};

export type StoreContactChannelEditorHandle = {
  /** Programmatically opens the add-channel form. */
  openForm: () => void;
};

export type StoreContactChannelEditorProps = {
  entries: ContactChannelEntry[];
  onAdd: (entry: { type: StoreContactChannelType; value: string }) => void;
  onUpdate: (id: number, next: { type: StoreContactChannelType; value: string }) => void;
  onRemove: (id: number) => void;
  /** Default region for parsing a PHONE/WHATSAPP value typed without its own country code. */
  countryCode?: string | null;
  /** Hidden input names so the values are submitted with the form. */
  typeInputName?: string;
  valueInputName?: string;
  labels: Labels;
  onFormOpenChange?: (open: boolean) => void;
  /**
   * When true, hides the internal "Añadir canal" ghost trigger button.
   * Use alongside a ref (StoreContactChannelEditorHandle) to open the form externally
   * from a header row button placed next to the section label.
   */
  hideTrigger?: boolean;
};

/** Exported for direct unit testing — the actual validation/normalization risk lives here. */
export function resolveChannelValue(
  type: StoreContactChannelType,
  value: string,
  countryCode: string | null,
): ContactChannelValueResolution {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: "required" };

  switch (type) {
    case "INSTAGRAM":
      if (!/instagram\.com\//.test(trimmed)) return { ok: false, error: "INSTAGRAM" };
      return { ok: true, value: trimmed };
    case "WHATSAPP":
      return resolveWhatsAppValue(trimmed, countryCode);
    case "EMAIL":
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { ok: false, error: "EMAIL" };
      return { ok: true, value: trimmed };
    case "PHONE":
      return resolvePhoneValue(trimmed, countryCode);
    case "FACEBOOK":
      if (!/(facebook\.com|fb\.com)\//.test(trimmed)) return { ok: false, error: "FACEBOOK" };
      return { ok: true, value: trimmed };
    case "TIKTOK":
      if (!/tiktok\.com\//.test(trimmed)) return { ok: false, error: "TIKTOK" };
      return { ok: true, value: trimmed };
    case "WEBSITE":
      if (!/^https?:\/\//.test(trimmed)) return { ok: false, error: "WEBSITE" };
      return { ok: true, value: trimmed };
    case "OTHER":
      return { ok: true, value: trimmed };
    default:
      return { ok: true, value: trimmed };
  }
}

const StoreContactChannelEditor = forwardRef<StoreContactChannelEditorHandle, StoreContactChannelEditorProps>(
  function StoreContactChannelEditor(
    {
      entries,
      onAdd,
      onUpdate,
      onRemove,
      countryCode = null,
      typeInputName,
      valueInputName,
      labels,
      onFormOpenChange,
      hideTrigger,
    },
    ref,
  ) {
    const [pendingType, setPendingType] = useState<StoreContactChannelType>(STORE_CONTACT_CHANNEL_TYPES[0]);
    const [pendingValue, setPendingValue] = useState("");
    const [pendingError, setPendingError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingType, setEditingType] = useState<StoreContactChannelType>(STORE_CONTACT_CHANNEL_TYPES[0]);
    const [editingValue, setEditingValue] = useState("");
    const [editingError, setEditingError] = useState<string | null>(null);

    useEffect(() => {
      onFormOpenChange?.(showForm);
    }, [showForm, onFormOpenChange]);

    const handleOpenForm = () => {
      setPendingType(STORE_CONTACT_CHANNEL_TYPES[0]);
      setPendingValue("");
      setPendingError(null);
      setShowForm(true);
    };

    useImperativeHandle(ref, () => ({ openForm: handleOpenForm }));

    const handleCancelForm = () => {
      setShowForm(false);
      setPendingValue("");
      setPendingError(null);
    };

    const handleAdd = () => {
      const resolved = resolveChannelValue(pendingType, pendingValue, countryCode);
      if (!resolved.ok) {
        setPendingError(resolved.error);
        return;
      }
      onAdd({ type: pendingType, value: resolved.value });
      setPendingValue("");
      setPendingError(null);
      setShowForm(false);
    };

    const handleStartEdit = (entry: ContactChannelEntry) => {
      setEditingId(entry.id);
      setEditingType(entry.type);
      setEditingValue(entry.value);
      setEditingError(null);
    };

    const handleCancelEdit = () => {
      setEditingId(null);
      setEditingValue("");
      setEditingError(null);
    };

    const handleSaveEdit = () => {
      if (!editingValue.trim() || editingId == null) return;
      const resolved = resolveChannelValue(editingType, editingValue, countryCode);
      if (!resolved.ok) {
        setEditingError(resolved.error);
        return;
      }
      onUpdate(editingId, { type: editingType, value: resolved.value });
      setEditingId(null);
      setEditingValue("");
      setEditingError(null);
    };

    const channelTypeOptions = useMemo(
      () =>
        STORE_CONTACT_CHANNEL_TYPES.map((type) => ({
          value: type,
          label: labels.optionLabel(type),
        })),
      [labels],
    );

    const renderValidationError = (errorKey: string) => {
      const msg = labels.validationError?.(errorKey);
      if (!msg) return null;
      return <FieldErrorMsg className="mt-1.5">{msg}</FieldErrorMsg>;
    };

    return (
      <div className="space-y-3">
        {typeInputName
          ? entries.map((entry) => (
              <input key={`hidden-${entry.id}`} type="hidden" name={typeInputName} value={entry.type} />
            ))
          : null}
        {valueInputName
          ? entries.map((entry) => (
              <input key={`hidden-value-${entry.id}`} type="hidden" name={valueInputName} value={entry.value} />
            ))
          : null}

        {entries.length === 0 && !showForm && labels.empty && (
          <div className="flex items-center justify-center rounded-[var(--radius-lg)] px-4 py-5 [border:1px_solid_var(--border)]">
            <p className="text-xs [color:var(--text-muted)]">{labels.empty}</p>
          </div>
        )}

        {entries.length > 0 && (
          // `overflow-hidden` here was clipping the channel-type `Select`'s popup, which is
          // absolutely positioned inside this box. The rounded corners it was there to clip are
          // now handled by the rows themselves.
          <div className="rounded-[var(--radius-lg)] [border:1px_solid_var(--border)] [&>*:first-child]:rounded-t-[var(--radius-lg)] [&>*:last-child]:rounded-b-[var(--radius-lg)]">
            {entries.map((entry, idx) =>
              editingId === entry.id ? (
                <div
                  key={entry.id}
                  className={cn(
                    "flex flex-wrap items-start gap-2 px-3 py-2.5 [background:var(--surface-elevated)]",
                    idx > 0 && "[border-top:1px_solid_var(--border)]",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-[150px] flex-shrink-0">
                      <Select
                        value={editingType}
                        onChange={(value) => setEditingType(value as StoreContactChannelType)}
                        options={channelTypeOptions}
                        aria-label={labels.typeLabel}
                      />
                    </div>
                    <div className="min-w-[120px] flex-1">
                      <Input
                        type="text"
                        value={editingValue}
                        onChange={(event) => {
                          setEditingValue(event.target.value);
                          setEditingError(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleSaveEdit();
                          } else if (event.key === "Escape") {
                            handleCancelEdit();
                          }
                        }}
                        placeholder={labels.valuePlaceholder(editingType)}
                        aria-label={labels.valueLabel}
                        error={!!editingError}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="tonal"
                      onClick={handleSaveEdit}
                      disabled={!editingValue.trim()}
                      leadingIcon={<Check size={14} aria-hidden />}
                    >
                      {labels.save}
                    </Button>
                    <Button type="button" variant="ghost" onClick={handleCancelEdit}>
                      {labels.cancel}
                    </Button>
                  </div>
                  {editingError && renderValidationError(editingError)}
                </div>
              ) : (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5",
                    idx > 0 && "[border-top:1px_solid_var(--border)]",
                  )}
                >
                  <span className="flex size-7 flex-shrink-0 items-center justify-center [color:var(--accent-cool)]">
                    {getStoreContactChannelIcon(entry.type, 16)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs [color:var(--text-muted)]">{labels.optionLabel(entry.type)}</div>
                    <div className="truncate text-sm [color:var(--text-primary)]">{entry.value}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(entry)}
                    aria-label={labels.edit}
                    // Tap target >=44x44 on mobile via the `::before` pseudo (same mechanism as
                    // `IconButton`/`StorePaymentRow`): padding inside a fixed `size-7` box never
                    // grows the box, so `inset:-8px` expands the hit area outward instead.
                    // `md:before:inset-0` drops the extra area on desktop.
                    className="relative flex size-7 items-center justify-center rounded [color:var(--text-muted)] before:absolute before:[inset:-8px] before:content-[''] hover:[color:var(--text-primary)] focus-visible:[outline:2px_solid_var(--focus-ring)] md:before:inset-0"
                  >
                    <Pencil size={13} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(entry.id)}
                    aria-label={labels.remove}
                    // Same mechanism as the edit button above, plus `ml-2`: the row's `gap-3` (12px)
                    // plus each button's `inset:-8px` expansion needs 16px of clearance between the
                    // two boxes or the later element in the DOM (this one) claims the overlap and
                    // the edit button loses part of its 44px. `ml-2` adds 8px, for 20px total.
                    // Dropped on desktop, where `md:before:inset-0` removes the expansion.
                    className="relative ml-2 flex size-7 items-center justify-center rounded [color:var(--text-muted)] before:absolute before:[inset:-8px] before:content-[''] hover:[color:var(--text-primary)] focus-visible:[outline:2px_solid_var(--focus-ring)] md:ml-0 md:before:inset-0"
                  >
                    <X size={13} aria-hidden />
                  </button>
                </div>
              ),
            )}
          </div>
        )}

        {showForm ? (
          <div className="rounded-[var(--radius-lg)] p-3 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <Typography size="xs" className="[color:var(--text-muted)]">
                {labels.helper}
              </Typography>
              <button
                type="button"
                onClick={handleCancelForm}
                aria-label={labels.cancel}
                // Same `::before` mechanism as the row buttons above, at `inset:-10px` because this
                // box is `size-6` (24 + 2×10 = 44). Its only neighbour is the non-interactive helper
                // `<Typography>` pushed to the other side by `justify-between`, so no extra
                // clearance is needed. `md:before:inset-0` drops the extra area on desktop.
                className="relative flex size-6 flex-shrink-0 items-center justify-center rounded [color:var(--text-muted)] before:absolute before:[inset:-10px] before:content-[''] hover:[color:var(--text-primary)] focus-visible:[outline:2px_solid_var(--focus-ring)] md:before:inset-0"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-[150px] flex-shrink-0">
                <Select
                  value={pendingType}
                  onChange={(value) => {
                    setPendingType(value as StoreContactChannelType);
                    setPendingError(null);
                  }}
                  options={channelTypeOptions}
                  aria-label={labels.typeLabel}
                />
              </div>
              <div className="min-w-[120px] flex-1">
                <Input
                  type="text"
                  value={pendingValue}
                  onChange={(event) => {
                    setPendingValue(event.target.value);
                    setPendingError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAdd();
                    } else if (event.key === "Escape") {
                      handleCancelForm();
                    }
                  }}
                  placeholder={labels.valuePlaceholder(pendingType)}
                  aria-label={labels.valueLabel}
                  error={!!pendingError}
                />
              </div>
              <Button
                type="button"
                variant="tonal"
                onClick={handleAdd}
                disabled={!pendingValue.trim()}
                leadingIcon={<Plus size={14} aria-hidden />}
                className="h-[2.875rem]"
              >
                {labels.addButton}
              </Button>
            </div>
            {pendingError && renderValidationError(pendingError)}
          </div>
        ) : !hideTrigger ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleOpenForm}
            leadingIcon={<Plus size={13} aria-hidden />}
          >
            {labels.addChannel}
          </Button>
        ) : null}
      </div>
    );
  },
);

export default StoreContactChannelEditor;
