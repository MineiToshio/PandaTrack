"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";
import Select from "@/components/core/Select";
import { PAGE_SIZE_OPTIONS } from "@/lib/constants";

export type PerPageSelectProps = {
  /** Current page size (one of `PAGE_SIZE_OPTIONS`). */
  value: number;
  /** Visible label, e.g. "Por página". Also becomes the Select's accessible name via `<label for>`. */
  label: string;
  /** Pre-built destination href per `PAGE_SIZE_OPTIONS` entry — URL construction stays on the
   *  server (mirrors `createPageHref`), this component only picks the href for the chosen size. */
  hrefBySize: Record<number, string>;
  /** Stores routes the change through its transition-backed skeleton instead of a plain push. */
  onNavigate?: (href: string) => void;
};

const PAGE_SIZE_SELECT_OPTIONS = PAGE_SIZE_OPTIONS.map((size) => ({
  value: String(size),
  label: String(size),
}));

/**
 * Desktop-only page-size control paired with `ListPagination`'s numbered nav (canonical L062
 * desktop row). Changing the size navigates to the pre-built href for that size, which always
 * resets to page 1 (the caller's `hrefBySize` builder is responsible for that).
 */
export default function PerPageSelect({ value, label, hrefBySize, onNavigate }: PerPageSelectProps) {
  const router = useRouter();
  const selectId = useId();

  function handleChange(nextValue: string) {
    const size = Number.parseInt(nextValue, 10);
    const href = hrefBySize[size];
    if (!href) return;
    if (onNavigate) {
      onNavigate(href);
      return;
    }
    router.push(href);
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={selectId} className="[font-size:var(--text-caption)] whitespace-nowrap [color:var(--text-muted)]">
        {label}
      </label>
      <Select
        id={selectId}
        value={String(value)}
        onChange={handleChange}
        options={PAGE_SIZE_SELECT_OPTIONS}
        size="sm"
        className="w-[4.5rem]"
      />
    </div>
  );
}
