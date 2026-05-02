import { cn } from "@/lib/styles";
import type { ReactNode } from "react";

export type HelperTextTone = "neutral" | "success";
export type HelperTextAlign = "start" | "end";
export type HelperTextSize = "sm" | "md";

export type HelperTextProps = {
  children: ReactNode;
  /** Required — link to the field via `aria-describedby`. */
  id?: string;
  tone?: HelperTextTone;
  align?: HelperTextAlign;
  size?: HelperTextSize;
  className?: string;
};

export default function HelperText({
  children,
  id,
  tone = "neutral",
  align = "start",
  size = "md",
  className,
}: HelperTextProps) {
  return (
    <p
      id={id}
      className={cn(
        "mt-[var(--space-1)]",
        size === "md"
          ? "[font-size:var(--text-caption)] [line-height:var(--text-caption--line-height)]"
          : "[font-size:calc(var(--text-caption)*0.9)] [line-height:1.3]",
        tone === "neutral" ? "[color:var(--text-muted)]" : "[color:var(--success-chip-text)]",
        align === "end" && "text-right",
        className,
      )}
    >
      {children}
    </p>
  );
}
