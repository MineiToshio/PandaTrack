"use client";

import { Check, Pencil, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import Button from "@/components/core/Button/Button";
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
  edit: string;
  save: string;
  cancel: string;
  remove: string;
  optionLabel: (type: StoreContactChannelType) => string;
  valuePlaceholder: (type: StoreContactChannelType) => string;
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
};

/**
 * Display + inline-edit + inline-add channels editor used by both the create
 * and edit store wizards. Renders one read-only row per entry with edit/remove
 * controls, plus a compact form below to add new entries.
 */
export default function StoreContactChannelEditor({
  entries,
  onAdd,
  onUpdate,
  onRemove,
  typeInputName,
  valueInputName,
  labels,
}: StoreContactChannelEditorProps) {
  const [pendingType, setPendingType] = useState<StoreContactChannelType>(STORE_CONTACT_CHANNEL_TYPES[0]);
  const [pendingValue, setPendingValue] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingType, setEditingType] = useState<StoreContactChannelType>(STORE_CONTACT_CHANNEL_TYPES[0]);
  const [editingValue, setEditingValue] = useState("");

  const handleAdd = () => {
    const trimmed = pendingValue.trim();
    if (!trimmed) return;
    onAdd({ type: pendingType, value: trimmed });
    setPendingValue("");
  };

  const handleStartEdit = (entry: ContactChannelEntry) => {
    setEditingId(entry.id);
    setEditingType(entry.type);
    setEditingValue(entry.value);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const handleSaveEdit = () => {
    const trimmed = editingValue.trim();
    if (!trimmed || editingId == null) return;
    onUpdate(editingId, { type: editingType, value: trimmed });
    setEditingId(null);
    setEditingValue("");
  };

  const channelTypeOptions = useMemo(
    () =>
      STORE_CONTACT_CHANNEL_TYPES.map((type) => ({
        value: type,
        label: labels.optionLabel(type),
      })),
    [labels],
  );

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
      {entries.length > 0 && (
        <div className="overflow-hidden rounded-[var(--radius-lg)] [border:1px_solid_var(--border)]">
          {entries.map((entry, idx) =>
            editingId === entry.id ? (
              <div
                key={entry.id}
                className={cn(
                  "flex flex-wrap items-center gap-2 px-3 py-2.5 [background:var(--surface-elevated)]",
                  idx > 0 && "[border-top:1px_solid_var(--border)]",
                )}
              >
                <div className="w-[150px] flex-shrink-0">
                  <Select
                    value={editingType}
                    onChange={(value) => setEditingType(value as StoreContactChannelType)}
                    options={channelTypeOptions}
                    aria-label={labels.typeLabel}
                    size="sm"
                  />
                </div>
                <input
                  type="text"
                  value={editingValue}
                  onChange={(event) => setEditingValue(event.target.value)}
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
                  className="min-h-9 min-w-[120px] flex-1 rounded-[var(--radius-md)] px-3 text-sm [color:var(--text-primary)] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)] placeholder:[color:var(--text-muted)]"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={!editingValue.trim()}
                  leadingIcon={<Check size={13} aria-hidden />}
                >
                  {labels.save}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={handleCancelEdit}>
                  {labels.cancel}
                </Button>
              </div>
            ) : (
              <div
                key={entry.id}
                className={cn("flex items-center gap-3 px-3 py-2.5", idx > 0 && "[border-top:1px_solid_var(--border)]")}
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
      <div className="rounded-[var(--radius-lg)] p-3 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
        <Typography size="xs" className="mb-2.5 [color:var(--text-muted)]">
          {labels.helper}
        </Typography>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[150px] flex-shrink-0">
            <Select
              value={pendingType}
              onChange={(value) => setPendingType(value as StoreContactChannelType)}
              options={channelTypeOptions}
              aria-label={labels.typeLabel}
              size="sm"
            />
          </div>
          <input
            type="text"
            value={pendingValue}
            onChange={(event) => setPendingValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAdd();
              }
            }}
            placeholder={labels.valuePlaceholder(pendingType)}
            aria-label={labels.valueLabel}
            className="min-h-9 min-w-[120px] flex-1 rounded-[var(--radius-md)] px-3 text-sm [color:var(--text-primary)] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)] placeholder:[color:var(--text-muted)]"
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleAdd}
            disabled={!pendingValue.trim()}
            leadingIcon={<Plus size={13} aria-hidden />}
          >
            {labels.addButton}
          </Button>
        </div>
      </div>
    </div>
  );
}
