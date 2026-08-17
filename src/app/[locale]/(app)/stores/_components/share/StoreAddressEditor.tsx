"use client";

import { Check, MapPin, Pencil, Plus, X } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";

export type AddressEntry = {
  id: number;
  city: string;
  addressLine: string;
  reference: string;
};

type AddressPayload = {
  city: string;
  addressLine: string;
  reference: string;
};

type Labels = {
  cityLabel: string;
  addressLineLabel: string;
  referenceLabel: string;
  helper: string;
  addButton: string;
  addAddress: string;
  edit: string;
  save: string;
  cancel: string;
  remove: string;
  /** Shown inside a bordered container when there are no entries and the add form is closed. */
  empty?: string;
};

export type StoreAddressEditorHandle = {
  /** Programmatically opens the add-address form. */
  openForm: () => void;
};

export type StoreAddressEditorProps = {
  entries: AddressEntry[];
  onAdd: (entry: AddressPayload) => void;
  onUpdate: (id: number, next: AddressPayload) => void;
  onRemove: (id: number) => void;
  /** Hidden input names so values are submitted with the parent form. */
  cityInputName?: string;
  addressLineInputName?: string;
  referenceInputName?: string;
  labels: Labels;
  onFormOpenChange?: (open: boolean) => void;
  /**
   * When true, hides the internal "Añadir dirección" ghost trigger.
   * Open the form externally via a ref (StoreAddressEditorHandle).
   */
  hideTrigger?: boolean;
};

