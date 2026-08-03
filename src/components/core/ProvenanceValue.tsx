import { CircleHelp, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import Chip from "@/components/core/Chip";
import { cn } from "@/lib/styles";

/**
 * How a value reached the screen. `read` was genuinely present in the source, `assumed` was filled
 * in by convention, and `missing` was never found at all.
 */
export type ProvenanceState = "read" | "assumed" | "missing";

/** The provenance wrapper shape this component renders. Structurally matches an extraction `Field<T>`. */
export type ProvenanceField<T> = { value: T | null; source: "read" | "assumed" | null };

export type ProvenanceControlProps = { id: string };

export type ProvenanceValueProps = {
  /** Id given to the rendered control, and the target of the label. Unused in the `read` state. */
  id: string;
  label: string;
  state: ProvenanceState;
  /** Text rendered for a `read` value. Plain, non-focusable, exactly as it was read. */
  readText?: ReactNode;
  /**
   * Visible word for the marker, for example "asumido" / "falta". Required for the `assumed` and
   * `missing` states. It is rendered inside the `<label>` rather than beside it, so it becomes part
   * of the control's accessible name: a screen reader announces the provenance with the field
   * instead of as a stray decorative node, and colour is never the only signal (ADR 0006).
   */
  markerLabel?: string;
  /** Renders the focusable control for an `assumed` or `missing` value, wired to this component's id. */
  control?: (props: ProvenanceControlProps) => ReactNode;
  /** Optional supporting line under the value (for example the quoted source phrase). */
  hint?: ReactNode;
  className?: string;
};

/**
 * Renders one attribute of an extracted draft according to where its value came from.
 *
 * A read value is a plain, non-focusable paragraph: the review screen has to read as a document,
 * not as a form, or the user scrolls past it and accepts whatever was proposed. Only an assumed or
 * a missing value becomes a control, which is what makes "only guesses are editable" a structural
 * property of the screen rather than a convention every caller has to remember.
 */
export default function ProvenanceValue({
  id,
  label,
  state,
  readText,
  markerLabel,
  control,
  hint,
  className,
}: ProvenanceValueProps) {
  if (state === "read") {
    return (
      <div className={cn("flex flex-col gap-[var(--space-1)]", className)}>
        <span className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{label}</span>
        <p className="[font-size:var(--text-body)] [color:var(--text-primary)]">{readText}</p>
        {hint != null && <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{hint}</p>}
      </div>
    );
  }

  const isAssumed = state === "assumed";

  return (
    <div className={cn("flex flex-col gap-[var(--space-2)]", className)}>
      <label
        htmlFor={id}
        className="flex flex-wrap items-center gap-[var(--space-2)] [font-size:var(--text-caption)] [font-weight:var(--font-weight-medium)] [color:var(--text-primary)]"
      >
        {label}
        <Chip variant="warning" size="sm" icon={isAssumed ? <Sparkles size={12} /> : <CircleHelp size={12} />}>
          {markerLabel}
        </Chip>
      </label>
      {control?.({ id })}
      {hint != null && <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{hint}</p>}
    </div>
  );
}

/** Maps an extraction field to the provenance state this component renders. */
export function resolveProvenanceState<T>(field: ProvenanceField<T>): ProvenanceState {
  if (field.value === null || field.source === null) {
    return "missing";
  }
  return field.source === "read" ? "read" : "assumed";
}
