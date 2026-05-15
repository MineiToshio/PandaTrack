"use client";

import { useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import DateRangePickerInput, { type DateRangePreset } from "@/components/core/DateRangePickerInput";
import { useIsMobile } from "@/hooks/useIsMobile";

type OrderDeliveryRangeFieldProps = {
  id: string;
  from: Date | null;
  to: Date | null;
  onChange: (from: Date | null, to: Date | null) => void;
  error?: boolean;
};

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export default function OrderDeliveryRangeField({ id, from, to, onChange, error }: OrderDeliveryRangeFieldProps) {
  const t = useTranslations("orders.form");
  const tPreset = useTranslations("orders.create.dateRange.preset");
  const locale = useLocale();
  const isMobile = useIsMobile();

  const presets: DateRangePreset[] = useMemo(
    () => [
      { value: "next7Days", label: isMobile ? tPreset("next7Days") : tPreset("next7DaysShort") },
      { value: "next30Days", label: isMobile ? tPreset("next30Days") : tPreset("next30DaysShort") },
      { value: "next60Days", label: isMobile ? tPreset("next60Days") : tPreset("next60DaysShort") },
      { value: "thisMonth", label: tPreset("thisMonth") },
      { value: "nextMonth", label: tPreset("nextMonth") },
    ],
    [isMobile, tPreset],
  );

  const handlePresetSelect = useCallback(
    (value: string) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      switch (value) {
        case "next7Days":
          onChange(today, addDays(today, 7));
          break;
        case "next30Days":
          onChange(today, addDays(today, 30));
          break;
        case "next60Days":
          onChange(today, addDays(today, 60));
          break;
        case "thisMonth":
          onChange(startOfMonth(today), endOfMonth(today));
          break;
        case "nextMonth": {
          const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
          onChange(startOfMonth(nextMonth), endOfMonth(nextMonth));
          break;
        }
      }
    },
    [onChange],
  );

  return (
    <DateRangePickerInput
      id={id}
      from={from}
      to={to}
      onChange={onChange}
      placeholder={t("deliveryRangePlaceholder")}
      clearLabel={t("deliveryRangeClearLabel")}
      locale={locale}
      error={error}
      presets={presets}
      onPresetSelect={handlePresetSelect}
      numberOfMonths={isMobile ? 1 : 2}
    />
  );
}
