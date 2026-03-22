"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

type StoreSelectableTagOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

type StoreSelectableTagGroupProps = {
  options: StoreSelectableTagOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  inputName?: string;
  singleSelect?: boolean;
  className?: string;
  tagClassName?: string;
};

export default function StoreSelectableTagGroup({
  options,
  selectedValues,
  onChange,
  inputName,
  singleSelect = false,
  className,
  tagClassName,
}: StoreSelectableTagGroupProps) {
  const handleToggle = (value: string) => {
    const isSelected = selectedValues.includes(value);

    if (singleSelect) {
      onChange(isSelected ? [] : [value]);
      return;
    }

    if (isSelected) {
      onChange(selectedValues.filter((item) => item !== value));
      return;
    }

    onChange([...selectedValues, value]);
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {inputName
        ? selectedValues.map((selectedValue) => (
            <input key={selectedValue} type="hidden" name={inputName} value={selectedValue} />
          ))
        : null}
      {options.map((option) => {
        const isSelected = selectedValues.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => handleToggle(option.value)}
            className={cn(
              "border-border bg-background text-text-body focus-visible:ring-ring inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              isSelected && "border-primary bg-primary/10 text-text-title",
              tagClassName,
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
