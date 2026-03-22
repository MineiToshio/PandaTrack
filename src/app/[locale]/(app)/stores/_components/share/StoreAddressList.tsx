"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Select from "@/components/core/Select";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";

type StoreAddressRow = {
  rowId: number;
  rowIndex: number;
  countryCode?: string;
  city?: string;
  addressLine?: string;
  reference?: string;
  countryError?: string;
  cityError?: string;
  addressLineError?: string;
  referenceError?: string;
};

type StoreAddressCountryOption = {
  value: string;
  label: string;
};

type StoreAddressListProps = {
  idPrefix: string;
  rows: StoreAddressRow[];
  countryOptions: StoreAddressCountryOption[];
  emptyCountryLabel: string;
  countryLabel: string;
  cityLabel: string;
  addressLineLabel: string;
  referenceLabel: string;
  countryInputName: string;
  cityInputName: string;
  addressLineInputName: string;
  referenceInputName: string;
  removeLabel: string;
  onCountryChange?: (rowId: number, nextValue: string) => void;
  onCityChange?: (rowId: number, nextValue: string) => void;
  onAddressLineChange?: (rowId: number, nextValue: string) => void;
  onReferenceChange?: (rowId: number, nextValue: string) => void;
  onRemove: (rowId: number) => void;
  rowLabel?: (rowIndex: number) => string;
  className?: string;
  rowClassName?: string;
  renderCountryError?: (errorKey: string) => ReactNode;
  renderCityError?: (errorKey: string) => ReactNode;
  renderAddressLineError?: (errorKey: string) => ReactNode;
  renderReferenceError?: (errorKey: string) => ReactNode;
};

export default function StoreAddressList({
  idPrefix,
  rows,
  countryOptions,
  emptyCountryLabel,
  countryLabel,
  cityLabel,
  addressLineLabel,
  referenceLabel,
  countryInputName,
  cityInputName,
  addressLineInputName,
  referenceInputName,
  removeLabel,
  onCountryChange,
  onCityChange,
  onAddressLineChange,
  onReferenceChange,
  onRemove,
  rowLabel,
  className,
  rowClassName,
  renderCountryError,
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
        const firstGridClassName = hasRowLabel
          ? "grid grid-cols-1 gap-3 md:grid-cols-2"
          : "grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]";
        const countryFieldId = `${rowKey}-country`;
        const cityFieldId = `${rowKey}-city`;
        const addressLineFieldId = `${rowKey}-line`;
        const referenceFieldId = `${rowKey}-reference`;

        return (
          <div key={row.rowId} className={cn("border-border bg-background space-y-3 rounded-lg border p-3", rowClassName)}>
            {hasRowLabel ? (
              <div className={headerClassName}>
                <Typography size="xs" className="text-text-muted font-medium">
                  {rowLabel(row.rowIndex)}
                </Typography>
                <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(row.rowId)} aria-label={removeLabel}>
                  <X size={16} aria-hidden />
                </Button>
              </div>
            ) : null}

            <div className={firstGridClassName}>
              <div className="min-w-0">
                <Label htmlFor={countryFieldId} className="text-xs">
                  {countryLabel}
                </Label>
                <Select
                  id={countryFieldId}
                  name={countryInputName}
                  value={onCountryChange ? row.countryCode ?? "" : undefined}
                  defaultValue={onCountryChange ? undefined : row.countryCode ?? ""}
                  onChange={onCountryChange ? (event) => onCountryChange(row.rowId, event.target.value) : undefined}
                  error={Boolean(row.countryError)}
                  aria-invalid={Boolean(row.countryError)}
                  className="px-2 py-1.5"
                >
                  <option value="">{emptyCountryLabel}</option>
                  {countryOptions.map((country) => (
                    <option key={country.value} value={country.value}>
                      {country.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="min-w-0">
                <Label htmlFor={cityFieldId} className="text-xs">
                  {cityLabel}
                </Label>
                <Input
                  id={cityFieldId}
                  name={cityInputName}
                  type="text"
                  value={onCityChange ? row.city ?? "" : undefined}
                  defaultValue={onCityChange ? undefined : row.city ?? ""}
                  onChange={onCityChange ? (event) => onCityChange(row.rowId, event.target.value) : undefined}
                  error={Boolean(row.cityError)}
                  aria-invalid={Boolean(row.cityError)}
                />
              </div>

              {!hasRowLabel ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(row.rowId)} aria-label={removeLabel}>
                  <X size={16} aria-hidden />
                </Button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="min-w-0">
                <Label htmlFor={addressLineFieldId} className="text-xs">
                  {addressLineLabel}
                </Label>
                <Input
                  id={addressLineFieldId}
                  name={addressLineInputName}
                  type="text"
                  required={!hasRowLabel && row.rowIndex === 0}
                  value={onAddressLineChange ? row.addressLine ?? "" : undefined}
                  defaultValue={onAddressLineChange ? undefined : row.addressLine ?? ""}
                  onChange={onAddressLineChange ? (event) => onAddressLineChange(row.rowId, event.target.value) : undefined}
                  error={Boolean(row.addressLineError)}
                  aria-invalid={Boolean(row.addressLineError)}
                />
              </div>

              <div className="min-w-0">
                <Label htmlFor={referenceFieldId} className="text-xs">
                  {referenceLabel}
                </Label>
                <Input
                  id={referenceFieldId}
                  name={referenceInputName}
                  type="text"
                  value={onReferenceChange ? row.reference ?? "" : undefined}
                  defaultValue={onReferenceChange ? undefined : row.reference ?? ""}
                  onChange={onReferenceChange ? (event) => onReferenceChange(row.rowId, event.target.value) : undefined}
                  error={Boolean(row.referenceError)}
                  aria-invalid={Boolean(row.referenceError)}
                />
              </div>
            </div>

            {row.countryError && (
              <Typography size="xs" className="text-destructive mt-2" role="alert">
                {renderCountryError?.(row.countryError) ?? row.countryError}
              </Typography>
            )}

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
          </div>
        );
      })}
    </div>
  );
}
