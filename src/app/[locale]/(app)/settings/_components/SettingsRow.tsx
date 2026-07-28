import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

export type SettingsRowProps = {
  label: ReactNode;
  value?: ReactNode;
  actions?: ReactNode;
  /** Renders the value cell across the full width below the label. Use for category chips, etc. */
  fullWidthValue?: boolean;
  /**
   * Vertical alignment of the row cells on `md+`. `"center"` (default) centers the label against
   * the whole value cell. `"control"` top-aligns the row but keeps the label centered against the
   * first control's height, so the label does not drift when the value cell grows taller (e.g. a
   * select that reveals confirm buttons below it).
   */
  align?: "center" | "control";
  className?: string;
};

/** Height of a standard control (Input / SearchableSelect), so the label can band with it. */
const CONTROL_HEIGHT_CLASS = "md:min-h-[2.875rem]";

export default function SettingsRow({
  label,
  value,
  actions,
  fullWidthValue = false,
  align = "center",
  className,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "grid gap-1.5 py-3.5 [border-bottom:1px_solid_var(--border)] last:[border-bottom:0]",
        "md:grid-cols-[180px_1fr_auto] md:gap-4",
        align === "control" ? "md:items-start" : "md:items-center",
        className,
      )}
    >
      <div
        className={cn(
          "text-[13.5px] [color:var(--text-secondary)]",
          align === "control" && ["md:flex md:items-center", CONTROL_HEIGHT_CLASS],
        )}
      >
        {label}
      </div>
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
