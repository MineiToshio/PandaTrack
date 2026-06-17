import { Clock3 } from "lucide-react";
import { cn } from "@/lib/styles";

export type CooldownChipProps = {
  /** Localized label shown inside the chip. Empty string hides the chip. */
  label: string;
  /** Optional emphasized fragment rendered after the label (e.g. "5 días" or a date). */
  emphasis?: string;
  className?: string;
};

export default function CooldownChip({ label, emphasis, className }: CooldownChipProps) {
  if (!label) return null;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]",
        "[font-weight:var(--font-weight-medium)] [color:var(--warning)]",
        "[background:color-mix(in_oklch,var(--warning)_12%,transparent)]",
        "[border:1px_solid_color-mix(in_oklch,var(--warning)_24%,transparent)]",
        className,
      )}
    >
      <Clock3 className="size-[11px] shrink-0" aria-hidden="true" />
      <span>
        {label}
        {emphasis ? (
          <>
            {" "}
            <strong className="[font-weight:var(--font-weight-semibold)]">{emphasis}</strong>
          </>
        ) : null}
      </span>
    </span>
  );
}
