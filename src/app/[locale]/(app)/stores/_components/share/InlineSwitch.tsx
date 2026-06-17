"use client";

import { cn } from "@/lib/styles";

type InlineSwitchProps = {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
};

/**
 * Compact `[switch] [label]` toggle used in the store wizard.
 * Matches the demo's `.switch` glyph (38×22 track, 18×18 thumb, accent-on track when active).
 */
export default function InlineSwitch({ label, checked, onChange }: InlineSwitchProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-[22px] w-[38px] flex-shrink-0 rounded-full transition-colors",
          "focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:2px]",
          checked ? "[background:var(--accent)]" : "[background:var(--border-strong)]",
        )}
      >
        <span
          aria-hidden="true"
          style={{ transform: checked ? "translateX(16px)" : undefined }}
          className="absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full [box-shadow:0_1px_3px_rgba(0,0,0,0.15)] transition-transform [background:var(--surface)]"
        />
      </button>
      <span className="[font-size:13.5px] [color:var(--text-primary)]">{label}</span>
    </label>
  );
}
