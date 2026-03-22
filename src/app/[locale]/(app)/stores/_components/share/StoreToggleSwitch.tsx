"use client";

import { cn } from "@/lib/styles";

type StoreToggleSwitchProps = {
  label: string;
  checked: boolean;
  onChange: (nextValue: boolean) => void;
  name?: string;
  valueWhenChecked?: string;
  className?: string;
};

export default function StoreToggleSwitch({
  label,
  checked,
  onChange,
  name,
  valueWhenChecked = "on",
  className,
}: StoreToggleSwitchProps) {
  return (
    <>
      {name && checked ? <input type="hidden" name={name} value={valueWhenChecked} /> : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "border-border bg-background focus-visible:ring-ring flex min-h-11 cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          checked && "border-primary",
          className,
        )}
      >
        <span className="text-text-title text-sm">{label}</span>
        <span
          className={cn("bg-muted relative h-6 w-10 rounded-full transition-colors", checked && "bg-primary/35")}
          aria-hidden
        >
          <span
            className={cn(
              "bg-background absolute top-0.5 left-0.5 h-5 w-5 rounded-full transition-transform",
              checked && "bg-primary translate-x-4",
            )}
          />
        </span>
      </button>
    </>
  );
}
