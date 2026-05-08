"use client";

import { AlertCircle, Check, Pencil, Plus, X } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Select from "@/components/core/Select";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";
import { getStoreContactChannelIcon } from "@/lib/catalog/storeContactChannelIcons";
import { STORE_CONTACT_CHANNEL_TYPES, type StoreContactChannelType } from "./StoreContactChannelList";

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

function validateChannelValue(type: StoreContactChannelType, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "required";

  switch (type) {
    case "INSTAGRAM":
      if (!/instagram\.com\//.test(trimmed)) return "INSTAGRAM";
      return null;
    case "WHATSAPP":
      if (!/^https?:\/\/(www\.)?wa\.me\//.test(trimmed) && !/^\+[1-9][\d\s\-()]{6,18}$/.test(trimmed))
        return "WHATSAPP";
      return null;
    case "EMAIL":
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "EMAIL";
      return null;
    case "PHONE":
      if (!/^\+[1-9][\d\s\-()]{6,18}$/.test(trimmed)) return "PHONE";
      return null;
    case "FACEBOOK":
      if (!/(facebook\.com|fb\.com)\//.test(trimmed)) return "FACEBOOK";
      return null;
    case "TIKTOK":
      if (!/tiktok\.com\//.test(trimmed)) return "TIKTOK";
      return null;
    case "WEBSITE":
      if (!/^https?:\/\//.test(trimmed)) return "WEBSITE";
      return null;
    case "OTHER":
      return null;
    default:
      return null;
  }
}

const StoreContactChannelEditor = forwardRef<StoreContactChannelEditorHandle, StoreContactChannelEditorProps>(
  function StoreContactChannelEditor(
    { entries, onAdd, onUpdate, onRemove, typeInputName, valueInputName, labels, onFormOpenChange, hideTrigger },
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
      const trimmed = pendingValue.trim();
      const error = validateChannelValue(pendingType, trimmed);
      if (error) {
        setPendingError(error);
        return;
      }
      onAdd({ type: pendingType, value: trimmed });
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
      const trimmed = editingValue.trim();
      if (!trimmed || editingId == null) return;
      const error = validateChannelValue(editingType, trimmed);
      if (error) {
        setEditingError(error);
        return;
      }
      onUpdate(editingId, { type: editingType, value: trimmed });
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
      return (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] [color:var(--destructive)]" role="alert">
          <AlertCircle size={13} aria-hidden />
          {msg}
        </p>
      );
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
          <div className="overflow-hidden rounded-[var(--radius-lg)] [border:1px_solid_var(--border)]">
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
                    className="flex size-7 items-center justify-center rounded [color:var(--text-muted)] hover:[color:var(--text-primary)] focus-visible:[outline:2px_solid_var(--focus-ring)]"
                  >
                    <Pencil size={13} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(entry.id)}
                    aria-label={labels.remove}
                    className="flex size-7 items-center justify-center rounded [color:var(--text-muted)] hover:[color:var(--text-primary)] focus-visible:[outline:2px_solid_var(--focus-ring)]"
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
                className="flex size-6 flex-shrink-0 items-center justify-center rounded [color:var(--text-muted)] hover:[color:var(--text-primary)] focus-visible:[outline:2px_solid_var(--focus-ring)]"
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
