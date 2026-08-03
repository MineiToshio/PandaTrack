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
import { ChevronDown, GripVertical, Search, X } from "lucide-react";
import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Portal from "@/components/core/Portal";
import { cn } from "@/lib/styles";
import { sanitizeDecimalInput } from "@/lib/decimalInput";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { inheritProductTypeFromPrevious } from "@/lib/orders/orderItemUtils";
import { foldSearchText } from "@/lib/strings/foldSearchText";

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

type ItemTypePickerProps = {
  rowId: string;
  value: string;
  productTypeKeys: string[];
  tProductTypes: (key: string) => string;
  placeholder: string;
  ariaLabelFor: (label: string) => string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
};

/**
 * Compact, filterable single-select for the spreadsheet's "Tipo" column.
 *
 * Why not the canonical `<SearchableSelect>` / `<Combobox>` primitive:
 *  - Trigger height: those primitives render a ~46px input trigger, far too tall
 *    for an inline table cell (this grid uses a 12px font, ~26px borderless cell).
 *  - Overflow escape: the cell lives inside the table's `overflow-x-auto`, so the
 *    options list must render through a `Portal` with fixed positioning to avoid
 *    being clipped. `<SearchableSelect>` positions its listbox with `absolute`
 *    inside a `relative` wrapper, which would be clipped here.
 *  - Keyboard ownership: the trigger delegates key events to the grid's shared
 *    Ctrl+Shift cell-navigation and @dnd-kit reorder handler; embedding a primitive
 *    that owns its own key handling would break that integration.
 *
 * The ARIA contract still follows the canonical combobox/listbox pattern (as in
 * `<SearchableSelect>`), NOT a dialog: the trigger owns `aria-haspopup="listbox"`,
 * `aria-expanded`, and `aria-controls` pointing at the `role="listbox"` options
 * list. The popover container is a presentational positioning wrapper only.
 *
 * Portal + fixed positioning so the listbox escapes the table's `overflow-x`.
 * Outer-document scroll repositions; inner listbox scroll is preserved.
 */
function ItemTypePicker({
  rowId,
  value,
  productTypeKeys,
  tProductTypes,
  placeholder,
  ariaLabelFor,
  open,
  onOpenChange,
  onChange,
  onKeyDown,
}: ItemTypePickerProps) {
  const tPicker = useTranslations("orders.picker");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const [query, setQuery] = useState("");

  // Reset query each time the picker opens; focus the search input.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  // Position via Portal + fixed coords. Recompute on outer-document scroll
  // (so the popover follows the trigger when the page scrolls) but ignore
  // scroll events originating inside the listbox itself (so the user can
  // wheel-scroll or grab the scrollbar to navigate long option lists).
  useLayoutEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCoords(null);
      return;
    }
    const compute = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({ top: rect.bottom + 4, left: rect.left, minWidth: rect.width });
    };
    compute();
    const onScroll = (e: Event) => {
      // Ignore scroll inside our own popover — the user is navigating options.
      if (popoverRef.current?.contains(e.target as Node)) return;
      // Outer-document scroll: keep the popover anchored to the trigger.
      compute();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", compute);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      onOpenChange(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onOpenChange]);

  const filteredKeys = useMemo(() => {
    const folded = foldSearchText(query);
    if (!folded) return productTypeKeys;
    return productTypeKeys.filter((k) => foldSearchText(tProductTypes(k)).includes(folded));
  }, [productTypeKeys, query, tProductTypes]);

  const listboxId = `item-type-listbox-${rowId}`;
  const selectedLabel = value ? tProductTypes(value) : null;
  const iconNode = value
    ? createElement(getStoreProductTypeIcon(value), { size: 12, "aria-hidden": true, className: "shrink-0" })
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        id={cellInputId("type", rowId)}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabelFor(selectedLabel ?? placeholder)}
        onClick={() => onOpenChange(!open)}
        onKeyDown={onKeyDown}
        className={cn(
          "flex w-full items-center gap-1 rounded-[5px] px-1 py-1.5 text-left text-[12px] whitespace-nowrap",
          "focus:outline-none focus:[background:color-mix(in_oklch,var(--accent)_8%,transparent)]",
          selectedLabel ? "[color:var(--text-secondary)]" : "[color:var(--text-muted)]",
        )}
      >
        {iconNode}
        <span className="min-w-0 flex-1 truncate">{selectedLabel ?? placeholder}</span>
        <ChevronDown size={10} className="shrink-0 opacity-50" aria-hidden />
      </button>
      {open && coords && (
        <Portal>
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              minWidth: Math.max(coords.minWidth, 220),
            }}
            className={cn(
              "z-50 flex max-h-80 flex-col overflow-hidden rounded-[10px]",
              "[background:var(--background)] [border:1px_solid_var(--border-strong)]",
              "[box-shadow:var(--shadow-elevation-3)]",
            )}
          >
            <div className="relative flex items-center px-2 py-2 [border-bottom:1px_solid_var(--border)]">
              <Search size={13} aria-hidden className="pointer-events-none absolute left-4 [color:var(--text-muted)]" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    onOpenChange(false);
                  }
                }}
                placeholder={tPicker("productTypeSearch")}
                aria-label={tPicker("productTypeSearch")}
                className={cn(
                  "w-full rounded-[6px] py-1.5 pr-2 pl-7 text-[13px]",
                  "[color:var(--text-primary)] [background:var(--surface)] [border:1px_solid_var(--border)]",
                  "placeholder:[color:var(--text-muted)]",
                  "focus:[border-color:color-mix(in_oklch,var(--accent)_45%,var(--border))] focus:outline-none",
                  "focus:[box-shadow:0_0_0_3px_color-mix(in_oklch,var(--accent)_15%,transparent)]",
                )}
              />
            </div>
            <ul
              id={listboxId}
              role="listbox"
              aria-label={tPicker("productTypeTitle")}
              className="flex-1 overflow-y-auto p-1"
            >
              {filteredKeys.length === 0 ? (
                <li className="px-2 py-2 text-[12px] [color:var(--text-muted)]">{tPicker("productTypeEmpty")}</li>
              ) : (
                filteredKeys.map((key) => {
                  const Icon = getStoreProductTypeIcon(key);
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={value === key}
                        onClick={() => {
                          onChange(key);
                          onOpenChange(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] [color:var(--text-primary)]",
                          value === key
                            ? "[background:color-mix(in_oklch,var(--accent)_10%,transparent)]"
                            : "hover:[background:color-mix(in_oklch,var(--text-primary)_4%,transparent)]",
                        )}
                      >
                        <Icon size={13} aria-hidden className="shrink-0 [color:var(--accent-cool)]" />
                        <span className="min-w-0 flex-1 truncate">{tProductTypes(key)}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </Portal>
      )}
    </>
  );
}

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
          rowId={row.rowId}
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
