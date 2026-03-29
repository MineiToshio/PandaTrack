"use client";

import { cn } from "@/lib/styles";

export type TabsItem = {
  value: string;
  label: string;
};

type TabsProps = {
  items: TabsItem[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
};

export default function Tabs({ items, value, onChange, ariaLabel, className }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("bg-muted/45 inline-flex w-full flex-wrap gap-1 rounded-2xl p-1", className)}
    >
      {items.map((item) => {
        const isSelected = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`tab-${item.value}`}
            aria-selected={isSelected}
            aria-controls={`tabpanel-${item.value}`}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              "focus-visible:ring-ring focus-visible:ring-offset-background inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 py-2.5 text-base font-semibold transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:text-[1.0625rem]",
              isSelected
                ? "bg-background text-text-title shadow-sm"
                : "text-text-muted hover:bg-background/55 hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
