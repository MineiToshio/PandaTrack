"use client";

import { cn } from "@/lib/styles";

type StoreSelectableTagOption = {
  value: string;
  label: string;
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
              "border-border bg-background text-text-body focus-visible:ring-ring min-h-10 cursor-pointer rounded-full border px-4 text-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              isSelected && "border-primary bg-primary/10 text-text-title",
              tagClassName,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