const StoreAddressEditor = forwardRef<StoreAddressEditorHandle, StoreAddressEditorProps>(function StoreAddressEditor(
  {
    entries,
    onAdd,
    onUpdate,
    onRemove,
    cityInputName,
    addressLineInputName,
    referenceInputName,
    labels,
    onFormOpenChange,
    hideTrigger,
  },
  ref,
) {
  const [pendingCity, setPendingCity] = useState("");
  const [pendingAddressLine, setPendingAddressLine] = useState("");
  const [pendingReference, setPendingReference] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingCity, setEditingCity] = useState("");
  const [editingAddressLine, setEditingAddressLine] = useState("");
  const [editingReference, setEditingReference] = useState("");

  useEffect(() => {
    onFormOpenChange?.(showForm);
  }, [showForm, onFormOpenChange]);

  const handleOpenForm = () => {
    setPendingCity("");
    setPendingAddressLine("");
    setPendingReference("");
    setShowForm(true);
  };

  useImperativeHandle(ref, () => ({ openForm: handleOpenForm }));

  const handleCancelForm = () => {
    setShowForm(false);
    setPendingCity("");
    setPendingAddressLine("");
    setPendingReference("");
  };

  const handleAdd = () => {
    const trimmed = pendingAddressLine.trim();
    if (!trimmed) return;
    onAdd({ city: pendingCity.trim(), addressLine: trimmed, reference: pendingReference.trim() });
    setPendingCity("");
    setPendingAddressLine("");
    setPendingReference("");
    setShowForm(false);
  };

  const handleStartEdit = (entry: AddressEntry) => {
    setEditingId(entry.id);
    setEditingCity(entry.city);
    setEditingAddressLine(entry.addressLine);
    setEditingReference(entry.reference);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingCity("");
    setEditingAddressLine("");
    setEditingReference("");
  };

  const handleSaveEdit = () => {
    const trimmed = editingAddressLine.trim();
    if (!trimmed || editingId == null) return;
    onUpdate(editingId, { city: editingCity.trim(), addressLine: trimmed, reference: editingReference.trim() });
    setEditingId(null);
    setEditingCity("");
    setEditingAddressLine("");
    setEditingReference("");
  };

  return (
    <div className="space-y-3">
      {/* Hidden inputs for form submission */}
      {cityInputName
        ? entries.map((entry) => (
            <input key={`hidden-city-${entry.id}`} type="hidden" name={cityInputName} value={entry.city} />
          ))
        : null}
      {addressLineInputName
        ? entries.map((entry) => (
            <input
              key={`hidden-line-${entry.id}`}
              type="hidden"
              name={addressLineInputName}
              value={entry.addressLine}
            />
          ))
        : null}
      {referenceInputName
        ? entries.map((entry) => (
            <input key={`hidden-ref-${entry.id}`} type="hidden" name={referenceInputName} value={entry.reference} />
          ))
        : null}

      {/* Empty state */}
      {entries.length === 0 && !showForm && labels.empty && (
        <div className="flex items-center justify-center rounded-[var(--radius-lg)] px-4 py-5 [border:1px_solid_var(--border)]">
          <p className="text-xs [color:var(--text-muted)]">{labels.empty}</p>
        </div>
      )}

      {/* Saved entries list */}
      {entries.length > 0 && (
        <div className="overflow-hidden rounded-[var(--radius-lg)] [border:1px_solid_var(--border)]">
          {entries.map((entry, idx) =>
            editingId === entry.id ? (
              <div
                key={entry.id}
                className={cn(
                  "space-y-2 px-3 py-2.5 [background:var(--surface-elevated)]",
                  idx > 0 && "[border-top:1px_solid_var(--border)]",
                )}
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`edit-city-${entry.id}`} className="text-xs">
                      {labels.cityLabel}
                    </Label>
                    <Input
                      id={`edit-city-${entry.id}`}
                      type="text"
                      value={editingCity}
                      onChange={(e) => setEditingCity(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`edit-line-${entry.id}`} className="text-xs">
                      {labels.addressLineLabel}
                    </Label>
                    <Input
                      id={`edit-line-${entry.id}`}
                      type="text"
                      value={editingAddressLine}
                      onChange={(e) => setEditingAddressLine(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveEdit();
                        } else if (e.key === "Escape") {
                          handleCancelEdit();
                        }
                      }}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor={`edit-ref-${entry.id}`} className="text-xs">
                    {labels.referenceLabel}
                  </Label>
                  <Input
                    id={`edit-ref-${entry.id}`}
                    type="text"
                    value={editingReference}
                    onChange={(e) => setEditingReference(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="tonal"
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={!editingAddressLine.trim()}
                    leadingIcon={<Check size={14} aria-hidden />}
                  >
                    {labels.save}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={handleCancelEdit}>
                    {labels.cancel}
                  </Button>
                </div>
              </div>
            ) : (
              <div
                key={entry.id}
                className={cn("flex items-center gap-3 px-3 py-2.5", idx > 0 && "[border-top:1px_solid_var(--border)]")}
              >
                <span className="flex size-7 flex-shrink-0 items-center justify-center [color:var(--accent-cool)]">
                  <MapPin size={14} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  {entry.city && <div className="text-xs [color:var(--text-muted)]">{entry.city}</div>}
                  <div className="truncate text-sm [color:var(--text-primary)]">
                    {entry.reference ? `${entry.addressLine} · ${entry.reference}` : entry.addressLine}
                  </div>
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
                  // two boxes or the later element in the DOM (this one) claims the overlap and the
                  // edit button loses part of its 44px. `ml-2` adds 8px, for 20px total. Dropped on
                  // desktop, where `md:before:inset-0` removes the expansion.
                  className="relative ml-2 flex size-7 items-center justify-center rounded [color:var(--text-muted)] before:absolute before:[inset:-8px] before:content-[''] hover:[color:var(--text-primary)] focus-visible:[outline:2px_solid_var(--focus-ring)] md:ml-0 md:before:inset-0"
                >
                  <X size={13} aria-hidden />
                </button>
              </div>
            ),
          )}
        </div>
      )}

      {/* Add form */}
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
              // `<Typography>` pushed to the other side by `justify-between`, so no extra clearance
              // is needed. `md:before:inset-0` drops the extra area on desktop.
              className="relative flex size-6 flex-shrink-0 items-center justify-center rounded [color:var(--text-muted)] before:absolute before:[inset:-10px] before:content-[''] hover:[color:var(--text-primary)] focus-visible:[outline:2px_solid_var(--focus-ring)] md:before:inset-0"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="pending-address-city" className="text-xs">
                  {labels.cityLabel}
                </Label>
                <Input
                  id="pending-address-city"
                  type="text"
                  value={pendingCity}
                  onChange={(e) => setPendingCity(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pending-address-line" className="text-xs">
                  {labels.addressLineLabel}
                </Label>
                <Input
                  id="pending-address-line"
                  type="text"
                  value={pendingAddressLine}
                  onChange={(e) => setPendingAddressLine(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    } else if (e.key === "Escape") {
                      handleCancelForm();
                    }
                  }}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="pending-address-reference" className="text-xs">
                {labels.referenceLabel}
              </Label>
              <Input
                id="pending-address-reference"
                type="text"
                value={pendingReference}
                onChange={(e) => setPendingReference(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="tonal"
              onClick={handleAdd}
              disabled={!pendingAddressLine.trim()}
              leadingIcon={<Plus size={14} aria-hidden />}
              className="h-[2.875rem]"
            >
              {labels.addButton}
            </Button>
          </div>
        </div>
      ) : !hideTrigger ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleOpenForm}
          leadingIcon={<Plus size={13} aria-hidden />}
        >
          {labels.addAddress}
        </Button>
      ) : null}
    </div>
  );
});

export default StoreAddressEditor;
