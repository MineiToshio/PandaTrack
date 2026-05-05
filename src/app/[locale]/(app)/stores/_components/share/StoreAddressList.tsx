"use client";

import type { ReactNode } from "react";
import { Trash2, X } from "lucide-react";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";

type StoreAddressRow = {
  rowId: number;
  rowIndex: number;
  city?: string;
  addressLine?: string;
  reference?: string;
  cityError?: string;
  addressLineError?: string;
  referenceError?: string;
};

type StoreAddressListProps = {
  idPrefix: string;
  rows: StoreAddressRow[];
  cityLabel: string;
  addressLineLabel: string;
  referenceLabel: string;
  cityInputName: string;
  addressLineInputName: string;
  referenceInputName: string;
  removeLabel: string;
  onCityChange?: (rowId: number, nextValue: string) => void;
  onAddressLineChange?: (rowId: number, nextValue: string) => void;
  onReferenceChange?: (rowId: number, nextValue: string) => void;
  onRemove: (rowId: number) => void;
  rowLabel?: (rowIndex: number) => string;
  className?: string;
  rowClassName?: string;
  renderCityError?: (errorKey: string) => ReactNode;
  renderAddressLineError?: (errorKey: string) => ReactNode;
  renderReferenceError?: (errorKey: string) => ReactNode;
};

export default function StoreAddressList({
  idPrefix,
  rows,
  cityLabel,
  addressLineLabel,
  referenceLabel,
  cityInputName,
  addressLineInputName,
  referenceInputName,
  removeLabel,
  onCityChange,
  onAddressLineChange,
  onReferenceChange,
  onRemove,
  rowLabel,
  className,
  rowClassName,
  renderCityError,
  renderAddressLineError,
  renderReferenceError,
}: StoreAddressListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {rows.map((row) => {
        const hasRowLabel = rowLabel != null;
        const rowKey = `${idPrefix}-${row.rowId}`;
        const headerClassName = hasRowLabel ? "flex items-center justify-between gap-2" : undefined;
        const cityFieldId = `${rowKey}-city`;
        const addressLineFieldId = `${rowKey}-line`;
        const referenceFieldId = `${rowKey}-reference`;

        return (
          <div
            key={row.rowId}
            className={cn(
              "space-y-3 rounded-[var(--radius-lg)] p-3.5 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]",
              rowClassName,
            )}
          >
            {hasRowLabel ? (
              <div className={headerClassName}>
                <Typography size="xs" className="text-text-muted font-medium">
                  {rowLabel(row.rowIndex)}
                </Typography>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(row.rowId)}
                  aria-label={removeLabel}
                >
                  <X size={16} aria-hidden />
                </Button>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="min-w-0">
                <Label htmlFor={cityFieldId} className="text-xs">
                  {cityLabel}
                </Label>
                <Input
                  id={cityFieldId}
                  name={cityInputName}
                  type="text"
                  value={onCityChange ? (row.city ?? "") : undefined}
                  defaultValue={onCityChange ? undefined : (row.city ?? "")}
                  onChange={onCityChange ? (event) => onCityChange(row.rowId, event.target.value) : undefined}
                  error={Boolean(row.cityError)}
                  aria-invalid={Boolean(row.cityError)}
                />
              </div>

              <div className="min-w-0">
                <Label htmlFor={addressLineFieldId} className="text-xs">
                  {addressLineLabel}
                </Label>
                <Input
                  id={addressLineFieldId}
                  name={addressLineInputName}
                  type="text"
                  required={!hasRowLabel && row.rowIndex === 0}
                  value={onAddressLineChange ? (row.addressLine ?? "") : undefined}
                  defaultValue={onAddressLineChange ? undefined : (row.addressLine ?? "")}
                  onChange={
                    onAddressLineChange ? (event) => onAddressLineChange(row.rowId, event.target.value) : undefined
                  }
                  error={Boolean(row.addressLineError)}
                  aria-invalid={Boolean(row.addressLineError)}
                />
              </div>
            </div>

            <div className="min-w-0">
              <Label htmlFor={referenceFieldId} className="text-xs">
                {referenceLabel}
              </Label>
              <Input
                id={referenceFieldId}
                name={referenceInputName}
                type="text"
                value={onReferenceChange ? (row.reference ?? "") : undefined}
                defaultValue={onReferenceChange ? undefined : (row.reference ?? "")}
                onChange={onReferenceChange ? (event) => onReferenceChange(row.rowId, event.target.value) : undefined}
                error={Boolean(row.referenceError)}
                aria-invalid={Boolean(row.referenceError)}
              />
            </div>

            {row.cityError && (
              <Typography size="xs" className="text-destructive mt-2" role="alert">
                {renderCityError?.(row.cityError) ?? row.cityError}
              </Typography>
            )}

            {row.addressLineError && (
              <Typography size="xs" className="text-destructive mt-2" role="alert">
                {renderAddressLineError?.(row.addressLineError) ?? row.addressLineError}
              </Typography>
            )}

            {row.referenceError && (
              <Typography size="xs" className="text-destructive mt-2" role="alert">
                {renderReferenceError?.(row.referenceError) ?? row.referenceError}
              </Typography>
            )}

            {!hasRowLabel ? (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => onRemove(row.rowId)}
                  className="inline-flex items-center gap-1.5 text-xs [color:var(--destructive)] hover:underline focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:2px]"
                >
                  <Trash2 size={12} aria-hidden />
                  {removeLabel}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
