"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/styles";

export type StepperStep = {
  /** 1-indexed step number. */
  n: number;
  /** Short label (mobile-friendly). */
  label: string;
  /** Optional longer description for desktop. */
  description?: string;
};

export type StepperState = "todo" | "active" | "done";

export type StepperProps = {
  steps: StepperStep[];
  /** Current 1-indexed active step. */
  activeStep: number;
  /** Steps already completed (1-indexed). */
  doneSteps?: number[];
  /** Click on a step bullet — used for free navigation (ADR 0001 D12 OC3). */
  onStepClick?: (n: number) => void;
  /** Localized name for the navigation landmark. */
  ariaLabel?: string;
  className?: string;
};

function getStepState(n: number, activeStep: number, doneSteps: ReadonlySet<number>): StepperState {
  if (n === activeStep) return "active";
  if (doneSteps.has(n)) return "done";
  return "todo";
}

export default function Stepper({
  steps,
  activeStep,
  doneSteps = [],
  onStepClick,
  ariaLabel,
  className,
}: StepperProps) {
  const doneSet = new Set(doneSteps);

  return (
    <nav aria-label={ariaLabel ?? "Steps"} className={cn("w-full", className)}>
      <ol className="flex items-start gap-0 px-1 py-[18px] pb-6" role="list">
        {steps.map((step, index) => {
          const state = getStepState(step.n, activeStep, doneSet);
          const isLast = index === steps.length - 1;
          const isClickable = Boolean(onStepClick);

          const bulletContent =
            state === "done" ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <span className="[font-family:var(--font-mono)] [font-size:0.75rem] [line-height:1] [font-weight:var(--font-weight-semibold)]">
                {step.n}
              </span>
            );

          const bulletClass = cn(
            "inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-colors",
            state === "todo" &&
              "[background:var(--surface-elevated)] [border:1.5px_solid_var(--border-strong)] [color:var(--text-muted)]",
            state === "active" &&
              "[background:var(--accent)] [border:1.5px_solid_var(--accent)] [color:var(--text-on-accent)]",
            state === "active" && "shadow-[0_0_0_4px_color-mix(in_oklch,var(--accent)_18%,transparent)]",
            state === "done" &&
              "[background:var(--success)] [border:1.5px_solid_var(--success)] [color:var(--text-on-accent)]",
          );

          const labelClass = cn(
            "block whitespace-nowrap text-xs",
            state === "active" && "[color:var(--text-primary)] [font-weight:var(--font-weight-semibold)]",
            state === "done" && "[color:var(--text-secondary)]",
            state === "todo" && "[color:var(--text-muted)]",
          );

          // Connector: horizontal line from center of current bullet to center of next.
          // Sits at vertical level of bullet center (top: ~14px = bullet h/2).
          // Drawn as ::after on the inner column, but here implemented as a sibling absolute element.
          const connectorBg = doneSet.has(step.n) ? "[background:var(--success)]" : "[background:var(--border-strong)]";

          const stepInner = (
            <>
              <span className={bulletClass}>{bulletContent}</span>
              <span className={labelClass}>{step.label}</span>
            </>
          );

          return (
            <li
              key={step.n}
              className="relative flex flex-1 flex-col items-center gap-2"
              aria-current={state === "active" ? "step" : undefined}
            >
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute top-[14px] left-1/2 h-[1.5px] w-full -translate-y-1/2",
                    connectorBg,
                  )}
                />
              )}
              {isClickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(step.n)}
                  aria-label={`Step ${step.n}: ${step.label}`}
                  className={cn(
                    "relative z-[1] flex flex-col items-center gap-2 bg-transparent",
                    "[outline:none] focus-visible:rounded-md focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:4px]",
                  )}
                >
                  {stepInner}
                </button>
              ) : (
                <div className="relative z-[1] flex flex-col items-center gap-2">{stepInner}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
