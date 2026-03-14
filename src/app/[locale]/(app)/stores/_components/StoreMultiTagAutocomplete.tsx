"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/styles";

type StoreMultiTagAutocompleteOption = {
  value: string;
  label: string;
};

type StoreMultiTagAutocompleteProps = {
  id: string;
  options: StoreMultiTagAutocompleteOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  inputName?: string;
  removeItemAriaLabel: (itemLabel: string) => string;
  helperText?: string;
  className?: string;
};

export default function StoreMultiTagAutocomplete({
  id,
  options,
  selectedValues,
  onChange,
  placeholder,
  inputName,
  removeItemAriaLabel,
  helperText,
  className,
}: StoreMultiTagAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const selectedOptions = useMemo(
    () =>
      selectedValues
        .map((value) => options.find((option) => option.value === value))
        .filter(Boolean) as StoreMultiTagAutocompleteOption[],
    [options, selectedValues],
  );

  const availableOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const unselectedOptions = options.filter((option) => !selectedValues.includes(option.value));

    if (!isDropdownOpen) return [];
    if (!normalizedQuery) return unselectedOptions;

    return unselectedOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(normalizedQuery) || option.value.toLowerCase().includes(normalizedQuery),
    );
  }, [isDropdownOpen, options, query, selectedValues]);

  const safeActiveOptionIndex = useMemo(() => {
    if (availableOptions.length === 0) return -1;
    if (activeOptionIndex < 0) return 0;
    if (activeOptionIndex >= availableOptions.length) return availableOptions.length - 1;
    return activeOptionIndex;
  }, [activeOptionIndex, availableOptions.length]);

  const resolveBestOption = (rawValue: string) => {
    const normalizedValue = rawValue.trim().toLowerCase();
    if (!normalizedValue) return null;

    const unselectedOptions = options.filter((option) => !selectedValues.includes(option.value));

    const byValue = unselectedOptions.find((option) => option.value.toLowerCase() === normalizedValue);
    if (byValue) return byValue;

    const byLabel = unselectedOptions.find((option) => option.label.toLowerCase() === normalizedValue);
    if (byLabel) return byLabel;

    return unselectedOptions.find((option) => option.label.toLowerCase().startsWith(normalizedValue)) ?? null;
  };

  const appendOption = (option: StoreMultiTagAutocompleteOption) => {
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
      setActiveOptionIndex((previous) => {
        const normalizedPrevious = previous < 0 ? 0 : Math.min(previous, availableOptions.length - 1);
        return (normalizedPrevious + 1) % availableOptions.length;
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
      setActiveOptionIndex((previous) => {
        const normalizedPrevious = previous < 0 ? 0 : Math.min(previous, availableOptions.length - 1);
        return normalizedPrevious <= 0 ? availableOptions.length - 1 : normalizedPrevious - 1;
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

      const bestOption = resolveBestOption(query);
      if (bestOption) appendOption(bestOption);
      return;
    }

    if (event.key === "Backspace" && query.trim().length === 0 && selectedValues.length > 0) {
      event.preventDefault();
      const lastValue = selectedValues[selectedValues.length - 1];
      removeOption(lastValue);
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
        <div className="border-input bg-background focus-within:ring-ring flex min-h-10 w-full flex-wrap items-center gap-1 rounded-md border px-2 py-1 focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-none">
          {selectedOptions.map((option) => (
            <span
              key={option.value}
              className="border-border bg-muted inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm"
            >
              {option.label}
              <button
                type="button"
                onClick={() => removeOption(option.value)}
                className="focus-visible:ring-ring cursor-pointer rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
                aria-label={removeItemAriaLabel(option.label)}
              >
                <X size={14} aria-hidden />
              </button>
            </span>
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
              window.setTimeout(() => {
                setIsDropdownOpen(false);
              }, 0);
            }}
            placeholder={placeholder}
            className="text-foreground placeholder:text-muted-foreground h-8 min-w-[140px] flex-1 border-0 bg-transparent px-1 text-sm focus:outline-none"
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
            className="border-border bg-background absolute top-full right-0 left-0 z-10 mt-1 max-h-52 overflow-auto rounded-md border p-1 shadow-lg"
            role="listbox"
          >
            {availableOptions.map((option, optionIndex) => (
              <li key={option.value}>
                <button
                  id={`${id}-option-${optionIndex}`}
                  type="button"
                  onClick={() => appendOption(option)}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveOptionIndex(optionIndex)}
                  className={cn(
                    "text-foreground hover:bg-muted focus-visible:ring-ring w-full cursor-pointer rounded px-2 py-2 text-left text-sm focus-visible:ring-2 focus-visible:outline-none",
                    safeActiveOptionIndex === optionIndex && "bg-muted",
                  )}
                  role="option"
                  aria-selected={safeActiveOptionIndex === optionIndex}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {helperText ? <p className="text-text-muted text-xs">{helperText}</p> : null}
    </div>
  );
}
