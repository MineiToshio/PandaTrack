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

export type ItemRow = {
  rowId: string;
  id?: string;
  name: string;
  quantity: string;
  unitPrice: string;
  productTypeKey: string;
};

type OrderItemRowProps = {
  row: ItemRow;
  index: number;
  isLastRow: boolean;
  productTypeKeys: string[];
  tProductTypes: (key: string) => string;
  nameError?: string;
  quantityError?: string;
  onNameChange: (rowId: string, value: string) => void;
  onQuantityChange: (rowId: string, value: string) => void;
  onUnitPriceChange: (rowId: string, value: string) => void;
  onProductTypeChange: (rowId: string, value: string) => void;
  onDelete: (rowId: string) => void;
  onLastCellTab: () => void;
};

function OrderItemRow({
  row,
  index,
  isLastRow,
  productTypeKeys,
  tProductTypes,
  nameError,
  quantityError,
  onNameChange,
  onQuantityChange,
  onUnitPriceChange,
  onProductTypeChange,
  onDelete,
  onLastCellTab,
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

  const handleLastCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab" && !e.shiftKey && isLastRow) {
      e.preventDefault();
      onLastCellTab();
    }
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
          <label className="text-text-muted mb-0.5 block text-xs md:sr-only" htmlFor={`item-name-${row.rowId}`}>
            {t("itemNameLabel")}
          </label>
          <Input
            id={`item-name-${row.rowId}`}
            type="text"
            value={row.name}
            placeholder={t("itemNamePlaceholder")}
            error={!!nameError}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? `item-name-error-${row.rowId}` : undefined}
            onChange={(e) => onNameChange(row.rowId, e.target.value)}
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
            <label className="text-text-muted mb-0.5 block text-xs md:sr-only" htmlFor={`item-qty-${row.rowId}`}>
              {t("itemQuantityLabel")}
            </label>
            <Input
              id={`item-qty-${row.rowId}`}
              type="number"
              min="1"
              step="1"
              value={row.quantity}
              error={!!quantityError}
              aria-invalid={!!quantityError}
              onChange={(e) => onQuantityChange(row.rowId, e.target.value)}
            />
          </div>

          <div className="md:w-28">
            <label className="text-text-muted mb-0.5 block text-xs md:sr-only" htmlFor={`item-price-${row.rowId}`}>
              {t("itemUnitPriceLabel")}
            </label>
            <Input
              id={`item-price-${row.rowId}`}
              type="number"
              min="0"
              step="0.01"
              value={row.unitPrice}
              placeholder={t("itemUnitPricePlaceholder")}
              onChange={(e) => onUnitPriceChange(row.rowId, e.target.value)}
            />
          </div>

          <div className="min-w-0 flex-1 md:w-36 md:flex-none">
            <label className="text-text-muted mb-0.5 block text-xs md:sr-only" htmlFor={`item-type-${row.rowId}`}>
              {t("itemProductTypeLabel")}
            </label>
            <Select
              id={`item-type-${row.rowId}`}
              value={row.productTypeKey}
              onChange={(e) => onProductTypeChange(row.rowId, e.target.value)}
              onKeyDown={handleLastCellKeyDown}
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
  itemErrors?: Record<string, { name?: string; quantity?: string }>;
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

  const handleDelete = useCallback(
    (rowId: string) => {
      const next = rows.filter((r) => r.rowId !== rowId);
      onChange(next);
    },
    [rows, onChange],
  );

  const focusRowName = useCallback((rowId: string) => {
    window.requestAnimationFrame(() => {
      const newInput = document.getElementById(`item-name-${rowId}`);
      newInput?.focus();
    });
  }, []);

  const handleAddRow = useCallback(() => {
    const newRow = createNewRow();
    onChange([...rows, newRow]);
    focusRowName(newRow.rowId);
  }, [rows, onChange, createNewRow, focusRowName]);

  const handleInsertRowAt = useCallback(
    (index: number) => {
      const newRow = createNewRow();
      const next = [...rows.slice(0, index), newRow, ...rows.slice(index)];
      onChange(next);
      focusRowName(newRow.rowId);
    },
    [rows, onChange, createNewRow, focusRowName],
  );

  const handleLastCellTab = useCallback(() => {
    onChange([...rows, createNewRow()]);
  }, [rows, onChange, createNewRow]);

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
                  isLastRow={index === rows.length - 1}
                  productTypeKeys={productTypeKeys}
                  tProductTypes={tProductTypes}
                  nameError={itemErrors[row.rowId]?.name}
                  quantityError={itemErrors[row.rowId]?.quantity}
                  onNameChange={(rowId, value) => updateRow(rowId, { name: value })}
                  onQuantityChange={(rowId, value) => updateRow(rowId, { quantity: value })}
                  onUnitPriceChange={(rowId, value) => updateRow(rowId, { unitPrice: value })}
                  onProductTypeChange={(rowId, value) => updateRow(rowId, { productTypeKey: value })}
                  onDelete={handleDelete}
                  onLastCellTab={handleLastCellTab}
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
