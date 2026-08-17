"use client";

import { ChevronsUpDown, Plus, PlusCircle, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StoreAvatar from "@/components/core/StoreAvatar";
import { MobilePicker } from "@/components/modules/MobilePicker";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/styles";
import { foldSearchText } from "@/lib/strings/foldSearchText";

export type StoreComboboxOption = {
  id: string;
  name: string;
  /** Store logo. Absent falls back to the monogram, which is what every option used to show. */
  logoUrl?: string | null;
  /** Optional trailing meta (e.g. "PE · PEN" or "3 productos sin entregar"). */
  meta?: string;
  /** Extra tokens folded into search matching. Defaults to the name. */
  searchText?: string;
};

/**
 * `StoreAvatar` takes a discriminated union: a logo is either present with its aspect or the whole
 * key is absent. This keeps that branch in one place instead of at each of the four call sites.
 */
function StoreOptionAvatar({ name, logoUrl, size }: { name: string; logoUrl?: string | null; size: 24 | 32 }) {
  // Branch here rather than building the subject inline: `StoreAvatar` takes a discriminated union
  // (logo present with its aspect, or the key absent), and TypeScript will not distribute a
  // pre-built union across the JSX prop.
  if (logoUrl) {
    return <StoreAvatar store={{ name, logo: { src: logoUrl, aspect: "square" } }} size={size} />;
  }
  return <StoreAvatar store={{ name }} size={size} />;
}

export type StoreComboboxCreateAction = {
  label: string;
  href: string;
  /** When set, shows a "store not found?" helper line below the field. */
  notFoundQuestion?: string;
};

export type StoreComboboxProps = {
  id: string;
  options: StoreComboboxOption[];
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder: string;
  /** Desktop list + mobile sheet empty label. */
  emptyLabel: string;
  mobileTitle: string;
  mobileSearchPlaceholder: string;
  error?: boolean;
  /** Shows a clear (×) button once a value is selected. Default false. */
  clearable?: boolean;
  clearLabel?: string;
  /** Inline "create store" escape hatch in the desktop list + mobile sheet. */
  createAction?: StoreComboboxCreateAction;
  listAriaLabel?: string;
};

/**
 * Canonical store autocomplete shared by the order- and delivery-create flows.
 * Desktop renders a `role="combobox"` with a fold-accent search list; mobile
 * defers to `<MobilePicker>`. Trailing meta and the optional "create store"
 * escape hatch are caller-provided so each flow keeps its own context without a
 * parallel implementation.
 */
export default function StoreCombobox({
  id,
  options,
  value,
  onChange,
  placeholder,
  emptyLabel,
  mobileTitle,
  mobileSearchPlaceholder,
  error,
  clearable = false,
  clearLabel,
  createAction,
  listAriaLabel,
}: StoreComboboxProps) {
  const isMobile = useIsMobile();
  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value]);

  const [sheetOpen, setSheetOpen] = useState(false);

  // Desktop combobox state
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | null>(null);

  const filtered = useMemo(() => {
    if (!open) return [] as StoreComboboxOption[];
    const folded = foldSearchText(query);
    return folded ? options.filter((o) => foldSearchText(o.searchText ?? o.name).includes(folded)) : options;
  }, [open, query, options]);

  const total = filtered.length + (createAction ? 1 : 0);
  const safeActive = useMemo(() => {
    if (total === 0) return -1;
    if (activeIdx < 0) return 0;
    return Math.min(activeIdx, total - 1);
  }, [activeIdx, total]);

  const openCombobox = useCallback(() => {
    setQuery("");
    setActiveIdx(-1);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const closeCombobox = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIdx(-1);
  }, []);

  const handleClear = useCallback(() => {
    onChange(null);
    closeCombobox();
    inputRef.current?.focus();
  }, [onChange, closeCombobox]);

  useEffect(
    () => () => {
      if (blurTimer.current) window.clearTimeout(blurTimer.current);
    },
    [],
  );

  const mobileOptions = useMemo(
    () =>
      options.map((o) => ({
        value: o.id,
        label: o.name,
        description: o.meta,
        avatar: <StoreOptionAvatar name={o.name} logoUrl={o.logoUrl} size={32} />,
        searchText: o.searchText ?? o.name,
      })),
    [options],
  );

  if (isMobile) {
    return (
      <>
        {/*
          This button is the only accessible surface for the field on mobile (it opens the
          picker sheet; there is no separate native input carrying the field's validity
          state), so `aria-invalid` is kept despite the button role not formally supporting
          it in the ARIA spec — it is the sole way to expose the invalid state to assistive
          tech here.
        */}
        <button
          type="button"
          id={id}
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          aria-invalid={error || undefined}
          className={cn(
            "flex h-[2.875rem] w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-left",
            "[background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]",
            error &&
              "[border-color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_5%,var(--surface-elevated))]",
            "focus-visible:[box-shadow:0_0_0_3px_var(--focus-ring)] focus-visible:outline-none",
          )}
        >
          {selected ? (
            <>
              <StoreOptionAvatar name={selected.name} logoUrl={selected.logoUrl} size={24} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium [color:var(--text-primary)]">
                {selected.name}
              </span>
            </>
          ) : (
            <span className="flex-1 text-[14px] [color:var(--text-muted)]">{placeholder}</span>
          )}
          <ChevronsUpDown size={16} className="shrink-0 [color:var(--text-muted)]" aria-hidden />
        </button>

        <MobilePicker
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={mobileTitle}
          searchPlaceholder={mobileSearchPlaceholder}
          emptyLabel={emptyLabel}
          options={mobileOptions}
          selectedValue={value}
          onSelect={(v) => onChange(v)}
          inlineAction={
            createAction
              ? { label: createAction.label, icon: <Plus size={14} aria-hidden />, href: createAction.href }
              : undefined
          }
        />
      </>
    );
  }

  // Desktop combobox
  const renderClosedSelected = Boolean(selected && !open);

  return (
    <div>
      <div className="relative">
        <div
          className={cn(
            "flex h-[2.875rem] w-full items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm transition-colors",
            "[background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]",
            error &&
              "[border-color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_5%,var(--surface-elevated))]",
            "focus-within:[box-shadow:0_0_0_3px_color-mix(in_oklch,var(--accent)_15%,transparent)]",
          )}
        >
          {renderClosedSelected ? (
            <button
              type="button"
              id={id}
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={`${id}-list`}
              onClick={openCombobox}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openCombobox();
                }
              }}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <StoreOptionAvatar name={selected!.name} logoUrl={selected!.logoUrl} size={24} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium [color:var(--text-primary)]">
                {selected!.name}
              </span>
            </button>
          ) : (
            <input
              ref={inputRef}
              id={id}
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-controls={`${id}-list`}
              aria-activedescendant={safeActive >= 0 ? `${id}-opt-${safeActive}` : undefined}
              aria-invalid={error || undefined}
              value={open ? query : ""}
              placeholder={selected ? selected.name : placeholder}
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] [color:var(--text-primary)] placeholder:[color:var(--text-muted)] focus:outline-none"
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                setActiveIdx(-1);
              }}
              onClick={() => setOpen(true)}
              onBlur={() => {
                blurTimer.current = window.setTimeout(() => closeCombobox(), 150);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  if (!open) setOpen(true);
                  else setActiveIdx((p) => (p < 0 ? 0 : (p + 1) % total));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  if (!open) setOpen(true);
                  else setActiveIdx((p) => (p <= 0 ? total - 1 : p - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (createAction && safeActive === filtered.length) {
                    closeCombobox();
                  } else {
                    const opt = filtered[safeActive];
                    if (opt) {
                      onChange(opt.id);
                      closeCombobox();
                    }
                  }
                } else if (e.key === "Escape") {
                  closeCombobox();
                }
              }}
            />
          )}
          {/*
            Trailing cluster — one control, always: the clear and the list toggle are the two arms
            of one ternary, never siblings, so each can take the full 44×44 touch box with nothing
            to collide with. The compact box comes back at `lg`, not at `md`: this whole branch is
            gated on `!isMobile` (≥768px), so its touch band is the 768-1023px tablet range, and
            `lg` is where this repo already assumes a precise pointer (`DELIBERATELY_SMALL` in
            `src/test/tap-target-guard.test.ts`). The negative margin is the wrapper's own `px-3`,
            so the target reaches the field's edge without widening the cluster.
          */}
          {clearable && selected ? (
            <button
              type="button"
              onClick={handleClear}
              aria-label={clearLabel}
              className="-mr-3 grid size-11 shrink-0 place-items-center rounded [color:var(--text-muted)] hover:[color:var(--text-primary)] focus-visible:[box-shadow:0_0_0_2px_var(--focus-ring)] focus-visible:outline-none lg:m-0 lg:size-[17px]"
            >
              <X size={13} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => (open ? closeCombobox() : openCombobox())}
              aria-hidden
              className="-mr-3 grid size-11 shrink-0 place-items-center rounded [color:var(--text-muted)] lg:m-0 lg:size-[19px]"
            >
              <ChevronsUpDown size={15} aria-hidden />
            </button>
          )}
        </div>

        {open && (
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label={listAriaLabel}
            className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-auto rounded-[10px] p-1 [box-shadow:0_8px_24px_color-mix(in_oklch,black_18%,transparent)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
            onMouseDown={(e) => e.preventDefault()}
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-[13px] [color:var(--text-muted)]">{emptyLabel}</li>
            ) : (
              filtered.map((store, idx) => (
                <li key={store.id}>
                  <button
                    id={`${id}-opt-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={safeActive === idx}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => {
                      onChange(store.id);
                      closeCombobox();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] [color:var(--text-primary)]",
                      safeActive === idx
                        ? "[background:color-mix(in_oklch,var(--accent)_10%,transparent)]"
                        : "hover:[background:color-mix(in_oklch,var(--text-primary)_4%,transparent)]",
                    )}
                  >
                    <StoreOptionAvatar name={store.name} logoUrl={store.logoUrl} size={24} />
                    <span className="min-w-0 flex-1 truncate font-medium">{store.name}</span>
                    {store.meta && <span className="shrink-0 text-[11px] [color:var(--text-muted)]">{store.meta}</span>}
                  </button>
                </li>
              ))
            )}
            {createAction && (
              <li className="mx-1 my-1 pt-1 [border-top:1px_solid_var(--border)]">
                <Link
                  id={`${id}-opt-${filtered.length}`}
                  href={createAction.href}
                  role="option"
                  aria-selected={safeActive === filtered.length}
                  onMouseEnter={() => setActiveIdx(filtered.length)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-[13px] font-medium [color:var(--accent)]",
                    safeActive === filtered.length
                      ? "[background:color-mix(in_oklch,var(--accent)_12%,transparent)]"
                      : "hover:[background:color-mix(in_oklch,var(--accent)_8%,transparent)]",
                  )}
                >
                  <PlusCircle size={14} aria-hidden /> {createAction.label}
                </Link>
              </li>
            )}
          </ul>
        )}
      </div>

      {createAction?.notFoundQuestion && !selected && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] [color:var(--text-muted)]">
          <span>{createAction.notFoundQuestion}</span>
          <Link
            href={createAction.href}
            className="inline-flex items-center gap-1 text-[12px] [color:var(--accent)] hover:underline"
          >
            <PlusCircle size={12} aria-hidden /> {createAction.label}
          </Link>
        </p>
      )}
    </div>
  );
}
