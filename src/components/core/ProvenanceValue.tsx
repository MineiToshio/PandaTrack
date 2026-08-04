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
  /** Id given to the rendered control, and the target of the label. */
  id: string;
  label: string;
  state: ProvenanceState;
  /**
   * Visible word for the marker, for example "asumido" / "falta". Required for the `assumed` and
   * `missing` states. It is rendered inside the `<label>` rather than beside it, so it becomes part
   * of the control's accessible name: a screen reader announces the provenance with the field
   * instead of as a stray decorative node, and colour is never the only signal (ADR 0006).
   */
  markerLabel?: string;
  /** Renders the field's control, wired to this component's id. */
  control: (props: ProvenanceControlProps) => ReactNode;
  /** Optional supporting line under the value (for example the quoted source phrase). */
  hint?: ReactNode;
  className?: string;
};

/**
 * Renders one attribute of an extracted draft with where its value came from attached to its label.
 *
 * It used to decide editability too: a read value rendered as inert text and only a guess became a
 * control, which was meant to keep the screen reading as a document. In practice that hid the fact
 * that anything could be corrected at all, so the review screen is now a form and this component's
 * remaining job is the one that actually carries `BR-11-02`: a value the model guessed is never
 * allowed to look like one it read. The marker is what makes that structural rather than a
 * convention every caller has to remember.
 */
export default function ProvenanceValue({
  id,
  label,
  state,
  markerLabel,
  control,
  hint,
  className,
}: ProvenanceValueProps) {
  const isAssumed = state === "assumed";

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className="flex flex-wrap items-center gap-[var(--space-2)] text-[13px] font-medium [color:var(--text-secondary)]"
      >
        {label}
        {state !== "read" && (
          <Chip variant="warning" size="sm" icon={isAssumed ? <Sparkles size={12} /> : <CircleHelp size={12} />}>
            {markerLabel}
          </Chip>
        )}
      </label>
      {control({ id })}
      {hint != null && <p className="text-[11.5px] [color:var(--text-muted)]">{hint}</p>}
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
