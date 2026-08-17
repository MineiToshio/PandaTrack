"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/styles";
import { getPosthogDataAttributes } from "@/lib/analytics/posthogDataAttributes";

type ThemeToggleProps = {
  className?: string;
  posthogEvent?: string;
  posthogProps?: Record<string, unknown>;
};

/**
 * Segmented theme toggle. Visual contract: see the Velvet design system at `docs/design/` (`components.md`).
 * Two pill-shaped buttons (light + dark) inside a rounded container; the active mode is highlighted
 * via `aria-pressed` + accent tint background.
 *
 * Sizing is breakpoint-driven, and deliberately so. A segmented control cannot reach the 44×44 touch
 * floor with the `::before` hit-area recipe: the two segments sit 2px apart, each would need 9px of
 * outward expansion, and the later one in the DOM would swallow the earlier one. So the SEGMENT
 * itself is 44×44 below `md` and drops to the compact 26px only from `md` up, where the pointer is
 * precise. Same breakpoint the rest of the repo drops its `::before` expansions at (`md:before:inset-0`).
 */
export default function ThemeToggle({ className, posthogEvent, posthogProps }: ThemeToggleProps) {
  const t = useTranslations("common.themeToggle");
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const renderButton = (mode: "light" | "dark") => {
    const isPressed = (mode === "dark" && isDark) || (mode === "light" && !isDark);
    const Icon = mode === "light" ? Sun : Moon;
    const label = mode === "light" ? t("switchToLight") : t("switchToDark");
    const dataAttrs = getPosthogDataAttributes(posthogEvent, { ...posthogProps, theme: mode });
    return (
      <button
        key={mode}
        type="button"
        aria-pressed={isPressed}
        aria-label={label}
        onClick={() => setTheme(mode)}
        className={cn(
          "inline-grid h-11 w-11 place-items-center rounded-full transition-colors",
          "md:h-[26px] md:w-[26px]",
          "[outline:none] focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:2px]",
          isPressed
            ? "[color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_14%,transparent)]"
            : "[color:var(--text-muted)] hover:[color:var(--text-primary)]",
        )}
        {...dataAttrs}
      >
        <Icon className="size-4 md:size-[13px]" aria-hidden="true" />
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn(
        "inline-flex gap-0.5 rounded-full p-0.5",
        "[background:var(--surface-elevated)] [border:1px_solid_var(--border)]",
        className,
      )}
    >
      {renderButton("light")}
      {renderButton("dark")}
    </div>
  );
}
