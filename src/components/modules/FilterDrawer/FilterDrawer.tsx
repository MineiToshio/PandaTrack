"use client";

import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Button from "@/components/core/Button/Button";
import Chip from "@/components/core/Chip";
import DatePickerInput from "@/components/core/DatePickerInput";
import DateRangePickerInput from "@/components/core/DateRangePickerInput";
import Eyebrow from "@/components/core/Eyebrow";
import IconButton from "@/components/core/IconButton";
import Input from "@/components/core/Input";
import MultiTagAutocomplete from "@/components/core/MultiTagAutocomplete";
import Pill from "@/components/core/Pill";
import Portal from "@/components/core/Portal";
import Switch from "@/components/core/Switch";
import { cn } from "@/lib/styles";
import { FOCUS_OPTIONS_NO_SCROLL, getFocusableElements } from "@/lib/a11y/focusable";

export type FilterPillsSection = {
  id: string;
  label: string;
  type: "pills";
  options: Array<{ value: string; label: string; icon?: ReactNode }>;
  /** Default `true`. When false, single-select. */
  multi?: boolean;
};

export type FilterPillsSearchSection = {
  id: string;
  label: string;
  type: "pills-search";
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
};

export type FilterAutocompleteSection = {
  id: string;
  label: string;
  type: "autocomplete";
  options: Array<{ value: string; label: string }>;
  /** Placeholder for the search input. */
  placeholder?: string;
  /** Message shown when search yields no results. */
  emptyMessage?: string;
};

export type FilterSwitchesSection = {
  id: string;
  label: string;
  type: "switches";
  options: Array<{ value: string; label: string; helper?: string }>;
};

/** Inline multi-tag autocomplete: tags appear inside the input box, not below it. */
export type FilterTagAutocompleteSection = {
  id: string;
  label: string;
  type: "tag-autocomplete";
  options: Array<{ value: string; label: string; leadingDecoration?: ReactNode }>;
  placeholder?: string;
};

/**
 * Date range with two custom DatePickerInput fields. Value shape:
 *   `{ from?: string; to?: string; flag?: boolean }`
 * The optional `flag` boolean backs the `trailingSwitch` (e.g. "Por recibir"); the consumer
 * is responsible for honoring it (typically by clearing `from`/`to` when the flag is on).
 */
export type FilterDateRangeSection = {
  id: string;
  label: string;
  type: "date-range";
  fromLabel: string;
  toLabel: string;
  /** Quick-select pills rendered INSIDE the calendar popup. */
  presets?: Array<{ value: string; label: string }>;
  /**
   * Resolves a preset value into a concrete `{ from, to }` ISO range. The drawer applies
   * the resolved range to the section's value when the user clicks a preset pill.
   */
  resolvePreset?: (value: string) => { from?: string; to?: string };
  /**
   * Optional trailing switch rendered inside the same fieldset (below the inputs).
   * When ON, the date-range fields auto-disable visually and the consumer should clear them.
   */
  trailingSwitch?: { label: string; helper?: string };
  /** Helper text rendered under the legend, typically explaining the disabled state. */
  helperText?: string;
  /** Disables the date inputs (the trailing switch stays interactive). */
  disabled?: boolean;
  /**
   * `"split"` (default) → two stacked single-date pickers (Desde + Hasta).
   * `"single"` → one combined `<DateRangePickerInput>` with side-by-side calendars.
   * Use `"single"` for forward-looking filters where range selection is the dominant pattern
   * (e.g. expected delivery window); `"split"` for backward-looking filters where each
   * endpoint is often filled independently (e.g. order date).
   */
  mode?: "split" | "single";
  /** Used as the placeholder + clear aria-label of the single-range trigger. */
  singleRangePlaceholder?: string;
  singleRangeClearLabel?: string;
};

/** Free-text filter (e.g. product name). Value shape: `string`. */
export type FilterTextSection = {
  id: string;
  label: string;
  type: "text";
  placeholder?: string;
};

