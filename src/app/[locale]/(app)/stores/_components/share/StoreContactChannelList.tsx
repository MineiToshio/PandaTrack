"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Select from "@/components/core/Select";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";

export const STORE_CONTACT_CHANNEL_TYPES = [
  "INSTAGRAM",
  "WHATSAPP",
  "EMAIL",
  "PHONE",
  "WEBSITE",
  "FACEBOOK",
  "TIKTOK",
  "OTHER",
] as const;

export type StoreContactChannelType = (typeof STORE_CONTACT_CHANNEL_TYPES)[number];

type StoreContactChannelRow = {
  rowId: number;
  rowIndex: number;
  type: StoreContactChannelType;
  value?: string;
  label?: string;
  typeError?: string;
  valueError?: string;
  labelError?: string;
};

type StoreContactChannelListProps = {
  idPrefix: string;
  rows: StoreContactChannelRow[];
  typeInputName: string;
  valueInputName: string;
  labelInputName?: string;
  typeLabel: string;
  valueLabel: string;
  labelLabel?: string;
  removeLabel: string;
  optionLabel: (type: StoreContactChannelType) => string;
  valuePlaceholder?: (type: StoreContactChannelType) => string;
  onTypeChange: (rowId: number, nextType: StoreContactChannelType) => void;
  onValueChange?: (rowId: number, nextValue: string) => void;
  onLabelChange?: (rowId: number, nextValue: string) => void;
  onRemove: (rowId: number) => void;
  className?: string;
  rowClassName?: string;
  removeButtonClassName?: string;
  renderValueError?: (errorKey: string) => ReactNode;
  renderLabelError?: (errorKey: string) => ReactNode;
};

export default function StoreContactChannelList({
  idPrefix,
  rows,
  typeInputName,
  valueInputName,
  labelInputName,
  typeLabel,
  valueLabel,
  labelLabel,
  removeLabel,
  optionLabel,
  valuePlaceholder,
  onTypeChange,
  onValueChange,
  onLabelChange,
  onRemove,
  className,
  rowClassName,
  removeButtonClassName,
  renderValueError,
  renderLabelError,
}: StoreContactChannelListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {rows.map((row) => {
        const hasLabelField = labelInputName != null && labelLabel != null;
        const gridClassName = hasLabelField
          ? "grid grid-cols-1 gap-3 md:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_auto]"
          : "grid grid-cols-1 gap-3 md:grid-cols-[140px_minmax(0,1fr)_auto]";

        const typeFieldId = `${idPrefix}-type-${row.rowId}`;
        const valueFieldId = `${idPrefix}-value-${row.rowId}`;
        const labelFieldId = `${idPrefix}-label-${row.rowId}`;

        return (
          <div
            key={row.rowId}
            className={cn(
              "border-border bg-background rounded-lg border p-3",
              (row.typeError || row.valueError || row.labelError) && "border-destructive",
              rowClassName,
            )}
          >
            <div className={gridClassName}>
              <div className="min-w-0 md:max-w-[140px]">
                <Label htmlFor={typeFieldId} className="text-xs">
                  {typeLabel}
                </Label>
                <Select
                  id={typeFieldId}
                  name={typeInputName}
                  className="px-2 py-1.5"
                  error={Boolean(row.typeError)}
                  value={row.type}
                  onChange={(event) => onTypeChange(row.rowId, event.target.value as StoreContactChannelType)}
                  aria-invalid={Boolean(row.typeError)}
                >
                  {STORE_CONTACT_CHANNEL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {optionLabel(type)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="min-w-0">
                <Label htmlFor={valueFieldId} className="text-xs">
                  {valueLabel}
                </Label>
                <Input
                  id={valueFieldId}
                  name={valueInputName}
                  type="text"
                  placeholder={valuePlaceholder?.(row.type)}
                  error={Boolean(row.valueError)}
                  aria-invalid={Boolean(row.valueError)}
                  value={onValueChange ? row.value ?? "" : undefined}
                  defaultValue={onValueChange ? undefined : row.value ?? ""}
                  onChange={onValueChange ? (event) => onValueChange(row.rowId, event.target.value) : undefined}
                />
              </div>

              {hasLabelField ? (
                <div className="min-w-0">
                  <Label htmlFor={labelFieldId} className="text-xs">
                    {labelLabel}
                  </Label>
                  <Input
                    id={labelFieldId}
                    name={labelInputName}
                    type="text"
                    error={Boolean(row.labelError)}
                    aria-invalid={Boolean(row.labelError)}
                    value={onLabelChange ? row.label ?? "" : undefined}
                    defaultValue={onLabelChange ? undefined : row.label ?? ""}
                    onChange={onLabelChange ? (event) => onLabelChange(row.rowId, event.target.value) : undefined}
                  />
                </div>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemove(row.rowId)}
                aria-label={removeLabel}
                className={cn("h-10 justify-center self-end", removeButtonClassName)}
              >
                <X size={16} aria-hidden />
              </Button>
            </div>

            {row.valueError && (
              <Typography size="xs" className="text-destructive mt-2" role="alert">
                {renderValueError?.(row.valueError) ?? row.valueError}
              </Typography>
            )}

            {row.labelError && (
              <Typography size="xs" className="text-destructive mt-2" role="alert">
                {renderLabelError?.(row.labelError) ?? row.labelError}
              </Typography>
            )}
          </div>
        );
      })}
    </div>
  );
}
