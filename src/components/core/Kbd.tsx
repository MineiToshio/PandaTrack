import { cn } from "@/lib/styles";

export type KbdSize = "sm" | "md";

export type KbdProps = {
  /** Array of key strings rendered as individual key boxes joined by "+". */
  keys: string[];
  size?: KbdSize;
  /** Accessible label — required when keys contain symbols (e.g. "⌘", "⇧"). */
  label?: string;
  className?: string;
};

export default function Kbd({ keys, size = "md", label, className }: KbdProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center",
        "[font-family:var(--font-mono)] [font-weight:var(--font-weight-mono)]",
        "[font-size:var(--text-eyebrow)] [color:var(--text-muted)]",
        size === "sm" && "gap-0.5",
        size === "md" && "gap-1",
        className,
      )}
      aria-label={label}
    >
      {keys.flatMap((key, index) => {
        const items = [];
        if (index > 0) {
          items.push(
            <span key={`sep-${index}`} aria-hidden="true" className="px-0.5 [color:var(--text-muted)]">
              +
            </span>,
          );
        }
        items.push(
          <kbd
            key={`${key}-${index}`}
            className={cn(
              "inline-flex items-center justify-center",
              "[border-radius:var(--radius-sm)] [border:1px_solid_var(--border)]",
              "[background:color-mix(in_oklch,var(--text-primary)_6%,var(--surface))]",
              "min-h-[1.125rem]",
              size === "md" ? "px-1.5 py-0.5" : "px-1 py-px",
            )}
          >
            {key}
          </kbd>,
        );
        return items;
      })}
    </span>
  );
}
