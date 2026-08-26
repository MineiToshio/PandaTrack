"use client";

import Link from "next/link";
import { cn } from "@/lib/styles";

export type TabsItem = {
  value: string;
  label: string;
  /**
   * Destination when the tab IS a route rather than a panel toggle. Present on every item or on
   * none: a bar that mixed both would give two different affordances the same appearance.
   */
  href?: string;
};

/**
 * `segmented` is the pill group (a control that switches a panel in place). `underline` is the
 * in-page subnav recipe: a rule under the bar, the active tab marked by an accent underline plus
 * accent text. Underline is the treatment for a tab bar whose tabs are separate URLs.
 */
export type TabsVariant = "segmented" | "underline";

type TabsProps = {
  items: TabsItem[];
  value: string;
  /**
   * Called with the selected tab. For `segmented` it is what switches the panel; for a bar of
   * links the navigation happens on its own and this is only a notification, which is what lets a
   * caller report the selection without wrapping the bar in a click-delegating container.
   */
  onChange?: (value: string) => void;
  ariaLabel: string;
  variant?: TabsVariant;
  /**
   * `id` of the region the bar swaps, when the caller renders one.
   *
   * Required for `aria-controls` to be emitted at all: a tab that points at an id nothing renders
   * is a dangling reference, which reads worse to assistive technology than no reference. Callers
   * that swap a single region (a route subnav, where the panel is the page body) pass one stable
   * id for the whole bar; a caller with one element per tab passes none and labels its own panels.
   */
  panelId?: string;
  className?: string;
};

const CONTAINER_CLASSNAMES: Record<TabsVariant, string> = {
  segmented: "bg-muted/45 inline-flex w-full flex-wrap gap-1 rounded-2xl p-1",
  underline: "border-border flex w-full items-stretch gap-[var(--space-4)] overflow-x-auto border-b",
};

const ITEM_BASE_CLASSNAMES: Record<TabsVariant, string> = {
  segmented:
    "inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 py-2.5 text-base font-semibold transition-all sm:text-[1.0625rem]",
  underline: cn(
    "-mb-px inline-flex min-h-11 items-center justify-center border-b-2 whitespace-nowrap transition-colors",
    "px-[var(--space-2)] py-[var(--space-2)] [font-size:var(--text-caption)] [font-weight:var(--font-weight-semibold)]",
  ),
};

const ITEM_STATE_CLASSNAMES: Record<TabsVariant, { selected: string; idle: string }> = {
  segmented: {
    selected: "bg-background text-text-title shadow-sm",
    idle: "text-text-muted hover:bg-background/55 hover:text-foreground",
  },
  underline: {
    selected: "border-accent text-accent",
    idle: "text-text-secondary hover:text-foreground border-transparent",
  },
};

const FOCUS_CLASSNAMES =
  "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

/**
 * Tabbed navigation within a page, in two recipes.
 *
 * When the items carry an `href` each tab is a real link, not a button that calls `router.push`:
 * a tab that is its own URL has to survive a middle click, a bookmark and a back button, and only
 * an anchor gives all three for free. The ARIA roles stay the same either way, so the bar reads as
 * one tab list regardless of which recipe renders it.
 *
 * NEITHER recipe does roving tabindex, deliberately. A roving `tabIndex` is only half a pattern:
 * it is usable exclusively alongside arrow-key handling that moves focus to the items `Tab` no
 * longer reaches. This component never had that handler, so the `tabIndex={selected ? 0 : -1}` it
 * used to carry took two thirds of the bar out of the keyboard's reach and gave nothing back.
 * Every item stays in the tab order until the arrow handler exists; `SettingsNav` is the local
 * reference for the complete pattern, handler included.
 */
export default function Tabs({
  items,
  value,
  onChange,
  ariaLabel,
  variant = "segmented",
  panelId,
  className,
}: TabsProps) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn(CONTAINER_CLASSNAMES[variant], className)}>
      {items.map((item) => {
        const isSelected = item.value === value;
        const classes = cn(
          ITEM_BASE_CLASSNAMES[variant],
          FOCUS_CLASSNAMES,
          isSelected ? ITEM_STATE_CLASSNAMES[variant].selected : ITEM_STATE_CLASSNAMES[variant].idle,
        );

        const shared = {
          id: `tab-${item.value}`,
          role: "tab" as const,
          "aria-selected": isSelected,
          // Emitted only against a region the caller actually renders. Left undefined otherwise,
          // because a reference to an id nowhere in the document is a broken promise, not a hint.
          "aria-controls": panelId,
          className: classes,
        };

        if (item.href) {
          return (
            <Link
              key={item.value}
              href={item.href}
              aria-current={isSelected ? "page" : undefined}
              onClick={() => onChange?.(item.value)}
              {...shared}
            >
              {item.label}
            </Link>
          );
        }

        return (
          <button key={item.value} type="button" onClick={() => onChange?.(item.value)} {...shared}>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
