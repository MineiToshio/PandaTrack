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
import {
  createContext,
  useContext,
  useCallback,
  useId,
  useMemo,
  useState,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/styles";
import { sanitizeDecimalInput } from "@/lib/decimalInput";
import { inheritProductTypeFromPrevious } from "@/lib/orders/orderItemUtils";
import ItemTypePicker from "./ItemTypePicker";
import IconButton from "@/components/core/IconButton";

type OrderItemsTableConfig = { showQuantity?: boolean; sortable?: boolean; hasRowAction?: boolean };

function orderItemsColumns({ showQuantity = true, sortable = true, hasRowAction = false }: OrderItemsTableConfig) {
  return [
    ...(sortable ? ["sort"] : []),
    "name",
    ...(showQuantity ? ["quantity"] : []),
    "price",
    "type",
    ...(hasRowAction ? ["action"] : []),
    "delete",
  ];
}

const OrderItemsColumnCountContext = createContext(orderItemsColumns({}).length);

export function useOrderItemsTableColumnCount(): number {
  return useContext(OrderItemsColumnCountContext);
}

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
  showQuantity: boolean;
  sortable: boolean;
  rowAction?: ReactNode;
  compactControls: boolean;
  typePickerInlineChevron: boolean;
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
  showQuantity,
  sortable,
  rowAction,
  compactControls,
  typePickerInlineChevron,
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
    disabled: !sortable,
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
      className={cn(
        isDragging && "[box-shadow:0_6px_20px_color-mix(in_oklch,black_22%,transparent)]",
        compactControls && "[&>td]:align-middle",
      )}
    >
      {sortable && (
        <td className="px-[3px] py-[2px] text-center align-middle">
          {/*
          Row-control geometry (`docs/design/interface-patterns.md` §12, "A dense grid is fixed by
          its row pitch"). This grid never renders below 768px — its callers swap in
          `OrderItemsMobileList` there — so its touch band is the 768-1023px tablet range and the
          spreadsheet density returns at `lg`. In that band the handle and the delete are real
          44×44 boxes, which relaxes the row pitch to ~48px as a consequence. They are NOT
          `::before` expansions: the nearest neighbour is the same control one row down, two
          expansions would overlap, and by paint order the lower row would take the contested
          band — an edge tap would reorder or delete the wrong product. Boxes in flow cannot
          overlap, so resizing is the only fix that cannot mis-target.
        */}
          <button
            type="button"
            aria-label={t("itemDragLabel")}
            className="grid size-11 cursor-grab place-items-center [color:var(--text-muted)] opacity-35 transition-opacity hover:opacity-70 active:cursor-grabbing lg:inline-flex lg:size-[14px]"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} aria-hidden />
          </button>
        </td>
      )}

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
      {showQuantity && (
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
      )}

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
          inlineChevron={typePickerInlineChevron}
        />
      </td>

      {rowAction && (
        <td className={cn("px-[3px] py-[2px]", compactControls ? "align-middle" : "align-top")}>{rowAction}</td>
      )}

      {/* Delete */}
      <td className={cn("px-[3px] py-[2px]", compactControls ? "align-middle" : "align-top")}>
        <div className="flex items-center justify-center gap-0.5">
          {compactControls ? (
            <IconButton
              size="sm"
              icon={<X size={14} aria-hidden />}
              aria-label={`${t("itemDeleteLabel")} ${index + 1}`}
              onClick={() => onDelete(row.rowId)}
              className="size-11 [color:var(--text-muted)] before:inset-0 hover:[color:var(--text-primary)] focus-visible:[color:var(--text-primary)] lg:size-8"
            />
          ) : (
            <button
              type="button"
              aria-label={`${t("itemDeleteLabel")} ${index + 1}`}
              onClick={() => onDelete(row.rowId)}
              className="grid size-11 place-items-center rounded [color:var(--text-muted)] transition-colors hover:[color:var(--destructive)] focus-visible:[box-shadow:0_0_0_2px_var(--focus-ring)] focus-visible:outline-none lg:inline-flex lg:size-[21px]"
            >
              <X size={13} aria-hidden />
            </button>
          )}
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
  /**
   * Hides the quantity column. The image-intake review screen sets it: an extracted draft carries
   * one product per unit by construction (the breakdown engine expands a lot into single-unit rows
   * so a partial arrival can be tracked), so a quantity cell there would offer a second, conflicting
   * way to say the same thing.
   */
  showQuantity?: boolean;
  /** Disable drag handles and keyboard reordering for a canonical product order. */
  sortable?: boolean;
  /** Manual forms append on Tab; composed lists can keep ordinary focus traversal. */
  appendOnTab?: boolean;
  onCategoryPicked?: (rowId: string) => void;
  /** Render a tbody inside a parent OrderItemsTable. Sorting must be disabled. */
  tableBodyId?: string;
  renderRowAction?: (row: ItemRow) => ReactNode;
  /** Equal, muted icon controls for compact review lists. Manual editors retain their defaults. */
  compactControls?: boolean;
  typePickerInlineChevron?: boolean;
  /** Compose provenance and its member rows in one semantic table section. */
  beforeRows?: ReactNode;
  afterRows?: ReactNode;
  tableBodyProps?: HTMLAttributes<HTMLTableSectionElement>;
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
  showQuantity = true,
  sortable = true,
  appendOnTab = true,
  onCategoryPicked,
  tableBodyId,
  renderRowAction,
  compactControls = false,
  typePickerInlineChevron = false,
  beforeRows,
  afterRows,
  tableBodyProps,
}: OrderItemsGridProps) {
  const dndId = useId();
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
  // Without the quantity column its key is not a focus target, so Ctrl+Shift+←/→ has to walk the
  // columns that exist rather than the canonical four.
  const navigableColumns = useMemo(
    () => (showQuantity ? COLUMN_ORDER : COLUMN_ORDER.filter((column) => column !== "qty")),
    [showQuantity],
  );

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
        appendOnTab &&
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
      if (sortable && altShift && (key === "ArrowUp" || key === "ArrowDown")) {
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
        const currentColumnIdx = navigableColumns.indexOf(ctx.column);
        const direction = key === "ArrowLeft" ? -1 : 1;
        const targetColumnIdx = currentColumnIdx + direction;
        if (targetColumnIdx < 0 || targetColumnIdx >= navigableColumns.length) return;
        focusCell(navigableColumns[targetColumnIdx], ctx.rowId);
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
    [rows, onChange, buildInheritedRow, navigableColumns, sortable, appendOnTab],
  );

  function handleProductTypeChange(rowId: string, value: string) {
    onCategoryPicked?.(rowId);
    updateRow(rowId, { productTypeKey: value });
  }

  const renderedRows = (
    <tbody {...tableBodyProps} id={tableBodyId}>
      {beforeRows}
      {rows.map((row, index) => (
        <OrderItemRow
          key={row.rowId}
          row={row}
          index={index}
          productTypeKeys={productTypeKeys}
          tProductTypes={tProductTypes}
          showQuantity={showQuantity}
          sortable={sortable}
          rowAction={renderRowAction?.(row)}
          compactControls={compactControls}
          typePickerInlineChevron={typePickerInlineChevron}
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
          onProductTypeChange={handleProductTypeChange}
          onDelete={handleDelete}
          onCellKeyDown={handleCellKeyDown}
        />
      ))}
      {afterRows}
    </tbody>
  );

  if (tableBodyId) return renderedRows;

  return (
    <div className="-mx-1 overflow-x-auto">
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((row) => row.rowId)} strategy={verticalListSortingStrategy}>
          <OrderItemsTable
            currencyCode={currencyCode}
            showQuantity={showQuantity}
            sortable={sortable}
            hasRowAction={!!renderRowAction}
          >
            {renderedRows}
          </OrderItemsTable>
        </SortableContext>
      </DndContext>
    </div>
  );
}

