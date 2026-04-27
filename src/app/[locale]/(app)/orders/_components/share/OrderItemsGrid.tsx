"use client";

import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/core/Input";
import Select from "@/components/core/Select";
import Button from "@/components/core/Button/Button";
import { cn } from "@/lib/styles";
import { sanitizeDecimalInput } from "@/lib/decimalInput";
import { inheritProductTypeFromPrevious } from "@/lib/orders/orderItemUtils";

export type ItemRow = {
  rowId: string;
  id?: string;
  name: string;
  quantity: string;
  unitPrice: string;
  productTypeKey: string;
};

// Logical left-to-right column order inside an item row. Used by the
// Ctrl+Shift+arrow navigation to compute focus targets.
type ColumnKey = "name" | "qty" | "price" | "type";
const COLUMN_ORDER: readonly ColumnKey[] = ["name", "qty", "price", "type"] as const;

function cellInputId(column: ColumnKey, rowId: string): string {
  return `item-${column}-${rowId}`;
}

function focusCell(column: ColumnKey, rowId: string, selectText = true) {
  window.requestAnimationFrame(() => {
    const el = document.getElementById(cellInputId(column, rowId));
    if (!el) return;
    el.focus();
    if (selectText && el instanceof HTMLInputElement) {
      try {
        el.select();
      } catch {
        // Some input types (e.g. number) may throw on .select() in older browsers; safe to ignore.
      }
    }
  });
}

type CellKeyDownContext = {
  column: ColumnKey;
  rowId: string;
};

type OrderItemRowProps = {
  row: ItemRow;
  index: number;
  productTypeKeys: string[];
  tProductTypes: (key: string) => string;
  nameError?: string;
  quantityError?: string;
  unitPriceError?: string;
  onNameChange: (rowId: string, value: string) => void;
  onQuantityChange: (rowId: string, value: string) => void;
  onUnitPriceChange: (rowId: string, value: string) => void;
  onProductTypeChange: (rowId: string, value: string) => void;
  onDelete: (rowId: string) => void;
  onCellKeyDown: (e: React.KeyboardEvent, ctx: CellKeyDownContext) => void;
};

