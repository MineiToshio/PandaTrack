"use client";

import { ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { MobilePicker, type MobilePickerOption } from "@/components/modules/MobilePicker";
import { cn } from "@/lib/styles";

type StoreViewSortCompactProps = {
  /** Active sort value. */
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  /** Field name ("Ordenar por"), used as the sheet title and inside the trigger's accessible name. */
  label: string;
  /** Accessible name for the trigger, already composed with the active option's label. */
  triggerAriaLabel: string;
  id?: string;
  className?: string;
};

/**
 * Mobile sort trigger for the Orders list "Por tienda" view: an icon button that opens the sort
 * options in a `MobilePicker` sheet.
 *
 * It exists because the sticky mobile row now leads with the search input, and below
 * `lg` there is no width left for a `Select` whose intrinsic floor is its longest option label
 * ("Llegada más próxima"): the two controls together left the search box around 70px. The order
 * view already answers the same squeeze the same way — below `lg` its sort moves inside the filter
 * drawer, so sort is a control you OPEN on mobile, never a value you read off the toolbar. This
 * keeps that rule in the view that has no drawer to move it into, and keeps the row's geometry
 * identical across views: search, one icon trigger, group by.
 */
export default function StoreViewSortCompact({
  value,
  onChange,
  options,
  label,
  triggerAriaLabel,
  id,
  className,
}: StoreViewSortCompactProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const pickerOptions: MobilePickerOption[] = options.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  return (
    <>
      <button
        type="button"
        id={id}
        onClick={() => setSheetOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        aria-label={triggerAriaLabel}
        className={cn(
          // Same bordered box the mobile filter trigger wears in the order view, so both views'
          // second slot reads as the same control at the same size.
          "inline-flex min-h-11 w-11 shrink-0 cursor-pointer items-center justify-center",
          "rounded-[var(--radius-md)] [color:var(--text-primary)]",
          "[background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]",
          "transition-colors [transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)]",
          "hover:[background:color-mix(in_oklab,var(--text-primary)_4%,var(--surface-elevated))]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
          className,
        )}
      >
        <ArrowUpDown size={16} aria-hidden="true" />
      </button>

      <MobilePicker
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={label}
        options={pickerOptions}
        selectedValue={value}
        onSelect={onChange}
        searchable={false}
      />
    </>
  );
}
