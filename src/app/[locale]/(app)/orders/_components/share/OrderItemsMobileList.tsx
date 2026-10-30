"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import { cn } from "@/lib/styles";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { formatAmount } from "@/lib/currency";
import { type ItemRow, createEmptyRow } from "./OrderItemsGrid";
import OrderAddProductSheet, { type ProductFormValue } from "./OrderAddProductSheet";

type Props = {
  rows: ItemRow[];
  onChange: (next: ItemRow[]) => void;
  currencyCode: string;
  productTypeKeys: string[];
  tProductTypes: (key: string) => string;
  nextRowId: () => string;
  /** Forwarded to the edit sheet; see `OrderAddProductSheet`. */
  showQuantity?: boolean;
  /** Compact intake composition; manual forms keep their card rows and add button. */
  compact?: boolean;
  showAddButton?: boolean;
  /** Intake removes empty groups instead of retaining a hidden placeholder after deletion. */
  keepEmptyRow?: boolean;
  onCategoryPicked?: (rowId: string) => void;
  renderRowAction?: (row: ItemRow) => ReactNode;
  /** Opt-in review rows own the full outline, including their trailing actions. */
  containRowActions?: boolean;
  formatPrice?: (minorUnits: number) => string;
};

function parseCentsFromDecimal(value: string): number | null {
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

export default function OrderItemsMobileList({
  rows,
  onChange,
  currencyCode,
  productTypeKeys,
  tProductTypes,
  nextRowId,
  showQuantity = true,
  compact = false,
  showAddButton = true,
  keepEmptyRow = true,
  onCategoryPicked,
  renderRowAction,
  containRowActions = false,
  formatPrice,
}: Props) {
  const t = useTranslations("orders.create");
  const tAdd = useTranslations("orders.create.addProduct");

  const [sheet, setSheet] = useState<{ open: boolean; rowId: string | null }>({ open: false, rowId: null });

  const visibleRows = rows.filter((r) => compact || r.name.trim().length > 0);

  const handleAdd = (val: ProductFormValue) => {
    const newRow: ItemRow = {
      rowId: nextRowId(),
      name: val.name,
      quantity: val.quantity,
      unitPrice: val.unitPrice,
      productTypeKey: val.productTypeKey,
    };
    // Replace the first empty row if present; otherwise append.
    const emptyIdx = rows.findIndex((r) => r.name.trim().length === 0);
    if (emptyIdx >= 0) {
      const next = [...rows];
      next[emptyIdx] = { ...newRow, rowId: rows[emptyIdx]!.rowId };
      onChange(next);
    } else {
      onChange([...rows, newRow]);
    }
  };

  const handleEdit = (rowId: string, val: ProductFormValue) => {
    onChange(
      rows.map((r) =>
        r.rowId === rowId
          ? {
              ...r,
              name: val.name,
              quantity: val.quantity,
              unitPrice: val.unitPrice,
              productTypeKey: val.productTypeKey,
            }
          : r,
      ),
    );
  };

  const handleDelete = (rowId: string) => {
    const next = rows.filter((r) => r.rowId !== rowId);
    if (next.length === 0 && keepEmptyRow) {
      onChange([createEmptyRow(nextRowId())]);
    } else {
      onChange(next);
    }
  };

  const editingRow = sheet.rowId ? rows.find((r) => r.rowId === sheet.rowId) : null;
  const initialForSheet: ProductFormValue | undefined = editingRow
    ? {
        name: editingRow.name,
        quantity: editingRow.quantity,
        unitPrice: editingRow.unitPrice,
        productTypeKey: editingRow.productTypeKey,
      }
    : undefined;

  return (
    <div className="space-y-2.5">
      {visibleRows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {visibleRows.map((row) => {
            const Icon = row.productTypeKey ? getStoreProductTypeIcon(row.productTypeKey) : null;
            const qty = parseInt(row.quantity, 10) || 1;
            const priceCents = parseCentsFromDecimal(row.unitPrice);
            const priceLabel =
              priceCents != null ? (formatPrice?.(priceCents) ?? formatAmount(priceCents, currencyCode)) : null;
            const rowBody = (
              <>
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px]",
                    "[color:var(--text-muted)] [background:color-mix(in_oklch,var(--text-primary)_5%,transparent)]",
                    "[&_svg]:h-[14px] [&_svg]:w-[14px]",
                  )}
                >
                  {Icon ? <Icon /> : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] [font-weight:var(--font-weight-medium-body)] [color:var(--text-primary)]">
                    {row.name || tAdd("namePlaceholder")}
                  </span>
                  <span className="text-[11px] [color:var(--text-muted)]">
                    {/* "×1" on every row is noise where quantity is fixed at one by construction. */}
                    {showQuantity ? `×${qty}${priceLabel ? ` · ${priceLabel}` : ""}` : (priceLabel ?? "")}
                  </span>
                </span>
              </>
            );

            return (
              <li
                key={row.rowId}
                className={cn(
                  "flex items-stretch gap-1.5",
                  containRowActions && "border-border items-center rounded-[var(--radius-lg)] border pr-1",
                )}
              >
                <button
                  type="button"
                  onClick={() => setSheet({ open: true, rowId: row.rowId })}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-left",
                    containRowActions
                      ? "min-h-11"
                      : compact
                        ? "[border-bottom:1px_solid_var(--border)]"
                        : "[background:var(--surface)] [border:1px_solid_var(--border)]",
                    "hover:[background:color-mix(in_oklch,var(--text-primary)_3%,transparent)]",
                  )}
                >
                  {rowBody}
                  <Pencil size={14} className="shrink-0 [color:var(--text-muted)]" aria-label={tAdd("editAria")} />
                </button>
                {renderRowAction?.(row)}
              </li>
            );
          })}
        </ul>
      )}

      {showAddButton && (
        <Button
          type="button"
          variant="tonal"
          size="sm"
          fullWidth
          leadingIcon={<Plus size={14} aria-hidden />}
          onClick={() => setSheet({ open: true, rowId: null })}
        >
          {t("addProductButton")}
        </Button>
      )}

      <OrderAddProductSheet
        showQuantity={showQuantity}
        open={sheet.open}
        onOpenChange={(o) => setSheet({ open: o, rowId: o ? sheet.rowId : null })}
        mode={editingRow ? "edit" : "create"}
        initial={initialForSheet}
        productTypeKeys={productTypeKeys}
        tProductTypes={tProductTypes}
        currencyCode={currencyCode}
        onCategoryConfirmed={editingRow ? () => onCategoryPicked?.(editingRow.rowId) : undefined}
        onSubmit={(val) => {
          if (editingRow) handleEdit(editingRow.rowId, val);
          else handleAdd(val);
        }}
        onDelete={editingRow ? () => handleDelete(editingRow.rowId) : undefined}
      />
    </div>
  );
}
