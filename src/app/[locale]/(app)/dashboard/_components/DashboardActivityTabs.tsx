"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { cn } from "@/lib/styles";

export type DashboardActivityTab = {
  key: string;
  label: string;
  /** Rendered as a badge next to the label. Omitted when zero. */
  count?: number;
  /** Server-rendered pane content. */
  panel: ReactNode;
};

export type DashboardActivityTabsProps = {
  tabs: DashboardActivityTab[];
  tablistLabel: string;
};

/**
 * Pill tab switcher for the activity zone. Implements the WAI-ARIA tabs pattern: a roving
 * `tabindex` with arrow / Home / End keys, and `aria-controls` + `aria-labelledby` wiring both ways.
 * The panes themselves are server-rendered and passed through as children.
 */
export default function DashboardActivityTabs({ tabs, tablistLabel }: DashboardActivityTabsProps) {
  const baseId = useId();
  const [activeKey, setActiveKey] = useState(tabs[0]?.key);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const tabId = (key: string): string => `${baseId}-tab-${key}`;
  const panelId = (key: string): string => `${baseId}-panel-${key}`;

  const selectTab = (key: string) => {
    setActiveKey(key);
    posthog.capture(POSTHOG_EVENTS.DASHBOARD.ACTIVITY_TAB_CHANGED, { tab: key });
  };

  const focusTab = (index: number) => {
    const bounded = (index + tabs.length) % tabs.length;
    tabRefs.current[bounded]?.focus();
    selectTab(tabs[bounded].key);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(tabs.length - 1);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div
        role="tablist"
        aria-label={tablistLabel}
        className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-full p-[3px] [background:color-mix(in_oklab,var(--text-primary)_6%,transparent)]"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={tabId(tab.key)}
              aria-selected={isActive}
              aria-controls={panelId(tab.key)}
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectTab(tab.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 whitespace-nowrap",
                "[font-size:12px] [font-weight:var(--font-weight-medium)] transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
                isActive
                  ? "[color:var(--text-primary)] [box-shadow:var(--shadow-1)] [background:var(--surface)]"
                  : "[color:var(--text-secondary)] hover:[color:var(--text-primary)]",
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className="rounded-full px-1.5 [font-size:10px] [font-weight:var(--font-weight-bold)] [color:var(--warning-chip-text)] tabular-nums [background:color-mix(in_oklch,var(--warning)_18%,transparent)]"
                  aria-hidden="true"
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={panelId(tab.key)}
          aria-labelledby={tabId(tab.key)}
          hidden={tab.key !== activeKey}
          tabIndex={0}
          className={cn("mt-3 flex-1", tab.key !== activeKey && "hidden")}
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
