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
      <ol className="flex items-center gap-2 overflow-x-auto md:gap-3" role="list">
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
            "inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-colors md:h-8 md:w-8",
            state === "todo" &&
              "[background:var(--surface)] [border:1px_solid_var(--border-strong)] [color:var(--text-muted)]",
            state === "active" &&
              "[background:var(--accent)] [border:1px_solid_var(--accent)] [color:var(--text-on-accent)]",
            state === "done" &&
              "[background:color-mix(in_oklch,var(--success)_18%,var(--surface))] [border:1px_solid_var(--success)] [color:var(--success)]",
          );

          const labelClass = cn(
            "hidden whitespace-nowrap text-xs md:inline",
            state === "active" && "[color:var(--text-primary)] [font-weight:var(--font-weight-semibold)]",
            state !== "active" && "[color:var(--text-secondary)]",
          );

          const connectorClass = cn(
            "h-px flex-1 self-center",
            doneSet.has(step.n) ? "[background:var(--success)]" : "[background:var(--border)]",
          );

          return (
            <li key={step.n} className={cn("flex flex-shrink-0 items-center gap-2 md:gap-3", !isLast && "md:flex-1")}>
              {isClickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(step.n)}
                  aria-current={state === "active" ? "step" : undefined}
                  aria-label={`Step ${step.n}: ${step.label}`}
                  className={cn(
                    "flex items-center gap-2 rounded-full p-0.5",
                    "[outline:none] focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:2px]",
                  )}
                >
                  <span className={bulletClass}>{bulletContent}</span>
                  <span className={labelClass}>{step.label}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2" aria-current={state === "active" ? "step" : undefined}>
                  <span className={bulletClass}>{bulletContent}</span>
                  <span className={labelClass}>{step.label}</span>
                </div>
              )}
              {!isLast && <span aria-hidden="true" className={cn(connectorClass, "hidden md:block")} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
