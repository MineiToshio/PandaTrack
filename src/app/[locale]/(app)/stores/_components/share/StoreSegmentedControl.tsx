"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

type StoreSegmentedControlOption = {
  value: string;
  label: string;
  icon?: ReactNode;
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
              "border-border bg-background text-text-body focus-visible:ring-ring inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border px-4 py-3 text-left text-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              isSelected && "border-primary bg-primary/10 text-text-title",
            )}
          >
            {option.icon ? (
              <span className="[&>svg]:size-3.5" aria-hidden>
                {option.icon}
              </span>
            ) : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
