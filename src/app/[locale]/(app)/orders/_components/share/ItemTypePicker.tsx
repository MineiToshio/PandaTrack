"use client";

import { ChevronDown, ChevronsUpDown, Search } from "lucide-react";
import { createElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Portal from "@/components/core/Portal";
import { MobilePicker } from "@/components/modules/MobilePicker";
import { useIsMobile } from "@/hooks/useIsMobile";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { foldSearchText } from "@/lib/strings/foldSearchText";
import { cn } from "@/lib/styles";

/** Narrowest the popover may be, whatever the trigger measures. */
const POPOVER_MIN_WIDTH = 220;

/** Gap between the trigger's bottom edge and the popover, in pixels. */
const POPOVER_OFFSET = 4;

export type ItemTypePickerAppearance = "cell" | "chip";
export type ItemTypePickerPresentation = "popover" | "adaptive";

export type ItemTypePickerProps = {
  /** Stable identity for this instance, used to build the listbox id. */
  instanceId: string;
  /** Id put on the trigger, so a caller that focuses cells by id can reach it. */
  triggerId?: string;
  /** Selected catalog key, or an empty string / `null` for "no category yet". */
  value: string | null;
  productTypeKeys: string[];
  /** Resolves a catalog key to its label in the active locale. */
  tProductTypes: (key: string) => string;
  /** Shown on the trigger when nothing is selected. */
  placeholder: string;
  /** Builds the trigger's accessible name from the label it currently shows. */
  ariaLabelFor: (label: string) => string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /**
   * Trigger geometry. `cell` is the borderless spreadsheet cell of the manual item grid; `chip` is
   * the bordered, tap-sized control the image-intake review screen puts beside a product.
   */
  appearance?: ItemTypePickerAppearance;
  /**
   * `popover` always renders the portalled listbox. `adaptive` swaps it for the canonical bottom
   * sheet under 768px, the same way `<Modal>` delegates to `<ModalSheet>`: a popover anchored to a
   * 12px trigger is not a touch target, and the sheet is what every other picker in the app uses on
   * a phone.
   */
  presentation?: ItemTypePickerPresentation;
};

/**
 * The single filterable product-type selector in the Orders module.
 *
 * Why not the canonical `<SearchableSelect>` / `<Combobox>` primitive:
 *  - Trigger height: those primitives render a ~46px input trigger, far too tall
 *    for an inline table cell (the item grid uses a 12px font, ~26px borderless cell).
 *  - Overflow escape: in the grid the cell lives inside the table's `overflow-x-auto`, so the
 *    options list must render through a `Portal` with fixed positioning to avoid
 *    being clipped. `<SearchableSelect>` positions its listbox with `absolute`
 *    inside a `relative` wrapper, which would be clipped here.
 *  - Keyboard ownership: the trigger delegates key events to the grid's shared
 *    Ctrl+Shift cell-navigation and @dnd-kit reorder handler; embedding a primitive
 *    that owns its own key handling would break that integration.
 *
 * It lives here rather than inside the grid because the image-intake review screen has to offer
 * "the same picker the manual product form uses" (`FR-11-93`): one selector, one option list, one
 * search behaviour, so a category chosen from a chat screenshot is chosen exactly as one typed by
 * hand.
 *
 * The ARIA contract follows the canonical combobox/listbox pattern (as in
 * `<SearchableSelect>`), NOT a dialog: the trigger owns `aria-haspopup="listbox"`,
 * `aria-expanded`, and `aria-controls` pointing at the `role="listbox"` options
 * list. The popover container is a presentational positioning wrapper only. In the sheet
 * presentation the trigger says `aria-haspopup="dialog"` instead, because that is what it opens.
 *
 * Portal + fixed positioning so the listbox escapes the table's `overflow-x`.
 * Outer-document scroll repositions; inner listbox scroll is preserved.
 */
export default function ItemTypePicker({
  instanceId,
  triggerId,
  value,
  productTypeKeys,
  tProductTypes,
  placeholder,
  ariaLabelFor,
  open,
  onOpenChange,
  onChange,
  onKeyDown,
  appearance = "cell",
  presentation = "popover",
}: ItemTypePickerProps) {
  const tPicker = useTranslations("orders.picker");
  const isMobile = useIsMobile();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const [query, setQuery] = useState("");

  const usesSheet = presentation === "adaptive" && isMobile;

  // Reset query each time the picker opens; focus the search input.
  useEffect(() => {
    if (!open || usesSheet) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, usesSheet]);

  // Position via Portal + fixed coords. Recompute on outer-document scroll
  // (so the popover follows the trigger when the page scrolls) but ignore
  // scroll events originating inside the listbox itself (so the user can
  // wheel-scroll or grab the scrollbar to navigate long option lists).
  useLayoutEffect(() => {
    if (!open || usesSheet) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCoords(null);
      return;
    }
    const compute = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({ top: rect.bottom + POPOVER_OFFSET, left: rect.left, minWidth: rect.width });
    };
    compute();
    const onScroll = (e: Event) => {
      // Ignore scroll inside our own popover — the user is navigating options.
      if (popoverRef.current?.contains(e.target as Node)) return;
      // Outer-document scroll: keep the popover anchored to the trigger.
      compute();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", compute);
    };
  }, [open, usesSheet]);

  useEffect(() => {
    if (!open || usesSheet) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onOpenChange, usesSheet]);

  const filteredKeys = useMemo(() => {
    const folded = foldSearchText(query);
    if (!folded) return productTypeKeys;
    return productTypeKeys.filter((key) => foldSearchText(tProductTypes(key)).includes(folded));
  }, [productTypeKeys, query, tProductTypes]);

  const sheetOptions = useMemo(
    () =>
      productTypeKeys.map((key) => {
        const Icon = getStoreProductTypeIcon(key);
        const label = tProductTypes(key);
        return { value: key, label, icon: <Icon />, searchText: label };
      }),
    [productTypeKeys, tProductTypes],
  );

  const listboxId = `item-type-listbox-${instanceId}`;
  const selectedLabel = value ? tProductTypes(value) : null;
  const isChip = appearance === "chip";
  const iconNode = value
    ? createElement(getStoreProductTypeIcon(value), { size: 12, "aria-hidden": true, className: "shrink-0" })
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-haspopup={usesSheet ? "dialog" : "listbox"}
        aria-expanded={open}
        aria-controls={open && !usesSheet ? listboxId : undefined}
        aria-label={ariaLabelFor(selectedLabel ?? placeholder)}
        onClick={() => onOpenChange(!open)}
        onKeyDown={onKeyDown}
        className={
          isChip
            ? cn(
                // Same 44px tap target every other control on the review screen uses on a phone,
                // relaxing to the denser desktop geometry once a pointer is doing the aiming.
                "flex min-h-[44px] max-w-full items-center gap-[var(--space-1)] md:min-h-[32px]",
                "rounded-[var(--radius-md)] px-[var(--space-2)] py-[var(--space-1)] [font-size:var(--text-caption)]",
                "[background:var(--surface)]",
                // Longhand, not the `border` shorthand: the shorthand resets `border-color` and
                // wins over the `hover:` variant below, which would leave the hover state dead.
                "[border-width:1px] [border-style:solid] [border-color:var(--border)]",
                "[transition:border-color_var(--motion-fast)_var(--ease-emphasis)]",
                "hover:[border-color:var(--border-strong)]",
                value ? "[color:var(--text-primary)]" : "[color:var(--text-muted)]",
                "focus-visible:[box-shadow:0_0_0_2px_var(--focus-ring)] focus-visible:outline-none",
              )
            : cn(
                "flex w-full items-center gap-1 rounded-[5px] px-1 py-1.5 text-left text-[12px] whitespace-nowrap",
                "focus:outline-none focus:[background:color-mix(in_oklch,var(--accent)_8%,transparent)]",
                selectedLabel ? "[color:var(--text-secondary)]" : "[color:var(--text-muted)]",
              )
        }
      >
        {iconNode}
        <span className={isChip ? "truncate" : "min-w-0 flex-1 truncate"}>{selectedLabel ?? placeholder}</span>
        {isChip ? (
          <ChevronsUpDown size={12} className="shrink-0 [color:var(--text-muted)]" aria-hidden />
        ) : (
          <ChevronDown size={10} className="shrink-0 opacity-50" aria-hidden />
        )}
      </button>

      {usesSheet && (
        <MobilePicker
          open={open}
          onOpenChange={onOpenChange}
          title={tPicker("productTypeTitle")}
          searchPlaceholder={tPicker("productTypeSearch")}
          emptyLabel={tPicker("productTypeEmpty")}
          options={sheetOptions}
          selectedValue={value}
          onSelect={onChange}
        />
      )}

      {!usesSheet && open && coords && (
        <Portal>
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              minWidth: Math.max(coords.minWidth, POPOVER_MIN_WIDTH),
            }}
            className={cn(
              "z-50 flex max-h-80 flex-col overflow-hidden rounded-[10px]",
              "[background:var(--background)] [border:1px_solid_var(--border-strong)]",
              "[box-shadow:var(--shadow-elevation-3)]",
            )}
          >
            <div className="relative flex items-center px-2 py-2 [border-bottom:1px_solid_var(--border)]">
              <Search size={13} aria-hidden className="pointer-events-none absolute left-4 [color:var(--text-muted)]" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    onOpenChange(false);
                  }
                }}
                placeholder={tPicker("productTypeSearch")}
                aria-label={tPicker("productTypeSearch")}
                className={cn(
                  "w-full rounded-[6px] py-1.5 pr-2 pl-7 text-[13px]",
                  "[color:var(--text-primary)] [background:var(--surface)] [border:1px_solid_var(--border)]",
                  "placeholder:[color:var(--text-muted)]",
                  "focus:[border-color:color-mix(in_oklch,var(--accent)_45%,var(--border))] focus:outline-none",
                  "focus:[box-shadow:0_0_0_3px_color-mix(in_oklch,var(--accent)_15%,transparent)]",
                )}
              />
            </div>
            <ul
              id={listboxId}
              role="listbox"
              aria-label={tPicker("productTypeTitle")}
              className="flex-1 overflow-y-auto p-1"
            >
              {filteredKeys.length === 0 ? (
                <li className="px-2 py-2 text-[12px] [color:var(--text-muted)]">{tPicker("productTypeEmpty")}</li>
              ) : (
                filteredKeys.map((key) => {
                  const Icon = getStoreProductTypeIcon(key);
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={value === key}
                        onClick={() => {
                          onChange(key);
                          onOpenChange(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] [color:var(--text-primary)]",
                          value === key
                            ? "[background:color-mix(in_oklch,var(--accent)_10%,transparent)]"
                            : "hover:[background:color-mix(in_oklch,var(--text-primary)_4%,transparent)]",
                        )}
                      >
                        <Icon size={13} aria-hidden className="shrink-0 [color:var(--accent-cool)]" />
                        <span className="min-w-0 flex-1 truncate">{tProductTypes(key)}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </Portal>
      )}
    </>
  );
}
