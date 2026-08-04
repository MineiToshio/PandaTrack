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

/**
 * `stack` puts the label above the value. `row` keeps the label on the left and the value on the
 * right of one line, and keeps that same line when the value becomes a control, so an attribute does
 * not jump around as the screen moves between reading and correcting. The row wraps rather than
 * squeezing when a control needs more width than a narrow viewport can give it.
 */
export type ProvenanceValueLayout = "stack" | "row";

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
  /**
   * Opens the control for a value that was genuinely read, on the caller's say-so.
   *
   * A read value is plain text by default and that default is the point (see below). This exists for
   * one shape only: a single, screen-level, explicitly requested correction mode. It must never be
   * driven per field, because the moment every attribute carries its own edit affordance the screen
   * stops being able to say "exactly these N things need you" with a straight face.
   */
  editing?: boolean;
  layout?: ProvenanceValueLayout;
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
 * property of the screen rather than a convention every caller has to remember. `editing` lifts that
 * for the whole screen at once, on request, and never for one field on its own.
 */
export default function ProvenanceValue({
  id,
  label,
  state,
  readText,
  markerLabel,
  control,
  editing = false,
  layout = "stack",
  hint,
  className,
}: ProvenanceValueProps) {
  const isRow = layout === "row";

  if (state === "read" && !editing) {
    if (isRow) {
      return (
        <div className={cn("flex flex-col gap-[var(--space-1)]", className)}>
          <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-[var(--space-3)] md:min-h-[36px]">
            <span className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{label}</span>
            <p className="min-w-0 [font-size:var(--text-body)] [color:var(--text-primary)]">{readText}</p>
          </div>
          {hint != null && <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{hint}</p>}
        </div>
      );
    }
    return (
      <div className={cn("flex flex-col gap-[var(--space-1)]", className)}>
        <span className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{label}</span>
        <p className="[font-size:var(--text-body)] [color:var(--text-primary)]">{readText}</p>
        {hint != null && <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{hint}</p>}
      </div>
    );
  }

  const isAssumed = state === "assumed";
  // A value that was read carries no marker even while it is open for correction: nothing about it
  // was guessed, and a chip there would count as one more thing to look at.
  const marker =
    state === "read" ? null : (
      <Chip variant="warning" size="sm" icon={isAssumed ? <Sparkles size={12} /> : <CircleHelp size={12} />}>
        {markerLabel}
      </Chip>
    );

  if (isRow) {
    return (
      <div className={cn("flex flex-col gap-[var(--space-1)]", className)}>
        <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-[var(--space-2)] md:min-h-[36px]">
          <label
            htmlFor={id}
            className="flex flex-wrap items-center gap-[var(--space-2)] [font-size:var(--text-caption)] [font-weight:var(--font-weight-medium)] [color:var(--text-primary)]"
          >
            {label}
            {marker}
          </label>
          <div className="min-w-0 flex-1 basis-full sm:[max-width:18rem] sm:basis-auto">{control?.({ id })}</div>
        </div>
        {hint != null && <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{hint}</p>}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-[var(--space-2)]", className)}>
      <label
        htmlFor={id}
        className="flex flex-wrap items-center gap-[var(--space-2)] [font-size:var(--text-caption)] [font-weight:var(--font-weight-medium)] [color:var(--text-primary)]"
      >
        {label}
        {marker}
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
