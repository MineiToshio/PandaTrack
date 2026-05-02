import { cn } from "@/lib/styles";
import type { CSSProperties, ReactNode } from "react";

export type MonoCodeVariant = "identifier" | "inline";
export type MonoCodeSize = "sm" | "md" | "lg";

export type MonoCodeProps = {
  /** Content — typically a dense identifier string like `PT-002418`. */
  children: ReactNode;
  /** Visual variant. `identifier` uses `--text-secondary` (ADR 0007). `inline` uses `--text-muted`. Default `identifier`. */
  variant?: MonoCodeVariant;
  /** Size. Default `md` (13px). `lg` for detail headers; `sm` for captions/chips. */
  size?: MonoCodeSize;
  /** Whether content can be selected/copied. Default `true`. */
  selectable?: boolean;
  /** Semantic HTML tag. Default `code`. Use `span` when content is not code. */
  as?: "code" | "span";
  className?: string;
  style?: CSSProperties;
};

const SIZE_STYLES: Record<MonoCodeSize, CSSProperties> = {
  sm: {
    fontSize: "var(--text-eyebrow)",
    lineHeight: "var(--text-eyebrow--line-height)",
  },
  md: {
    fontSize: "var(--text-mono)",
    lineHeight: "var(--text-mono--line-height)",
    letterSpacing: "var(--text-mono--letter-spacing)",
  },
  lg: {
    fontSize: "var(--text-mono-lg)",
    lineHeight: "var(--text-mono-lg--line-height)",
  },
};

/** Renders dense mono identifiers (PT-002418, delivery-abc123). Default --text-secondary per ADR 0007. */
export default function MonoCode({
  children,
  variant = "identifier",
  size = "md",
  selectable = true,
  as: Tag = "code",
  className,
  style,
}: MonoCodeProps) {
  return (
    <Tag
      className={cn(
        "[font-family:var(--font-mono)] [font-weight:var(--font-weight-mono)]",
        "[font-variant-numeric:tabular-nums] [font-feature-settings:'calt','ss01','tnum']",
        variant === "identifier" ? "[color:var(--text-secondary)]" : "[color:var(--text-muted)]",
        !selectable && "select-none",
        className,
      )}
      style={{ ...SIZE_STYLES[size], ...style }}
    >
      {children}
    </Tag>
  );
}
