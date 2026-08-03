import { cn } from "@/lib/styles";
import { useTranslations } from "next-intl";
import type { LabelHTMLAttributes, ReactNode } from "react";

// "xs" and "2xs" kept for backward compatibility with legacy consumers; they render as "sm".
export type LabelSize = "sm" | "md" | "xs" | "2xs" | "lg";

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  children: ReactNode;
  /** Marks field as required — renders an asterisk in --accent. */
  required?: boolean;
  /** Marks field as optional — renders "(opcional / optional)" text in --text-muted. */
  optional?: boolean;
  /** Visually dims label when the associated control is disabled. No opacity (ADR 0001 D3). */
  disabled?: boolean;
  size?: LabelSize;
  // Legacy props kept for backward compatibility — silently accepted, no visual effect.
  color?: string;
  spacing?: string;
};

export default function Label({
  children,
  required,
  optional,
  disabled,
  size = "md",
  className,
  color: _color,
  spacing: _spacing,
  ...rest
}: LabelProps) {
  const t = useTranslations("components.label");

  return (
    <label
      className={cn(
        "[font-family:var(--font-sans)] [font-weight:var(--font-weight-medium)]",
        "mb-[var(--space-2)] block",
        size === "md" || size === "lg"
          ? "[font-size:var(--text-body)] [line-height:var(--text-body--line-height)]"
          : "[font-size:var(--text-caption)] [line-height:var(--text-caption--line-height)]",
        disabled ? "[color:var(--text-muted)]" : "[color:var(--text-primary)]",
        className,
      )}
      {...rest}
    >
      {children}
      {required && (
        <span className="ml-[var(--space-0_5)] [color:var(--accent)]" aria-hidden="true">
          *
        </span>
      )}
      {optional && !required && (
        <span className="ml-[var(--space-1)] [color:var(--text-muted)]" aria-hidden="true">
          ({t("optional")})
        </span>
      )}
    </label>
  );
}