export type FilterSection =
  | FilterPillsSection
  | FilterPillsSearchSection
  | FilterAutocompleteSection
  | FilterSwitchesSection
  | FilterTagAutocompleteSection
  | FilterDateRangeSection
  | FilterTextSection;

export type FilterDrawerValues = Record<string, unknown>;

export type FilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  sections: FilterSection[];
  values: FilterDrawerValues;
  onChange: (values: FilterDrawerValues) => void;
  onApply: () => void;
  onClear: () => void;
  /** Optional live preview count of matching results. */
  resultsCount?: number;
  /** Localized labels for footer CTAs. */
  applyLabel?: string;
  clearLabel?: string;
  closeLabel?: string;
  applyCountLabel?: (count: number) => string;
};

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") return [value];
  return [];
}

export default function FilterDrawer({
  open,
  onOpenChange,
  title,
  sections,
  values,
  onChange,
  onApply,
  onClear,
  resultsCount,
  applyLabel = "Apply",
  clearLabel = "Clear",
  closeLabel = "Close",
  applyCountLabel,
}: FilterDrawerProps) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusInitial = () => {
      const container = containerRef.current;
      if (!container) return;
      const focusables = getFocusableElements(container);
      const target = focusables[0] ?? container;
      target.focus(FOCUS_OPTIONS_NO_SCROLL);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key !== "Tab" || !containerRef.current) return;
      const focusables = getFocusableElements(containerRef.current);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus(FOCUS_OPTIONS_NO_SCROLL);
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus(FOCUS_OPTIONS_NO_SCROLL);
      }
    };

    focusInitial();
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus(FOCUS_OPTIONS_NO_SCROLL);
      }
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const togglePill = (section: FilterPillsSection | FilterPillsSearchSection, optionValue: string) => {
    const current = asArray(values[section.id]);
    const isSingle = section.type === "pills" && section.multi === false;
    if (isSingle) {
      onChange({ ...values, [section.id]: current[0] === optionValue ? null : optionValue });
      return;
    }
    const next = current.includes(optionValue) ? current.filter((v) => v !== optionValue) : [...current, optionValue];
    onChange({ ...values, [section.id]: next });
  };

  const toggleSwitch = (sectionId: string, optionValue: string, on: boolean) => {
    const current = asArray(values[sectionId]);
    const next = on ? [...new Set([...current, optionValue])] : current.filter((v) => v !== optionValue);
    onChange({ ...values, [sectionId]: next });
  };

  const addAutocompleteValue = (sectionId: string, optionValue: string) => {
    const current = asArray(values[sectionId]);
    if (!current.includes(optionValue)) {
      onChange({ ...values, [sectionId]: [...current, optionValue] });
    }
  };

  const removeAutocompleteValue = (sectionId: string, optionValue: string) => {
    const current = asArray(values[sectionId]);
    onChange({ ...values, [sectionId]: current.filter((v) => v !== optionValue) });
  };

  const renderPillsSection = (section: FilterPillsSection | FilterPillsSearchSection) => {
    const selected = new Set(asArray(values[section.id]));
    const search = section.type === "pills-search" ? (searchQueries[section.id] ?? "") : "";
    const sectionOptions: Array<{ value: string; label: string; icon?: ReactNode }> = section.options;
    const filteredOptions: Array<{ value: string; label: string; icon?: ReactNode }> =
      section.type === "pills-search" && search.trim()
        ? sectionOptions.filter((opt) => opt.label.toLowerCase().includes(search.trim().toLowerCase()))
        : sectionOptions;

    return (
      <fieldset key={section.id} className="[margin:0] flex flex-col [padding:0] [border:none]">
        <Eyebrow as="legend" className="mb-2">
          {section.label}
        </Eyebrow>
        {section.type === "pills-search" && (
          <div className="mb-2">
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearchQueries((prev) => ({ ...prev, [section.id]: event.target.value }))}
              placeholder={section.placeholder ?? "Search"}
              leadingIcon={<Search size={16} aria-hidden="true" />}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {filteredOptions.map((option) => {
            const isSelected = selected.has(option.value);
            return (
              <Pill
                key={option.value}
                role="checkbox"
                aria-checked={isSelected}
                selected={isSelected}
                icon={option.icon}
                onClick={() => togglePill(section, option.value)}
              >
                {option.label}
              </Pill>
            );
          })}
          {filteredOptions.length === 0 && (
            <span className="[font-size:var(--text-body)] [color:var(--text-muted)]">No matches.</span>
          )}
        </div>
      </fieldset>
    );
  };

  const renderAutocompleteSection = (section: FilterAutocompleteSection) => {
    const selected = asArray(values[section.id]);
    const search = searchQueries[section.id] ?? "";
    const availableOptions = section.options.filter(
      (opt) => !selected.includes(opt.value) && opt.label.toLowerCase().includes(search.toLowerCase()),
    );

    return (
      <fieldset key={section.id} className="[margin:0] flex flex-col [padding:0] [border:none]">
        <Eyebrow as="legend" className="mb-2">
          {section.label}
        </Eyebrow>
        {selected.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selected.map((val) => {
              const option = section.options.find((o) => o.value === val);
              const displayLabel = option?.label ?? val;
              return (
                <Chip key={val} variant="accent">
                  {displayLabel}
                  <button
                    type="button"
                    onClick={() => removeAutocompleteValue(section.id, val)}
                    className="cursor-pointer rounded p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:[outline-color:var(--focus-ring)]"
                    aria-label={`Remove ${displayLabel}`}
                  >
                    <X size={12} aria-hidden />
                  </button>
                </Chip>
              );
            })}
          </div>
        )}
        <div className="mb-2">
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearchQueries((prev) => ({ ...prev, [section.id]: event.target.value }))}
            placeholder={section.placeholder ?? "Search..."}
            leadingIcon={<Search size={16} aria-hidden="true" />}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {availableOptions.map((option) => (
            <Pill key={option.value} onClick={() => addAutocompleteValue(section.id, option.value)}>
              {option.label}
            </Pill>
          ))}
          {availableOptions.length === 0 && search.trim() && (
            <span className="[font-size:var(--text-body)] [color:var(--text-muted)]">
              {section.emptyMessage ?? "No matches."}
            </span>
          )}
        </div>
      </fieldset>
    );
  };

  const renderSwitchesSection = (section: FilterSwitchesSection) => (
    <fieldset key={section.id} className="[margin:0] flex flex-col [padding:0] [border:none]">
      <Eyebrow as="legend" className="mb-2">
        {section.label}
      </Eyebrow>
      <div className="flex flex-col gap-2">
        {section.options.map((option) => {
          const isOn = asArray(values[section.id]).includes(option.value);
          return (
            <label
              key={option.value}
              className="flex items-center justify-between gap-3 py-1 [color:var(--text-primary)]"
            >
              <span className="flex flex-col">
                <span className="[font-size:var(--text-body)]">{option.label}</span>
                {option.helper && (
                  <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{option.helper}</span>
                )}
              </span>
              <Switch checked={isOn} onChange={(next) => toggleSwitch(section.id, option.value, next)} />
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  const renderTagAutocompleteSection = (section: FilterTagAutocompleteSection) => {
    const selected = asArray(values[section.id]);
    return (
      <fieldset key={section.id} className="[margin:0] flex flex-col gap-2 [padding:0] [border:none]">
        <Eyebrow as="legend" className="mb-2">
          {section.label}
        </Eyebrow>
        <MultiTagAutocomplete
          id={`${generatedId}-tag-${section.id}`}
          options={section.options}
          selectedValues={selected}
          onChange={(next) => onChange({ ...values, [section.id]: next })}
          placeholder={section.placeholder ?? "Search..."}
          showSearchIcon
        />
      </fieldset>
    );
  };

  const renderDateRangeSection = (section: FilterDateRangeSection) => {
    const current = (values[section.id] ?? {}) as { from?: string; to?: string; flag?: boolean };
    const handleChange = (key: "from" | "to", value: string | undefined) => {
      const next = { ...current, [key]: value || undefined };
      onChange({ ...values, [section.id]: next });
    };
    const handlePreset = (presetValue: string) => {
      if (!section.resolvePreset) return;
      const resolved = section.resolvePreset(presetValue);
      // Preserve the trailing switch flag while replacing the range from the preset.
      onChange({ ...values, [section.id]: { ...resolved, flag: current.flag } });
    };
    const handleSwitchToggle = (on: boolean) => {
      // When toggle is ON, blank the range so the consumer doesn't need to defensively clear.
      onChange({ ...values, [section.id]: on ? { flag: true } : { ...current, flag: false } });
    };
    const parseISO = (iso: string | undefined): Date | null => {
      if (!iso) return null;
      const [y, m, d] = iso.split("-").map(Number);
      if (!y || !m || !d) return null;
      return new Date(y, m - 1, d);
    };
    const toISO = (date: Date | null): string | undefined => {
      if (!date) return undefined;
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };
    const inputsDisabled = section.disabled || current.flag === true;
    const mode = section.mode ?? "split";
    const handleRangeChange = (nextFrom: Date | null, nextTo: Date | null) => {
      onChange({
        ...values,
        [section.id]: { ...current, from: toISO(nextFrom), to: toISO(nextTo) },
      });
    };
    return (
      <fieldset
        key={section.id}
        className="[margin:0] flex flex-col [padding:0] [border:none]"
        aria-disabled={section.disabled || undefined}
      >
        <Eyebrow as="legend" className="mb-2">
          {section.label}
        </Eyebrow>
        {section.helperText && (
          <p className="mb-2 [font-size:var(--text-caption)] [color:var(--text-muted)]">{section.helperText}</p>
        )}
        <div
          className={cn(
            mode === "split" ? "grid grid-cols-2 gap-2" : "block",
            inputsDisabled && "pointer-events-none opacity-50",
          )}
          aria-disabled={inputsDisabled || undefined}
        >
          {mode === "single" ? (
            <DateRangePickerInput
              id={`${generatedId}-daterange-${section.id}`}
              from={parseISO(current.from)}
              to={parseISO(current.to)}
              onChange={handleRangeChange}
              placeholder={section.singleRangePlaceholder ?? `${section.fromLabel} – ${section.toLabel}`}
              clearLabel={section.singleRangeClearLabel ?? "Clear"}
              disabled={inputsDisabled}
              presets={section.presets}
              onPresetSelect={handlePreset}
              size="sm"
            />
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{section.fromLabel}</span>
                <DatePickerInput
                  id={`${generatedId}-date-${section.id}-from`}
                  value={parseISO(current.from)}
                  onChange={(date) => handleChange("from", toISO(date))}
                  placeholder={section.fromLabel}
                  disabled={inputsDisabled}
                  presets={section.presets}
                  onPresetSelect={handlePreset}
                  popupAlign="start"
                  size="sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{section.toLabel}</span>
                <DatePickerInput
                  id={`${generatedId}-date-${section.id}-to`}
                  value={parseISO(current.to)}
                  onChange={(date) => handleChange("to", toISO(date))}
                  placeholder={section.toLabel}
                  disabled={inputsDisabled}
                  presets={section.presets}
                  onPresetSelect={handlePreset}
                  popupAlign="end"
                  size="sm"
                />
              </label>
            </>
          )}
        </div>
        {section.trailingSwitch && (
          <label className="mt-3 flex items-start justify-between gap-3 py-1 [color:var(--text-primary)]">
            <span className="flex flex-col">
              <span className="[font-size:var(--text-body)]">{section.trailingSwitch.label}</span>
              {section.trailingSwitch.helper && (
                <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">
                  {section.trailingSwitch.helper}
                </span>
              )}
            </span>
            <Switch checked={current.flag === true} onChange={handleSwitchToggle} />
          </label>
        )}
      </fieldset>
    );
  };

  const renderTextSection = (section: FilterTextSection) => {
    const current = typeof values[section.id] === "string" ? (values[section.id] as string) : "";
    return (
      <fieldset key={section.id} className="[margin:0] flex flex-col [padding:0] [border:none]">
        <Eyebrow as="legend" className="mb-2">
          {section.label}
        </Eyebrow>
        <Input
          type="text"
          value={current}
          onChange={(event) => onChange({ ...values, [section.id]: event.target.value })}
          placeholder={section.placeholder}
          aria-label={section.label}
        />
      </fieldset>
    );
  };

  const renderSection = (section: FilterSection) => {
    if (section.type === "autocomplete") return renderAutocompleteSection(section);
    if (section.type === "switches") return renderSwitchesSection(section);
    if (section.type === "tag-autocomplete") return renderTagAutocompleteSection(section);
    if (section.type === "date-range") return renderDateRangeSection(section);
    if (section.type === "text") return renderTextSection(section);
    return renderPillsSection(section);
  };

  const applyButtonLabel =
    typeof resultsCount === "number" && applyCountLabel ? applyCountLabel(resultsCount) : applyLabel;

  return (
    <Portal>
      <div
        className={cn(
          "fixed inset-0 z-[var(--z-drawer,70)] flex md:justify-end",
          "[backdrop-filter:blur(8px)] [background:var(--surface-overlay)]",
          "items-end md:items-stretch",
        )}
        role="presentation"
      >
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cn(
            "relative flex w-full flex-col [outline:none] [background:var(--surface-elevated)]",
            "[box-shadow:var(--shadow-elevation-3)]",
            // Mobile: bottom sheet — top border only, top corners rounded
            "max-h-[92svh] [border-top:1px_solid_var(--border-strong)]",
            "[border-top-left-radius:20px] [border-top-right-radius:20px]",
            "motion-safe:animate-[drawer-rise_280ms_linear(0,0.5,0.85,0.97,1)_both]",
            // Desktop: side drawer — left border only, fully rectangular
            "md:h-full md:max-h-none md:w-[440px]",
            "md:[border-top-left-radius:0] md:[border-top-right-radius:0]",
            "md:[border-left:1px_solid_var(--border-strong)] md:[border-top:none]",
            "md:motion-safe:animate-[drawer-slide-right_280ms_linear(0,0.5,0.85,0.97,1)_both]",
            "[padding-bottom:env(safe-area-inset-bottom)]",
          )}
        >
          {/* Drag handle — mobile only */}
          <div
            className="mx-auto mt-2 block h-[4px] w-9 rounded-full [background:var(--border-strong)] md:hidden"
            aria-hidden="true"
          />
          <header className="flex items-center gap-3 px-[22px] pt-4 pb-[14px] [border-bottom:1px_solid_var(--border)]">
            <SlidersHorizontal size={18} aria-hidden="true" className="[color:var(--accent)]" />
            <h2
              id={titleId}
              className="flex-1 [font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]"
            >
              {title}
            </h2>
            <IconButton
              aria-label={closeLabel}
              size="sm"
              variant="ghost"
              icon={<X size={16} aria-hidden="true" />}
              onClick={() => onOpenChange(false)}
              className="[color:var(--accent)]"
            />
          </header>
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-[22px] py-[18px]">
            {sections.map(renderSection)}
          </div>
          <footer className="flex items-center gap-[10px] px-[22px] py-[14px] [background:var(--surface-elevated)] [border-top:1px_solid_var(--border)]">
            <Button variant="ghost" size="sm" onClick={onClear}>
              {clearLabel}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onApply}
              className="flex-1"
              leadingIcon={<Check size={15} aria-hidden="true" />}
            >
              {applyButtonLabel}
            </Button>
          </footer>
        </div>
      </div>
      <style>{`
        @keyframes drawer-rise {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes drawer-slide-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </Portal>
  );
}
