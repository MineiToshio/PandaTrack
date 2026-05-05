import { cn } from "@/lib/styles";
import type { ReactNode } from "react";

export type EyebrowSize = "sm" | "md";
export type EyebrowTone = "muted" | "accent";
export type EyebrowTag = "span" | "p" | "h2" | "h3" | "h4" | "legend";

export type EyebrowProps = {
  children: ReactNode;
  size?: EyebrowSize;
  tone?: EyebrowTone;
  as?: EyebrowTag;
  className?: string;
};

export default function Eyebrow({ children, size = "md", tone = "muted", as: Tag = "span", className }: EyebrowProps) {
  return (
    <Tag
      className={cn(
        "[font-family:var(--font-mono)] [font-size:var(--text-eyebrow)]",
        "[line-height:var(--text-eyebrow--line-height)] [letter-spacing:var(--text-eyebrow--letter-spacing)]",
        "[font-weight:var(--font-weight-mono)] uppercase",
        "[font-feature-settings:'calt','ss01']",
        size === "sm" && "[font-size:calc(var(--text-eyebrow)*0.9)]",
        tone === "muted" ? "[color:var(--text-muted)]" : "[color:var(--accent)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
