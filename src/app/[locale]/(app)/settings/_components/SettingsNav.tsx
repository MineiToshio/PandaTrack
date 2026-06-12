"use client";

import { Lock, SlidersHorizontal, User, type LucideIcon } from "lucide-react";
import { useCallback, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/styles";

export type SettingsTab = "profile" | "account" | "preferences";

export type SettingsNavLabels = {
  profile: string;
  account: string;
  preferences: string;
  preferencesShort: string;
  ariaLabel: string;
};

export type SettingsNavProps = {
  value: SettingsTab;
  onChange: (tab: SettingsTab) => void;
  labels: SettingsNavLabels;
  /** Stable id base for `aria-controls` / `aria-labelledby` wiring with the pane. */
  panelIdBase?: string;
};

const TAB_ORDER: readonly SettingsTab[] = ["profile", "account", "preferences"];

const TAB_ICONS: Record<SettingsTab, LucideIcon> = {
  profile: User,
  account: Lock,
  preferences: SlidersHorizontal,
};

function resolveDesktopLabel(tab: SettingsTab, labels: SettingsNavLabels): string {
  switch (tab) {
    case "profile":
      return labels.profile;
    case "account":
      return labels.account;
    case "preferences":
      return labels.preferences;
  }
}

function resolveMobileLabel(tab: SettingsTab, labels: SettingsNavLabels): string {
  switch (tab) {
    case "profile":
      return labels.profile;
    case "account":
      return labels.account;
    case "preferences":
      return labels.preferencesShort;
  }
}

export default function SettingsNav({ value, onChange, labels, panelIdBase = "settings-pane" }: SettingsNavProps) {
  const desktopRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mobileRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, orientation: "vertical" | "horizontal") => {
      const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
      const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
      if (event.key !== nextKey && event.key !== prevKey && event.key !== "Home" && event.key !== "End") {
        return;
      }
      event.preventDefault();
      const currentIndex = TAB_ORDER.indexOf(value);
      let nextIndex = currentIndex;
      if (event.key === nextKey) nextIndex = (currentIndex + 1) % TAB_ORDER.length;
      if (event.key === prevKey) nextIndex = (currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = TAB_ORDER.length - 1;
      const nextTab = TAB_ORDER[nextIndex];
      onChange(nextTab);
      const refs = orientation === "vertical" ? desktopRefs.current : mobileRefs.current;
      refs[nextIndex]?.focus();
    },
    [onChange, value],
  );

  return (
    <>
      <nav
        aria-label={labels.ariaLabel}
        role="tablist"
        aria-orientation="vertical"
        className="hidden flex-col gap-1 lg:flex"
      >
        {TAB_ORDER.map((tab, index) => {
          const Icon = TAB_ICONS[tab];
          const active = tab === value;
          return (
            <button
              key={tab}
              ref={(node) => {
                desktopRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`${panelIdBase}-${tab}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab)}
              onKeyDown={(event) => handleKeyDown(event, "vertical")}
              className={cn(
                "flex items-center gap-2.5 rounded-[var(--radius-md)]",
                "px-3.5 py-2.5 text-left text-[14px] [font-weight:var(--font-weight-regular)]",
                "[color:var(--text-secondary)] transition-colors",
                "hover:[color:var(--text-primary)] hover:[background:color-mix(in_oklch,var(--text-primary)_4%,transparent)]",
                "focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:-2px]",
                active
                  ? [
                      "[border-left:2px_solid_var(--accent)]",
                      "[background:color-mix(in_oklch,var(--accent)_10%,transparent)]",
                      "[color:var(--accent)]",
                      "[font-weight:var(--font-weight-medium)]",
                    ]
                  : "[border-left:2px_solid_transparent]",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {resolveDesktopLabel(tab, labels)}
            </button>
          );
        })}
      </nav>

      <div
        className={cn(
          "sticky top-[var(--app-topbar-h,48px)] z-[5] -mx-4 md:-mx-6 lg:hidden",
          "px-4 py-2 md:px-6",
          "[background:var(--surface)] [border-bottom:1px_solid_var(--border)]",
        )}
      >
        <div
          role="tablist"
          aria-label={labels.ariaLabel}
          aria-orientation="horizontal"
          className={cn(
            "flex gap-[3px] rounded-[10px] p-[3px]",
            "[background:var(--surface-elevated)] [border:1px_solid_var(--border)]",
          )}
        >
          {TAB_ORDER.map((tab, index) => {
            const Icon = TAB_ICONS[tab];
            const active = tab === value;
            return (
              <button
                key={tab}
                ref={(node) => {
                  mobileRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`${panelIdBase}-${tab}`}
                tabIndex={active ? 0 : -1}
                onClick={() => onChange(tab)}
                onKeyDown={(event) => handleKeyDown(event, "horizontal")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-[7px] px-2 py-[7px] whitespace-nowrap",
                  "text-[12.5px] [font-weight:var(--font-weight-medium)] [color:var(--text-secondary)]",
                  "transition-colors",
                  "focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:-2px]",
                  active && [
                    "[background:color-mix(in_oklch,var(--accent)_12%,var(--surface))]",
                    "[color:var(--accent)]",
                    "[box-shadow:0_1px_3px_color-mix(in_oklch,var(--text-primary)_10%,transparent)]",
                  ],
                )}
              >
                <Icon className="size-[13px] shrink-0" aria-hidden="true" />
                {resolveMobileLabel(tab, labels)}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
