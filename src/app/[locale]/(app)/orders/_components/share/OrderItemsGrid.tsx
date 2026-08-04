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
import { GripVertical, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/styles";
import { sanitizeDecimalInput } from "@/lib/decimalInput";
import { inheritProductTypeFromPrevious } from "@/lib/orders/orderItemUtils";
import ItemTypePicker from "./ItemTypePicker";

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

// Borderless transparent cell input — matches the demo spreadsheet styling
// (font-size 13px, no border, subtle focus tint, radius 5px).
const CELL_INPUT_BASE =
  "w-full border-0 bg-transparent text-[13px] [color:var(--text-primary)] rounded-[5px] " +
  "placeholder:[color:var(--text-muted)] focus:outline-none " +
  "focus:[background:color-mix(in_oklch,var(--accent)_8%,transparent)]";

type OrderItemRowProps = {
  row: ItemRow;
  index: number;
  productTypeKeys: string[];
  tProductTypes: (key: string) => string;
  nameError?: string;
  quantityError?: string;
  unitPriceError?: string;
  typePickerOpen: boolean;
  onTypePickerOpenChange: (open: boolean) => void;
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
  typePickerOpen,
  onTypePickerOpenChange,
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
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "[box-shadow:0_6px_20px_color-mix(in_oklch,black_22%,transparent)]")}
    >
      {/* Drag handle */}
      <td className="px-[3px] py-[2px] text-center align-middle">
        <button
          type="button"
          aria-label={t("itemDragLabel")}
          className="inline-flex cursor-grab [color:var(--text-muted)] opacity-35 transition-opacity hover:opacity-70 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} aria-hidden />
        </button>
      </td>

      {/* Name */}
      <td className="px-[3px] py-[2px]">
        <input
          id={cellInputId("name", row.rowId)}
          type="text"
          value={row.name}
          placeholder={t("itemNamePlaceholder")}
          aria-label={t("itemNameLabel")}
          aria-invalid={!!nameError}
          aria-describedby={nameError ? `item-name-error-${row.rowId}` : undefined}
          onChange={(e) => onNameChange(row.rowId, e.target.value)}
          onKeyDown={(e) => onCellKeyDown(e, { column: "name", rowId: row.rowId })}
          className={cn(
            CELL_INPUT_BASE,
            "min-w-[160px] px-1.5 py-1.5",
            nameError && "[box-shadow:inset_0_0_0_1px_var(--destructive)]",
          )}
        />
        {nameError && (
          <p
            id={`item-name-error-${row.rowId}`}
            className="mt-0.5 px-1.5 text-[11px] [color:var(--destructive)]"
            role="alert"
          >
            {nameError}
          </p>
        )}
      </td>

      {/* Quantity */}
      <td className="px-[3px] py-[2px] text-right align-top">
        <input
          id={cellInputId("qty", row.rowId)}
          type="number"
          min="1"
          step="1"
          value={row.quantity}
          aria-label={t("itemQuantityLabel")}
          aria-invalid={!!quantityError}
          onChange={(e) => onQuantityChange(row.rowId, e.target.value)}
          onKeyDown={(e) => onCellKeyDown(e, { column: "qty", rowId: row.rowId })}
          className={cn(
            CELL_INPUT_BASE,
            "w-[52px] px-1 py-1.5 text-right",
            quantityError && "[box-shadow:inset_0_0_0_1px_var(--destructive)]",
          )}
        />
      </td>

      {/* Unit price */}
      <td className="px-[3px] py-[2px] text-right align-top">
        <input
          id={cellInputId("price", row.rowId)}
          type="text"
          inputMode="decimal"
          value={row.unitPrice}
          placeholder="—"
          aria-label={t("itemUnitPriceLabel")}
          aria-invalid={!!unitPriceError}
          aria-describedby={unitPriceError ? `item-price-error-${row.rowId}` : undefined}
          onChange={(e) => onUnitPriceChange(row.rowId, e.target.value)}
          onKeyDown={(e) => onCellKeyDown(e, { column: "price", rowId: row.rowId })}
          className={cn(
            CELL_INPUT_BASE,
            "w-[110px] px-1 py-1.5 text-right",
            unitPriceError && "[box-shadow:inset_0_0_0_1px_var(--destructive)]",
          )}
        />
        {unitPriceError && (
          <p
            id={`item-price-error-${row.rowId}`}
            className="mt-0.5 text-[11px] [color:var(--destructive)]"
            role="alert"
          >
            {unitPriceError}
          </p>
        )}
      </td>

      {/* Type */}
      <td className="px-[3px] py-[2px] align-top">
        <ItemTypePicker
          instanceId={row.rowId}
          triggerId={cellInputId("type", row.rowId)}
          value={row.productTypeKey}
          productTypeKeys={productTypeKeys}
          tProductTypes={tProductTypes}
          placeholder={t("itemProductTypePlaceholder")}
          ariaLabelFor={(label) => `${t("itemProductTypeLabel")}: ${label}`}
          open={typePickerOpen}
          onOpenChange={onTypePickerOpenChange}
          onChange={(value) => onProductTypeChange(row.rowId, value)}
          onKeyDown={(e) => onCellKeyDown(e, { column: "type", rowId: row.rowId })}
        />
      </td>

      {/* Delete */}
      <td className="px-[3px] py-[2px] align-top">
        <div className="flex items-center justify-center gap-0.5">
          <button
            type="button"
            aria-label={`${t("itemDeleteLabel")} ${index + 1}`}
            onClick={() => onDelete(row.rowId)}
            className="inline-flex items-center rounded p-1 [color:var(--text-muted)] transition-colors hover:[color:var(--destructive)] focus-visible:[box-shadow:0_0_0_2px_var(--focus-ring)] focus-visible:outline-none"
          >
            <X size={13} aria-hidden />
          </button>
        </div>
      </td>
    </tr>
  );
}

