"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

export type ToggleChoiceOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  /** Optional secondary text shown below the label. Only rendered for `appearance="tile"`. */
  description?: string;
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
  chip: "inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-pill)] [background:var(--surface-elevated)] [border:1.5px_solid_var(--border-strong)] px-3 py-1.5 text-[13px] [color:var(--text-secondary)] transition focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:2px]",
  tile: "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg [background:var(--surface)] [border:1px_solid_var(--border-strong)] px-4 py-3 text-left text-sm [color:var(--text-secondary)] transition focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:2px]",
};

function pressedButtonClass(appearance: NonNullable<ToggleChoiceGroupShared["appearance"]>, isSelected: boolean) {
  if (appearance === "chip") {
    return isSelected
      ? "[background:color-mix(in_oklch,var(--accent)_10%,transparent)] [border-color:var(--accent)] [color:var(--accent)]"
      : "hover:[border-color:color-mix(in_oklch,var(--accent)_50%,var(--border-strong))]";
  }
  return isSelected
    ? "[background:color-mix(in_oklch,var(--accent)_8%,transparent)] [border-color:var(--accent)] [color:var(--text-primary)]"
    : "hover:[border-color:color-mix(in_oklch,var(--accent)_40%,var(--border-strong))]";
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
        const renderTileBody = appearance === "tile" && option.description;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => handleClick(option.value)}
            className={cn(BUTTON_CLASS[appearance], pressedButtonClass(appearance, selected), itemClassName)}
          >
            {option.icon ? (
              appearance === "tile" ? (
                <span
                  aria-hidden
                  className="flex size-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] [color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_14%,var(--surface-elevated))] [&>svg]:size-4"
                >
                  {option.icon}
                </span>
              ) : (
                <span
                  aria-hidden
                  className={cn("[&>svg]:size-3.5", selected ? "[color:var(--accent)]" : "[color:var(--accent-cool)]")}
                >
                  {option.icon}
                </span>
              )
            ) : null}
            {renderTileBody ? (
              <span className="min-w-0 flex-1">
                <span className="block [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
                  {option.label}
                </span>
                <span className="mt-0.5 block [font-size:var(--text-caption)] [color:var(--text-muted)]">
                  {option.description}
                </span>
              </span>
            ) : (
              option.label
            )}
          </button>
        );
      })}
      {trailingSlot ? <div className={appearance === "tile" ? "col-span-full" : undefined}>{trailingSlot}</div> : null}
    </div>
  );
}
