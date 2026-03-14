"use client";

import { cn } from "@/lib/styles";

type StoreSegmentedControlOption = {
  value: string;
  label: string;
};

type StoreSegmentedControlProps = {
  options: StoreSegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  name?: string;
  className?: string;
};

export default function StoreSegmentedControl({
  options,
  value,
  onChange,
  name,
  className,
}: StoreSegmentedControlProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2", className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              "border-border bg-background text-text-body focus-visible:ring-ring min-h-11 cursor-pointer rounded-lg border px-4 py-3 text-left text-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              isSelected && "border-primary bg-primary/10 text-text-title",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
