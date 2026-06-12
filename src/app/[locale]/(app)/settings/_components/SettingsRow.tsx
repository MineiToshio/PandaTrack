import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

export type SettingsRowProps = {
  label: ReactNode;
  value?: ReactNode;
  actions?: ReactNode;
  /** Renders the value cell across the full width below the label. Use for category chips, etc. */
  fullWidthValue?: boolean;
  className?: string;
};

export default function SettingsRow({ label, value, actions, fullWidthValue = false, className }: SettingsRowProps) {
  return (
    <div
      className={cn(
        "grid gap-1.5 py-3.5 [border-bottom:1px_solid_var(--border)] last:[border-bottom:0]",
        "md:grid-cols-[180px_1fr_auto] md:items-center md:gap-4",
        className,
      )}
    >
      <div className="text-[13.5px] [color:var(--text-secondary)]">{label}</div>
      {value !== undefined ? (
        <div
          className={cn(
            "text-[14.5px] [font-weight:var(--font-weight-medium)] [color:var(--text-primary)]",
            fullWidthValue && "md:col-span-2",
          )}
        >
          {value}
        </div>
      ) : (
        <div />
      )}
      {actions !== undefined && !fullWidthValue ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
