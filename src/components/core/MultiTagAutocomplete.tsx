"use client";

import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Chip from "@/components/core/Chip";
import { foldSearchText } from "@/lib/strings/foldSearchText";
import { cn } from "@/lib/styles";

export type MultiTagAutocompleteOption = {
  value: string;
  /** Plain text for filtering and accessible names (no decorative emoji). */
  label: string;
  /** Optional visual prefix (e.g. flag emoji). Not used for search matching. */
  leadingDecoration?: ReactNode;
};

export type MultiTagAutocompleteProps = {
  id: string;
  options: MultiTagAutocompleteOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  /** If provided, hidden inputs are rendered for each selected value (form submission). */
  inputName?: string;
  /** Returns the accessible label for a remove button given the item label. */
  removeItemAriaLabel?: (itemLabel: string) => string;
  helperText?: string;
  /**
   * When true, renders a Search icon prefix inside the input box.
   * Default `false` — pass `true` for filter-drawer-style usage.
   */
  showSearchIcon?: boolean;
  className?: string;
};

export default function MultiTagAutocomplete({
  id,
  options,
  selectedValues,
  onChange,
  placeholder,
  inputName,
  removeItemAriaLabel = (label) => `Remove ${label}`,
  helperText,
  showSearchIcon = false,
  className,
}: MultiTagAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const selectedOptions = useMemo(
    () =>
      selectedValues
        .map((value) => options.find((option) => option.value === value))
        .filter(Boolean) as MultiTagAutocompleteOption[],
    [options, selectedValues],
  );

  const availableOptions = useMemo(() => {
    const foldedQuery = foldSearchText(query);
    const unselected = options.filter((option) => !selectedValues.includes(option.value));

    if (!isDropdownOpen) return [];
    if (!foldedQuery) return unselected;

    return unselected.filter(
      (option) =>
        foldSearchText(option.label).includes(foldedQuery) || foldSearchText(option.value).includes(foldedQuery),
    );
  }, [isDropdownOpen, options, query, selectedValues]);

  const safeActiveOptionIndex = useMemo(() => {
    if (availableOptions.length === 0) return -1;
    if (activeOptionIndex < 0) return 0;
    if (activeOptionIndex >= availableOptions.length) return availableOptions.length - 1;
    return activeOptionIndex;
  }, [activeOptionIndex, availableOptions.length]);

  const renderOptionContent = (option: MultiTagAutocompleteOption) => {
    if (option.leadingDecoration == null) return option.label;
    return (
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex shrink-0 items-center">{option.leadingDecoration}</span>
        {option.label}
      </span>
    );
  };

  const resolveBestOption = (rawValue: string) => {
    const foldedInput = foldSearchText(rawValue);
    if (!foldedInput) return null;
    const unselected = options.filter((option) => !selectedValues.includes(option.value));
    const byValue = unselected.find((option) => foldSearchText(option.value) === foldedInput);
    if (byValue) return byValue;
    const byLabel = unselected.find((option) => foldSearchText(option.label) === foldedInput);
    if (byLabel) return byLabel;
    return unselected.find((option) => foldSearchText(option.label).startsWith(foldedInput)) ?? null;
  };

  const appendOption = (option: MultiTagAutocompleteOption) => {
    if (selectedValues.includes(option.value)) return;
    onChange([...selectedValues, option.value]);
    setQuery("");
    setActiveOptionIndex(-1);
    setIsDropdownOpen(true);
  };

  const removeOption = (value: string) => {
    onChange(selectedValues.filter((item) => item !== value));
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isDropdownOpen) {
        setIsDropdownOpen(true);
        return;
      }
      if (availableOptions.length === 0) return;
      setActiveOptionIndex((prev) => {
        const norm = prev < 0 ? 0 : Math.min(prev, availableOptions.length - 1);
        return (norm + 1) % availableOptions.length;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isDropdownOpen) {
        setIsDropdownOpen(true);
        return;
      }
      if (availableOptions.length === 0) return;
      setActiveOptionIndex((prev) => {
        const norm = prev < 0 ? 0 : Math.min(prev, availableOptions.length - 1);
        return norm <= 0 ? availableOptions.length - 1 : norm - 1;
      });
      return;
    }

    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      const activeOption = availableOptions[safeActiveOptionIndex];
      if (activeOption) {
        appendOption(activeOption);
        return;
      }
      const best = resolveBestOption(query);
      if (best) appendOption(best);
      return;
    }

    if (event.key === "Backspace" && query.trim().length === 0 && selectedValues.length > 0) {
      event.preventDefault();
      removeOption(selectedValues[selectedValues.length - 1]);
      return;
    }

    if (event.key === "Escape") {
      setQuery("");
      setActiveOptionIndex(-1);
      setIsDropdownOpen(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative min-w-0">
        {inputName
          ? selectedValues.map((value) => <input key={value} type="hidden" name={inputName} value={value} />)
          : null}
        <div
          className={cn(
            "flex min-h-10 w-full flex-wrap items-center gap-1 rounded-[var(--radius-md)] px-2 py-1",
            "[background:var(--surface)] [border:1px_solid_var(--border)]",
            "has-[:focus-visible]:[border-color:var(--border-strong)]",
            "has-[:focus-visible]:outline has-[:focus-visible]:outline-2",
            "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:[outline-color:var(--focus-ring)]",
          )}
        >
          {showSearchIcon && (
            <Search size={16} aria-hidden="true" className="ml-1 flex-shrink-0 [color:var(--text-muted)]" />
          )}
          {selectedOptions.map((option) => (
            <Chip key={option.value} variant="accent">
              {renderOptionContent(option)}
              <button
                type="button"
                onClick={() => removeOption(option.value)}
                className="cursor-pointer rounded p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:[outline-color:var(--focus-ring)]"
                aria-label={removeItemAriaLabel(option.label)}
              >
                <X size={12} aria-hidden />
              </button>
            </Chip>
          ))}
          <input
            id={id}
            role="combobox"
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsDropdownOpen(true);
            }}
            onKeyDown={handleInputKeyDown}
            onFocus={() => setIsDropdownOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setIsDropdownOpen(false), 0);
            }}
            placeholder={placeholder}
            className="h-8 min-w-[140px] flex-1 border-0 bg-transparent px-1 [font-size:var(--text-caption)] [color:var(--text-primary)] [caret-color:var(--accent)] placeholder:[color:var(--text-muted)] focus:outline-none"
            aria-autocomplete="list"
            aria-expanded={availableOptions.length > 0}
            aria-haspopup="listbox"
            aria-controls={`${id}-options`}
            aria-activedescendant={safeActiveOptionIndex >= 0 ? `${id}-option-${safeActiveOptionIndex}` : undefined}
          />
        </div>
        {availableOptions.length > 0 ? (
          <ul
            id={`${id}-options`}
            className="absolute top-full right-0 left-0 z-10 mt-1 max-h-52 overflow-auto rounded-[var(--radius-md)] p-1 [box-shadow:var(--elevation-2)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
            role="listbox"
          >
            {availableOptions.map((option, index) => (
              <li key={option.value}>
                <button
                  id={`${id}-option-${index}`}
                  type="button"
                  onClick={() => appendOption(option)}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveOptionIndex(index)}
                  className={cn(
                    "w-full cursor-pointer rounded-[var(--radius-sm)] px-2 py-2 text-left",
                    "[font-size:var(--text-caption)] [color:var(--text-primary)]",
                    "hover:[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:[outline-color:var(--focus-ring)]",
                    safeActiveOptionIndex === index &&
                      "[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
                  )}
                  role="option"
                  aria-selected={safeActiveOptionIndex === index}
                >
                  {renderOptionContent(option)}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {helperText ? <p className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{helperText}</p> : null}
    </div>
  );
}