function OrderItemRow({
  row,
  index,
  productTypeKeys,
  tProductTypes,
  nameError,
  quantityError,
  unitPriceError,
  onNameChange,
  onQuantityChange,
  onUnitPriceChange,
  onProductTypeChange,
  onDelete,
  onCellKeyDown,
}: OrderItemRowProps) {
  const t = useTranslations("orders.form");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.rowId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group border-border bg-background rounded-lg border",
        "md:flex md:items-center md:gap-2 md:rounded-none md:border-0 md:border-b md:px-2 md:py-1.5",
        isDragging && "shadow-lg",
      )}
    >
      <div className="hidden items-center md:flex">
        <button
          type="button"
          aria-label={t("itemDragLabel")}
          className="text-text-muted cursor-grab opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden />
        </button>
      </div>

      <div className="md:hidden">
        <button
          type="button"
          aria-label={t("itemDragLabel")}
          className={cn(
            "text-text-muted float-right m-2 cursor-grab opacity-30 active:cursor-grabbing",
            isDragging && "opacity-100",
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-2 p-3 md:contents">
        <div className="md:min-w-0 md:flex-1">
          <label className="text-text-muted mb-0.5 block text-xs md:sr-only" htmlFor={cellInputId("name", row.rowId)}>
            {t("itemNameLabel")}
          </label>
          <Input
            id={cellInputId("name", row.rowId)}
            type="text"
            value={row.name}
            placeholder={t("itemNamePlaceholder")}
            error={!!nameError}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? `item-name-error-${row.rowId}` : undefined}
            onChange={(e) => onNameChange(row.rowId, e.target.value)}
            onKeyDown={(e) => onCellKeyDown(e, { column: "name", rowId: row.rowId })}
            onBlur={() => {}}
          />
          {nameError && (
            <p id={`item-name-error-${row.rowId}`} className="text-destructive mt-0.5 text-xs" role="alert">
              {nameError}
            </p>
          )}
        </div>

        <div className="flex gap-2 md:contents">
          <div className="md:w-20">
            <label className="text-text-muted mb-0.5 block text-xs md:sr-only" htmlFor={cellInputId("qty", row.rowId)}>
              {t("itemQuantityLabel")}
            </label>
            <Input
              id={cellInputId("qty", row.rowId)}
              type="number"
              min="1"
              step="1"
              value={row.quantity}
              error={!!quantityError}
              aria-invalid={!!quantityError}
              onChange={(e) => onQuantityChange(row.rowId, e.target.value)}
              onKeyDown={(e) => onCellKeyDown(e, { column: "qty", rowId: row.rowId })}
            />
          </div>

          <div className="md:w-28">
            <label
              className="text-text-muted mb-0.5 block text-xs md:sr-only"
              htmlFor={cellInputId("price", row.rowId)}
            >
              {t("itemUnitPriceLabel")}
            </label>
            <Input
              id={cellInputId("price", row.rowId)}
              type="text"
              inputMode="decimal"
              value={row.unitPrice}
              placeholder={t("itemUnitPricePlaceholder")}
              error={!!unitPriceError}
              aria-invalid={!!unitPriceError}
              aria-describedby={unitPriceError ? `item-price-error-${row.rowId}` : undefined}
              onChange={(e) => onUnitPriceChange(row.rowId, sanitizeDecimalInput(e.target.value))}
              onKeyDown={(e) => onCellKeyDown(e, { column: "price", rowId: row.rowId })}
            />
            {unitPriceError && (
              <p id={`item-price-error-${row.rowId}`} className="text-destructive mt-0.5 text-xs" role="alert">
                {unitPriceError}
              </p>
            )}
          </div>

          <div className="min-w-0 flex-1 md:w-36 md:flex-none">
            <label className="text-text-muted mb-0.5 block text-xs md:sr-only" htmlFor={cellInputId("type", row.rowId)}>
              {t("itemProductTypeLabel")}
            </label>
            <Select
              id={cellInputId("type", row.rowId)}
              value={row.productTypeKey}
              onChange={(e) => onProductTypeChange(row.rowId, e.target.value)}
              onKeyDown={(e) => onCellKeyDown(e, { column: "type", rowId: row.rowId })}
            >
              <option value="">{t("itemProductTypePlaceholder")}</option>
              {productTypeKeys.map((key) => (
                <option key={key} value={key}>
                  {tProductTypes(key)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end p-2 md:p-0">
        <button
          type="button"
          aria-label={`${t("itemDeleteLabel")} ${index + 1}`}
          onClick={() => onDelete(row.rowId)}
          className="text-text-muted hover:text-destructive focus-visible:ring-ring rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}

type OrderItemsGridProps = {
  rows: ItemRow[];
  onChange: (rows: ItemRow[]) => void;
  productTypeKeys: string[];
  tProductTypes: (key: string) => string;
  itemErrors?: Record<string, { name?: string; quantity?: string; unitPrice?: string }>;
  createNewRow: () => ItemRow;
};

export function createEmptyRow(rowId: string): ItemRow {
  return {
    rowId,
    name: "",
    quantity: "1",
    unitPrice: "",
    productTypeKey: "",
  };
}

type RowInserterProps = {
  onInsert: () => void;
  label: string;
};

function RowInserter({ onInsert, label }: RowInserterProps) {
  return (
    <div className="relative hidden h-0 md:block">
      <button
        type="button"
        aria-label={label}
        onClick={onInsert}
        className={cn(
          "group/inserter absolute inset-x-0 top-0 z-10 flex h-3 -translate-y-1/2 items-center",
          "focus-visible:outline-none",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "bg-primary text-primary-foreground absolute top-1/2 left-2 flex size-4 -translate-y-1/2 items-center justify-center rounded-full shadow-sm",
            "opacity-0 transition-opacity",
            "group-hover/inserter:opacity-100 group-focus-visible/inserter:opacity-100",
          )}
        >
          <Plus size={10} aria-hidden />
        </span>
        <span
          aria-hidden
          className={cn(
            "bg-primary absolute top-1/2 right-0 left-6 block h-px -translate-y-1/2 opacity-0 transition-opacity",
            "group-hover/inserter:opacity-100 group-focus-visible/inserter:opacity-100",
          )}
        />
      </button>
    </div>
  );
}

export default function OrderItemsGrid({
  rows,
  onChange,
  productTypeKeys,
  tProductTypes,
  itemErrors = {},
  createNewRow,
}: OrderItemsGridProps) {
  const t = useTranslations("orders.form");
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = rows.findIndex((r) => r.rowId === active.id);
        const newIndex = rows.findIndex((r) => r.rowId === over.id);
        onChange(arrayMove(rows, oldIndex, newIndex));
      }
    },
    [rows, onChange],
  );

  const updateRow = useCallback(
    (rowId: string, updates: Partial<ItemRow>) => {
      onChange(rows.map((r) => (r.rowId === rowId ? { ...r, ...updates } : r)));
    },
    [rows, onChange],
  );

  // Build a new row seeded with the product type inherited from the nearest
  // non-empty preceding row. `insertIndex` is where the new row will land
  // (0..rows.length); the helper walks rows[insertIndex - 1] → rows[0].
  const buildInheritedRow = useCallback(
    (insertIndex: number): ItemRow => {
      const fresh = createNewRow();
      const inherited = inheritProductTypeFromPrevious(rows, insertIndex);
      return inherited ? { ...fresh, productTypeKey: inherited } : fresh;
    },
    [rows, createNewRow],
  );

  const handleAddRow = useCallback(() => {
    const newRow = buildInheritedRow(rows.length);
    onChange([...rows, newRow]);
    focusCell("name", newRow.rowId, false);
  }, [rows, onChange, buildInheritedRow]);

  const handleInsertRowAt = useCallback(
    (index: number) => {
      const newRow = buildInheritedRow(index);
      const next = [...rows.slice(0, index), newRow, ...rows.slice(index)];
      onChange(next);
      focusCell("name", newRow.rowId, false);
    },
    [rows, onChange, buildInheritedRow],
  );

  const handleDelete = useCallback(
    (rowId: string) => {
      const next = rows.filter((r) => r.rowId !== rowId);
      onChange(next);
    },
    [rows, onChange],
  );

  // Unified keyboard handler for all four cells of every row.
  //
  // Design decision: every functional shortcut uses `Ctrl + Shift` as the single
  // base combo — literal Ctrl on both Mac and Windows (`event.ctrlKey`, NOT
  // metaKey). Reason: this is the only combo that is free of OS-level bindings on
  // macOS (Ctrl alone is taken by Mission Control / Spaces) and free of browser
  // history conflicts on every major browser. `Alt` alone / Option alone triggered
  // Firefox history back/forward on Mac and Mission Control scroll. `Cmd/Ctrl`
  // alone conflicts with browser history nav. `Ctrl + Shift` is the safe harbor.
  //
  // Reordering uses `Alt + Shift + ↑/↓` (VSCode "move line" convention) as a
  // deliberately distinct combo — this is an advanced, rarely used action so it
  // earns its own key pattern rather than stacking a third modifier on top.
  //
  // Shortcut map (keep in sync with WO-04 "Item spreadsheet — keyboard"):
  //   Tab                               last cell (type) of last row → append new row (legacy, no modifier)
  //   Ctrl + Shift + ↑/↓                move focus to same column of previous / next row (hard stop at edges)
  //   Ctrl + Shift + ←/→                move focus to the previous / next column in the current row
  //   Ctrl + Shift + Enter              insert new row below the current row, focus its name cell
  //   Ctrl + Shift + Backspace | Delete delete current row, move focus to same column of previous (or next if first)
  //   Alt + Shift + ↑/↓                 reorder current row up / down one position, preserve focused cell
  //
  // Conflict trade-offs accepted:
  //   - Ctrl + Shift + ←/→ overrides the native "extend word selection" text-editing shortcut.
  //   - Ctrl + Shift + Backspace overrides "delete previous word" on some platforms.
  //   - Alt + Shift + ↑/↓ overrides "extend selection by paragraph" on some browsers.
  const handleCellKeyDown = useCallback(
    (event: React.KeyboardEvent, ctx: CellKeyDownContext) => {
      const key = event.key;
      const shift = event.shiftKey;
      // Literal Ctrl, NOT Cmd (metaKey). Ignore if Meta or Alt also pressed so we
      // don't steal unrelated chords.
      const ctrlShift = event.ctrlKey && shift && !event.metaKey && !event.altKey;
      // Alt + Shift only, no Ctrl / no Meta.
      const altShift = event.altKey && shift && !event.metaKey && !event.ctrlKey;

      const index = rows.findIndex((r) => r.rowId === ctx.rowId);
      if (index === -1) return;
      const isLastRow = index === rows.length - 1;

      // Tab on last cell of last row → append new row. No modifier.
      if (
        key === "Tab" &&
        !shift &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        isLastRow &&
        ctx.column === "type"
      ) {
        event.preventDefault();
        const newRow = buildInheritedRow(rows.length);
        onChange([...rows, newRow]);
        focusCell("name", newRow.rowId, false);
        return;
      }

      // Reorder: Alt + Shift + ↑/↓
      if (altShift && (key === "ArrowUp" || key === "ArrowDown")) {
        event.preventDefault();
        const direction = key === "ArrowUp" ? -1 : 1;
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= rows.length) return;
        onChange(arrayMove(rows, index, newIndex));
        focusCell(ctx.column, ctx.rowId, false);
        return;
      }

      // All other shortcuts below require Ctrl + Shift.
      if (!ctrlShift) return;

      if (key === "ArrowUp" || key === "ArrowDown") {
        event.preventDefault();
        const direction = key === "ArrowUp" ? -1 : 1;
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= rows.length) return;
        focusCell(ctx.column, rows[newIndex].rowId);
        return;
      }

      if (key === "ArrowLeft" || key === "ArrowRight") {
        event.preventDefault();
        const currentColumnIdx = COLUMN_ORDER.indexOf(ctx.column);
        const direction = key === "ArrowLeft" ? -1 : 1;
        const targetColumnIdx = currentColumnIdx + direction;
        if (targetColumnIdx < 0 || targetColumnIdx >= COLUMN_ORDER.length) return;
        focusCell(COLUMN_ORDER[targetColumnIdx], ctx.rowId);
        return;
      }

      if (key === "Enter") {
        event.preventDefault();
        const insertIndex = index + 1;
        const newRow = buildInheritedRow(insertIndex);
        const next = [...rows.slice(0, insertIndex), newRow, ...rows.slice(insertIndex)];
        onChange(next);
        focusCell("name", newRow.rowId, false);
        return;
      }

      if (key === "Backspace" || key === "Delete") {
        event.preventDefault();
        // "At least one row" invariant: never delete the last remaining row.
        if (rows.length <= 1) return;
        const next = rows.filter((_, i) => i !== index);
        onChange(next);
        const neighborIndex = index > 0 ? index - 1 : 0;
        const neighbor = next[Math.min(neighborIndex, next.length - 1)];
        if (neighbor) focusCell(ctx.column, neighbor.rowId);
        return;
      }
    },
    [rows, onChange, buildInheritedRow],
  );

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[24px_1fr_80px_112px_144px_32px] items-center gap-2 px-2 md:grid">
        <span />
        <span className="text-text-muted text-xs font-medium">{t("itemNameLabel")}</span>
        <span className="text-text-muted text-xs font-medium">{t("itemQuantityLabel")}</span>
        <span className="text-text-muted text-xs font-medium">{t("itemUnitPriceLabel")}</span>
        <span className="text-text-muted text-xs font-medium">{t("itemProductTypeLabel")}</span>
        <span />
      </div>

      <DndContext id="order-items-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r.rowId)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 md:space-y-0">
            {rows.map((row, index) => (
              <div key={row.rowId}>
                {index > 0 && (
                  <RowInserter onInsert={() => handleInsertRowAt(index)} label={t("itemInsertBetweenLabel")} />
                )}
                <OrderItemRow
                  row={row}
                  index={index}
                  productTypeKeys={productTypeKeys}
                  tProductTypes={tProductTypes}
                  nameError={itemErrors[row.rowId]?.name}
                  quantityError={itemErrors[row.rowId]?.quantity}
                  unitPriceError={itemErrors[row.rowId]?.unitPrice}
                  onNameChange={(rowId, value) => updateRow(rowId, { name: value })}
                  onQuantityChange={(rowId, value) => updateRow(rowId, { quantity: value })}
                  onUnitPriceChange={(rowId, value) => updateRow(rowId, { unitPrice: value })}
                  onProductTypeChange={(rowId, value) => updateRow(rowId, { productTypeKey: value })}
                  onDelete={handleDelete}
                  onCellKeyDown={handleCellKeyDown}
                />
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="pt-1">
        <Button ref={addButtonRef} type="button" variant="secondary" size="sm" onClick={handleAddRow}>
          <Plus size={14} className="mr-1" aria-hidden />
          {t("addItemButton")}
        </Button>
      </div>
    </div>
  );
}
