"use client";

import { cn } from "@/lib/styles";
import { useTranslations } from "next-intl";
import { useState } from "react";
import DateInput, { type ISODateString } from "./DateInput";

export type DateRangeInputProps = {
  idFrom?: string;
  idTo?: string;
  nameFrom?: string;
  nameTo?: string;
  valueFrom: ISODateString | null;
  valueTo: ISODateString | null;
  onChangeFrom: (value: ISODateString | null) => void;
  onChangeTo: (value: ISODateString | null) => void;
  min?: ISODateString;
  max?: ISODateString;
  locale?: string;
  placeholderFrom?: string;
  placeholderTo?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
};

function addDays(iso: ISODateString, n: number): ISODateString {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m as number) - 1, (d as number) + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function DateRangeInput({
  idFrom,
  idTo,
  nameFrom,
  nameTo,
  valueFrom,
  valueTo,
  onChangeFrom,
  onChangeTo,
  min,
  max,
  locale,
  placeholderFrom,
  placeholderTo,
  helperText,
  error: errorProp,
  disabled,
  className,
}: DateRangeInputProps) {
  const t = useTranslations("dateRangeInput");
  const [rangeError, setRangeError] = useState<string | null>(null);

  const error = errorProp ?? rangeError;

  function handleFromChange(val: ISODateString | null) {
    onChangeFrom(val);
    if (val && valueTo && val >= valueTo) {
      setRangeError(t("error.toAfterFrom"));
    } else {
      setRangeError(null);
    }
  }

  function handleToChange(val: ISODateString | null) {
    onChangeTo(val);
    if (val && valueFrom && val <= valueFrom) {
      setRangeError(t("error.toAfterFrom"));
    } else {
      setRangeError(null);
    }
  }

  // "to" must be at least one day after "from"
  const minTo = valueFrom ? addDays(valueFrom, 1) : min;

  return (
    <div className={cn("flex flex-col gap-[var(--space-1)]", className)}>
      <div className="flex flex-col gap-[var(--space-3)] @md:flex-row @md:items-start @md:gap-[var(--space-2)]">
        <DateInput
          id={idFrom}
          name={nameFrom}
          value={valueFrom}
          onChange={handleFromChange}
          placeholder={placeholderFrom ?? t("placeholderFrom")}
          min={min}
          max={max}
          locale={locale}
          disabled={disabled}
          error={Boolean(error)}
          className="flex-1"
        />
        <span className="hidden items-center pt-[var(--space-3)] [color:var(--text-muted)] @md:flex" aria-hidden="true">
          →
        </span>
        <DateInput
          id={idTo}
          name={nameTo}
          value={valueTo}
          onChange={handleToChange}
          placeholder={placeholderTo ?? t("placeholderTo")}
          min={minTo}
          max={max}
          locale={locale}
          disabled={disabled}
          error={Boolean(error)}
          className="flex-1"
        />
      </div>
      {error && (
        <p
          role="alert"
          aria-live="polite"
          className="[font-size:var(--text-caption)] [color:var(--destructive-chip-text)]"
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{helperText}</p>
      )}
    </div>
  );
}
