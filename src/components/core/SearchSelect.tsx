"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/styles";
import { foldSearchText } from "@/lib/strings/foldSearchText";

export type SearchSelectOption = {
  value: string;
  label: string;
};

export type SearchSelectProps = {
  id: string;
  options: SearchSelectOption[];
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder: string;
  clearLabel: string;
  noResultsLabel: string;
  /** When false, value cannot be cleared from the UI; closed state opens like a native select. */
  clearable?: boolean;
  disabled?: boolean;
  error?: boolean;
};

/**
 * Filterable single-select: typeahead search, keyboard navigation, optional clear.
 */
export default function SearchSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  clearLabel,
  noResultsLabel,
  clearable = true,
  disabled = false,
  error = false,
}: SearchSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!isOpen) return [];
    const folded = foldSearchText(query);
    if (!folded) return options;
    return options.filter((o) => foldSearchText(o.label).includes(folded) || foldSearchText(o.value).includes(folded));
  }, [isOpen, options, query]);

  const safeActiveIndex = useMemo(() => {
    if (filteredOptions.length === 0) return -1;
    if (activeIndex < 0) return 0;
    return Math.min(activeIndex, filteredOptions.length - 1);
  }, [activeIndex, filteredOptions.length]);

  const select = useCallback(
    (option: SearchSelectOption) => {
      onChange(option.value);
      setQuery("");
      setIsOpen(false);
      setActiveIndex(-1);
    },
    [onChange],
  );

  const clear = useCallback(() => {
    onChange(null);
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, [onChange]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (filteredOptions.length === 0) return;
      setActiveIndex((prev) => {
        const norm = prev < 0 ? 0 : Math.min(prev, filteredOptions.length - 1);
        return (norm + 1) % filteredOptions.length;
      });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (filteredOptions.length === 0) return;
      setActiveIndex((prev) => {
        const norm = prev < 0 ? 0 : Math.min(prev, filteredOptions.length - 1);
        return norm <= 0 ? filteredOptions.length - 1 : norm - 1;
      });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const active = filteredOptions[safeActiveIndex];
      if (active) select(active);
      return;
    }
    if (event.key === "Escape") {
      setQuery("");
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const displayValue = selectedOption ? `${selectedOption.value} - ${selectedOption.label}` : "";

  const handleOpenList = useCallback(() => {
    setQuery("");
    setActiveIndex(-1);
    setIsOpen(true);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const handleSelectLikeTriggerClick = useCallback(() => {
    if (disabled) return;
    handleOpenList();
  }, [disabled, handleOpenList]);

  const handleSelectLikeTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpenList();
    }
  };

  const showClosedValueTrigger = Boolean(selectedOption && !isOpen);

  return (
    <div className="relative">
      <div
        className={cn(
          "border-input bg-background focus-within:ring-ring flex h-10 w-full items-center rounded-md border text-sm transition-colors focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-none",
          error && "border-destructive focus-within:ring-destructive",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        {showClosedValueTrigger ? (
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={`${id}-options`}
            className="text-foreground focus-visible:ring-ring flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed"
            onClick={handleSelectLikeTriggerClick}
            onKeyDown={handleSelectLikeTriggerKeyDown}
          >
            <span className="min-w-0 flex-1 truncate">{displayValue}</span>
          </button>
        ) : (
          <input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls={`${id}-options`}
            aria-activedescendant={safeActiveIndex >= 0 ? `${id}-option-${safeActiveIndex}` : undefined}
            value={isOpen ? query : ""}
            placeholder={!selectedOption ? placeholder : ""}
            disabled={disabled}
            className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm focus:outline-none disabled:cursor-not-allowed"
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => {
              setIsOpen(true);
            }}
            onBlur={() => {
              window.setTimeout(() => {
                setIsOpen(false);
              }, 0);
            }}
            onKeyDown={handleKeyDown}
          />
        )}
        <div className="flex shrink-0 items-center gap-1 pr-2">
          {clearable && selectedOption ? (
            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              aria-label={clearLabel}
              className="focus-visible:ring-ring text-text-muted hover:text-foreground rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none"
            >
              <X size={14} aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            tabIndex={-1}
            onClick={() => {
              if (selectedOption) {
                handleOpenList();
              } else {
                setIsOpen((prev) => !prev);
                inputRef.current?.focus();
              }
            }}
            className="focus-visible:ring-ring text-text-muted rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none"
            aria-hidden
          >
            <ChevronDown size={16} aria-hidden />
          </button>
        </div>
      </div>

      {isOpen && (
        <ul
          id={`${id}-options`}
          role="listbox"
          className="border-border bg-background absolute top-full right-0 left-0 z-10 mt-1 max-h-52 overflow-auto rounded-md border p-1 shadow-lg"
        >
          {filteredOptions.length === 0 ? (
            <li className="text-text-muted px-2 py-2 text-sm">{noResultsLabel}</li>
          ) : (
            filteredOptions.map((option, idx) => (
              <li key={option.value}>
                <button
                  id={`${id}-option-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={safeActiveIndex === idx}
                  onClick={() => select(option)}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    "text-foreground hover:bg-muted focus-visible:ring-ring w-full cursor-pointer rounded px-2 py-2 text-left text-sm focus-visible:ring-2 focus-visible:outline-none",
                    safeActiveIndex === idx && "bg-muted",
                  )}
                >
                  <span className="font-medium">{option.value}</span>
                  <span className="text-text-muted"> - {option.label}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
