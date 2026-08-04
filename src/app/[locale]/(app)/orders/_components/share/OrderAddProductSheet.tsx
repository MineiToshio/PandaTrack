"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { createElement, useEffect, useId, useState } from "react";
import Sheet from "@/components/modules/Sheet/Sheet";
import { MobilePicker } from "@/components/modules/MobilePicker";
import Button from "@/components/core/Button/Button";
import { cn } from "@/lib/styles";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { sanitizeDecimalInput } from "@/lib/decimalInput";

export type ProductFormValue = {
  name: string;
  quantity: string;
  unitPrice: string;
  productTypeKey: string;
};

type OrderAddProductSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: ProductFormValue;
  productTypeKeys: string[];
  tProductTypes: (key: string) => string;
  onSubmit: (value: ProductFormValue) => void;
  onDelete?: () => void;
  currencyCode: string;
  /**
   * Hides the quantity field. The image-intake review screen sets it, matching the grid: an
   * extracted draft carries one product per unit by construction, so a quantity input there would
   * offer a second, conflicting way to say the same thing.
   */
  showQuantity?: boolean;
};

const EMPTY: ProductFormValue = { name: "", quantity: "1", unitPrice: "", productTypeKey: "" };

export default function OrderAddProductSheet({
  open,
  onOpenChange,
  mode,
  initial,
  productTypeKeys,
  tProductTypes,
  onSubmit,
  onDelete,
  currencyCode,
  showQuantity = true,
}: OrderAddProductSheetProps) {
  const t = useTranslations("orders.create.addProduct");
  const tPicker = useTranslations("orders.picker");

  const [value, setValue] = useState<ProductFormValue>(initial ?? EMPTY);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const nameId = useId();
  const qtyId = useId();
  const priceId = useId();
  const typeId = useId();

  // Reset form value when the sheet transitions to open with new initial data.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(initial ?? EMPTY);
    }
  }, [open, initial]);

  const nameInvalid = value.name.trim().length === 0;

  const handleSubmit = () => {
    if (nameInvalid) return;
    onSubmit({
      ...value,
      quantity: value.quantity.trim() || "1",
    });
    onOpenChange(false);
  };

  const typeIconNode = value.productTypeKey
    ? createElement(getStoreProductTypeIcon(value.productTypeKey), { size: 14, "aria-hidden": true })
    : null;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "edit" ? t("titleEdit") : t("title")}
      size="md"
      bodyClassName="px-5 py-4"
      footer={
        // Layout mirrors the create-order wizard's mobile sticky bar (`OrderEditForm`
        // sticky toolbar): compact secondary on the left, flex-1 primary on the right
        // with a leading icon. The user reads the primary as the main affordance
        // (add/save), and the cancel action stays out of the way as a small ghost.
        // On a narrow screen the primary takes its own full-width row above the secondaries:
        // sharing one row with two 96px ghosts left it about 127px wide at 375px, which reads as
        // the least important control on a sheet whose whole purpose it is.
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-stretch">
          <div className="flex items-stretch gap-2 sm:contents">
            {mode === "edit" && onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => {
                  onDelete();
                  onOpenChange(false);
                }}
                className="flex-1 [justify-content:center] [color:var(--destructive)] sm:[min-width:96px] sm:flex-none sm:flex-shrink-0"
              >
                {t("delete")}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => onOpenChange(false)}
              className="flex-1 [justify-content:center] sm:[min-width:96px] sm:flex-none sm:flex-shrink-0"
            >
              {t("cancel")}
            </Button>
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={nameInvalid}
            leadingIcon={mode === "edit" ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
            className="w-full [justify-content:center] sm:w-auto sm:flex-1"
          >
            {mode === "edit" ? t("save") : t("add")}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <div className="space-y-1.5">
          <label htmlFor={nameId} className="block text-[12px] font-medium [color:var(--text-secondary)]">
            {t("nameLabel")}
          </label>
          <input
            id={nameId}
            type="text"
            value={value.name}
            placeholder={t("namePlaceholder")}
            onChange={(e) => setValue({ ...value, name: e.target.value })}
            className={cn(
              "w-full rounded-[10px] px-3 py-2 text-[14px]",
              "[color:var(--text-primary)] [background:var(--surface)] [border:1px_solid_var(--border)]",
              "placeholder:[color:var(--text-muted)] focus:outline-none",
              "focus:[border-color:color-mix(in_oklch,var(--accent)_45%,var(--border))]",
              "focus:[box-shadow:0_0_0_3px_color-mix(in_oklch,var(--accent)_18%,transparent)]",
            )}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={typeId} className="block text-[12px] font-medium [color:var(--text-secondary)]">
            {t("typeLabel")}
          </label>
          <button
            type="button"
            id={typeId}
            onClick={() => setTypePickerOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={typePickerOpen}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-left text-[14px]",
              "min-h-[44px] [background:var(--surface)] [border:1px_solid_var(--border)]",
            )}
          >
            <span
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2",
                value.productTypeKey ? "[color:var(--text-primary)]" : "[color:var(--text-muted)]",
              )}
            >
              {typeIconNode}
              <span className="truncate">
                {value.productTypeKey ? tProductTypes(value.productTypeKey) : t("typePlaceholder")}
              </span>
            </span>
            <ChevronsUpDown size={15} className="shrink-0 [color:var(--text-muted)]" aria-hidden />
          </button>
        </div>

        {/*
          `items-end` so the two inputs share a baseline whatever the labels do: the price label is
          long enough to wrap on a narrow sheet, which used to leave the quantity input floating
          above it. The "(opcional)" suffix is gone from the label because the helper line below
          already says it, and it was most of the extra width.
        */}
        <div className={cn("grid gap-3", showQuantity ? "grid-cols-2 items-end" : "grid-cols-1")}>
          {showQuantity && (
            <div className="space-y-1.5">
              <label htmlFor={qtyId} className="block text-[12px] font-medium [color:var(--text-secondary)]">
                {t("quantityLabel")}
              </label>
              <input
                id={qtyId}
                type="number"
                inputMode="numeric"
                min={1}
                value={value.quantity}
                onChange={(e) => setValue({ ...value, quantity: e.target.value.replace(/[^0-9]/g, "") || "1" })}
                className={cn(
                  "w-full rounded-[10px] px-3 py-2 text-[14px]",
                  "[color:var(--text-primary)] [background:var(--surface)] [border:1px_solid_var(--border)]",
                  "focus:[box-shadow:0_0_0_3px_color-mix(in_oklch,var(--accent)_18%,transparent)] focus:outline-none",
                )}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor={priceId} className="block text-[12px] font-medium [color:var(--text-secondary)]">
              <span>{t("unitPriceLabel")}</span>{" "}
              {currencyCode && <span className="[color:var(--text-muted)]">({currencyCode})</span>}
            </label>
            <input
              id={priceId}
              type="text"
              inputMode="decimal"
              value={value.unitPrice}
              placeholder={t("unitPricePlaceholder")}
              onChange={(e) => setValue({ ...value, unitPrice: sanitizeDecimalInput(e.target.value, currencyCode) })}
              className={cn(
                "w-full rounded-[10px] px-3 py-2 text-[14px]",
                "[color:var(--text-primary)] [background:var(--surface)] [border:1px_solid_var(--border)]",
                "placeholder:[color:var(--text-muted)] focus:outline-none",
                "focus:[box-shadow:0_0_0_3px_color-mix(in_oklch,var(--accent)_18%,transparent)]",
              )}
            />
          </div>
        </div>
        <p className="text-[11.5px] [color:var(--text-muted)]">{t("unitPriceHelper")}</p>
      </div>

      <MobilePicker
        open={typePickerOpen}
        onOpenChange={setTypePickerOpen}
        title={tPicker("productTypeTitle")}
        searchPlaceholder={tPicker("productTypeSearch")}
        emptyLabel={tPicker("productTypeEmpty")}
        options={productTypeKeys.map((key) => {
          const Icon = getStoreProductTypeIcon(key);
          return {
            value: key,
            label: tProductTypes(key),
            icon: <Icon />,
            searchText: tProductTypes(key),
          };
        })}
        selectedValue={value.productTypeKey || null}
        onSelect={(v) => setValue({ ...value, productTypeKey: v })}
      />
    </Sheet>
  );
}
