"use client";

import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/styles";

/** The three real stages of one submission, in the order they happen. */
export const INTAKE_PROCESSING_STEPS = ["optimizing", "uploading", "reading"] as const;
export type IntakeProcessingStep = (typeof INTAKE_PROCESSING_STEPS)[number];

export type IntakeProcessingPanelProps = {
  activeStep: IntakeProcessingStep;
};

/**
 * Names the three stages of a submission instead of showing an indeterminate spinner. The wait is
 * three to eight seconds of real work, and a bare spinner over that length reads as a hang rather
 * than as progress.
 */
export default function IntakeProcessingPanel({ activeStep }: IntakeProcessingPanelProps) {
  const t = useTranslations("imageIntake.processing");
  const activeIndex = INTAKE_PROCESSING_STEPS.indexOf(activeStep);

  return (
    <section className="flex flex-col items-center gap-[var(--space-5)] py-[var(--space-10)] text-center">
      <h2 className="[font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">{t("title")}</h2>
      <p className="max-w-sm [font-size:var(--text-body)] [color:var(--text-secondary)]">{t("subtitle")}</p>

      <ol
        aria-label={t("stepsLabel")}
        aria-live="polite"
        className="flex w-full max-w-sm flex-col gap-[var(--space-3)]"
      >
        {INTAKE_PROCESSING_STEPS.map((step, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;
          const stateLabel = isDone ? t("doneLabel") : isActive ? t("activeLabel") : t("pendingLabel");

          return (
            <li
              key={step}
              className={cn(
                "flex items-center gap-[var(--space-3)] rounded-[var(--radius-lg)] px-[var(--space-3)] py-[var(--space-2)] text-left",
                "[font-size:var(--text-body)]",
                isActive ? "[color:var(--text-primary)]" : "[color:var(--text-secondary)]",
              )}
              style={
                isActive ? { background: "color-mix(in oklab, var(--surface-elevated) 100%, transparent)" } : undefined
              }
            >
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: isDone
                    ? "color-mix(in oklch, var(--success) 14%, transparent)"
                    : "color-mix(in oklab, var(--border) 60%, transparent)",
                  color: isDone ? "var(--success)" : "var(--text-muted)",
                }}
              >
                {isDone ? (
                  <Check size={12} />
                ) : isActive ? (
                  <Loader2 size={12} className="animate-spin motion-reduce:animate-none" />
                ) : null}
              </span>
              <span>{t(step)}</span>
              <span className="sr-only">{stateLabel}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