type OrderItemsGridProps = {
  rows: ItemRow[];
  onChange: (rows: ItemRow[]) => void;
  productTypeKeys: string[];
  tProductTypes: (key: string) => string;
  itemErrors?: Record<string, { name?: string; quantity?: string; unitPrice?: string }>;
  createNewRow: () => ItemRow;
  /** Currency code shown in the "Precio unit. ({currency})" header. */
  currencyCode?: string;
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

export default function OrderItemsGrid({
  rows,
  onChange,
  productTypeKeys,
  tProductTypes,
  itemErrors = {},
  createNewRow,
  currencyCode,
}: OrderItemsGridProps) {
  const t = useTranslations("orders.form");
  const [openTypePickerRowId, setOpenTypePickerRowId] = useState<string | null>(null);

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
  // history conflicts on every major browser. `Ctrl + Shift` is the safe harbor.
  //
  // Reordering uses `Alt + Shift + ↑/↓` (VSCode "move line" convention).
  //
  // Shortcut map (keep in sync with the item spreadsheet's keyboard shortcuts):
  //   Tab                               last cell (type) of last row → append new row
  //   Ctrl + Shift + ↑/↓                move focus to same column of previous / next row
  //   Ctrl + Shift + ←/→                move focus to the previous / next column in the current row
  //   Ctrl + Shift + Enter              insert new row below the current row, focus its name cell
  //   Ctrl + Shift + Backspace | Delete delete current row, move focus to same column of previous
  //   Alt + Shift + ↑/↓                 reorder current row up / down one position
  const handleCellKeyDown = useCallback(
    (event: React.KeyboardEvent, ctx: CellKeyDownContext) => {
      const key = event.key;
      const shift = event.shiftKey;
      const ctrlShift = event.ctrlKey && shift && !event.metaKey && !event.altKey;
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

  const headerCellClass =
    "[border-bottom:1px_solid_var(--border)] px-1.5 pt-[3px] pb-[7px] text-[11px] font-semibold [color:var(--text-muted)] whitespace-nowrap";

  const priceHeader = currencyCode ? `${t("itemUnitPriceLabel")} (${currencyCode})` : t("itemUnitPriceLabel");

  return (
    <div className="-mx-1 overflow-x-auto">
      <DndContext id="order-items-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <table role="grid" aria-label={t("itemsSectionTitle")} className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th scope="col" className="w-6 [border-bottom:1px_solid_var(--border)]" />
              <th scope="col" className={cn(headerCellClass, "text-left")}>
                {t("itemNameLabel")}
              </th>
              <th scope="col" className={cn(headerCellClass, "w-16 text-right")}>
                {t("itemQuantityLabel")}
              </th>
              <th scope="col" className={cn(headerCellClass, "w-[130px] text-right")}>
                {priceHeader}
              </th>
              <th scope="col" className={cn(headerCellClass, "w-[110px] text-left")}>
                {t("itemProductTypeLabel")}
              </th>
              <th scope="col" className="w-14 [border-bottom:1px_solid_var(--border)]" />
            </tr>
          </thead>
          <tbody>
            <SortableContext items={rows.map((r) => r.rowId)} strategy={verticalListSortingStrategy}>
              {rows.map((row, index) => (
                <OrderItemRow
                  key={row.rowId}
                  row={row}
                  index={index}
                  productTypeKeys={productTypeKeys}
                  tProductTypes={tProductTypes}
                  nameError={itemErrors[row.rowId]?.name}
                  quantityError={itemErrors[row.rowId]?.quantity}
                  unitPriceError={itemErrors[row.rowId]?.unitPrice}
                  typePickerOpen={openTypePickerRowId === row.rowId}
                  onTypePickerOpenChange={(open) => setOpenTypePickerRowId(open ? row.rowId : null)}
                  onNameChange={(rowId, value) => updateRow(rowId, { name: value })}
                  onQuantityChange={(rowId, value) => updateRow(rowId, { quantity: value })}
                  onUnitPriceChange={(rowId, value) =>
                    updateRow(rowId, { unitPrice: sanitizeDecimalInput(value, currencyCode) })
                  }
                  onProductTypeChange={(rowId, value) => updateRow(rowId, { productTypeKey: value })}
                  onDelete={handleDelete}
                  onCellKeyDown={handleCellKeyDown}
                />
              ))}
            </SortableContext>
          </tbody>
        </table>
      </DndContext>
    </div>
  );
}