/** Shared table geometry for the manual editor and composed intake group bodies. */
export function OrderItemsTable({
  children,
  currencyCode,
  showQuantity = true,
  sortable = true,
  hasRowAction = false,
}: {
  children: ReactNode;
  currencyCode?: string;
  showQuantity?: boolean;
  sortable?: boolean;
  hasRowAction?: boolean;
}) {
  const t = useTranslations("orders.form");
  const headerCellClass =
    "[border-bottom:1px_solid_var(--border)] px-1.5 pt-[3px] pb-[7px] text-[11px] [font-weight:var(--font-weight-title)] [color:var(--text-muted)] whitespace-nowrap";
  const priceHeader = currencyCode ? `${t("itemUnitPriceLabel")} (${currencyCode})` : t("itemUnitPriceLabel");
  const columnCount = orderItemsColumns({ showQuantity, sortable, hasRowAction }).length;
  return (
    <OrderItemsColumnCountContext.Provider value={columnCount}>
      <table role="grid" aria-label={t("itemsSectionTitle")} className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            {sortable && <th scope="col" className="w-[50px] [border-bottom:1px_solid_var(--border)] lg:w-6" />}
            <th scope="col" className={cn(headerCellClass, "text-left")}>
              {t("itemNameLabel")}
            </th>
            {showQuantity && (
              <th scope="col" className={cn(headerCellClass, "w-16 text-right")}>
                {t("itemQuantityLabel")}
              </th>
            )}
            <th scope="col" className={cn(headerCellClass, "w-[130px] text-right")}>
              {priceHeader}
            </th>
            <th scope="col" className={cn(headerCellClass, "w-[110px] text-left")}>
              {t("itemProductTypeLabel")}
            </th>
            {hasRowAction && <th scope="col" className="w-11 [border-bottom:1px_solid_var(--border)] lg:w-8" />}
            <th scope="col" className="w-14 [border-bottom:1px_solid_var(--border)]" />
          </tr>
        </thead>
        {children}
      </table>
    </OrderItemsColumnCountContext.Provider>
  );
}
