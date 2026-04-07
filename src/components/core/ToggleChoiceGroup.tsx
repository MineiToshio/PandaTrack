"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

export type ToggleChoiceOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

type ToggleChoiceGroupShared = {
  options: ToggleChoiceOption[];
  className?: string;
  /** When set, renders hidden inputs for native form submission. */
  formName?: string;
  /** Extra classes on each toggle button. */
  itemClassName?: string;
  /**
   * chip: wrapping row, compact height, rounded-xl (multi-select tags, filters).
   * tile: two-column grid on sm+, larger targets, rounded-lg (single prominent choice).
   */
  appearance?: "chip" | "tile";
  /** Rendered after option buttons (e.g. auxiliary chip actions). */
  trailingSlot?: ReactNode;
};

export type ToggleChoiceGroupProps =
  | (ToggleChoiceGroupShared & {
      mode: "single";
      value: string;
      onChange: (value: string) => void;
    })
  | (ToggleChoiceGroupShared & {
      mode: "multiple";
      selectedValues: string[];
      onChange: (values: string[]) => void;
    });

const CONTAINER_CLASS: Record<NonNullable<ToggleChoiceGroupShared["appearance"]>, string> = {
  chip: "flex flex-wrap gap-2",
  tile: "grid grid-cols-1 gap-2 sm:grid-cols-2",
};

const BUTTON_CLASS: Record<NonNullable<ToggleChoiceGroupShared["appearance"]>, string> = {
  chip: "border-border bg-background text-text-body focus-visible:ring-ring inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border px-4 text-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
  tile: "border-border bg-background text-text-body focus-visible:ring-ring inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border px-4 py-3 text-left text-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
};

function pressedButtonClass(isSelected: boolean) {
  return isSelected
    ? "border-primary bg-primary/10 text-text-title hover:bg-primary/15"
    : "hover:border-primary/50 hover:bg-muted/25";
}

export default function ToggleChoiceGroup(props: ToggleChoiceGroupProps) {
  const appearance = props.appearance ?? "chip";
  const { options, className, formName, itemClassName, trailingSlot } = props;

  const handleClick = (optionValue: string) => {
    if (props.mode === "single") {
      props.onChange(optionValue);
      return;
    }

    const { selectedValues, onChange } = props;
    const isSelected = selectedValues.includes(optionValue);
    if (isSelected) {
      onChange(selectedValues.filter((item) => item !== optionValue));
      return;
    }
    onChange([...selectedValues, optionValue]);
  };

  const isSelected = (optionValue: string) => {
    if (props.mode === "single") {
      return props.value === optionValue;
    }
    return props.selectedValues.includes(optionValue);
  };

  return (
    <div className={cn(CONTAINER_CLASS[appearance], className)}>
      {formName && props.mode === "multiple"
        ? props.selectedValues.map((selectedValue) => (
            <input key={selectedValue} type="hidden" name={formName} value={selectedValue} />
          ))
        : null}
      {formName && props.mode === "single" ? <input type="hidden" name={formName} value={props.value} /> : null}
      {options.map((option) => {
        const selected = isSelected(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => handleClick(option.value)}
            className={cn(BUTTON_CLASS[appearance], pressedButtonClass(selected), itemClassName)}
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
      {trailingSlot ? <div className={appearance === "tile" ? "col-span-full" : undefined}>{trailingSlot}</div> : null}
    </div>
  );
}
