"use client";

import { Check } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import Button from "@/components/core/Button/Button";
import { cn } from "@/lib/styles";
import { useWizardAccordion } from "./WizardContext";

export type WizardStepAction = {
  label: string;
  /**
   * Optional click handler. When omitted:
   *  - `primaryAction` defaults to advancing the wizard via `markDoneAndAdvance(n)`.
   *  - `secondaryAction` defaults to going back via `goBack(n)`.
   * When provided, your handler runs first; if `autoAdvance` (primary) or `autoBack` (secondary) is also enabled,
   * the navigation runs after.
   */
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export type WizardStepProps = {
  /** 1-indexed step number. */
  n: number;
  /** Eyebrow label (mono uppercase). */
  eyebrow: string;
  /** Step title. */
  title: string;
  /** Optional summary shown when step is `done` and collapsed. */
  summary?: string;
  /** Body content. */
  children: ReactNode;
  /** Primary CTA — usually advances the wizard. */
  primaryAction?: WizardStepAction;
  /** Secondary CTA — usually "Back" / "Cancel". */
  secondaryAction?: WizardStepAction;
  /** When true, primary advances using `markDoneAndAdvance(n)`. Default `true`. */
  autoAdvance?: boolean;
  /** When true, secondary calls `goBack(n)` after running its `onClick`. Default `true`. */
  autoBack?: boolean;
  /**
   * When true (default), the step body stays mounted in the DOM even when collapsed,
   * so any form inputs inside preserve their values across step transitions.
   * The body is still visually hidden via the HTML `hidden` attribute and `aria-hidden`.
   * Set to `false` when the body is heavy and you want to lazy-mount it.
   */
  keepBodyMounted?: boolean;
  className?: string;
};

export default function WizardStep({
  n,
  eyebrow,
  title,
  summary,
  children,
  primaryAction,
  secondaryAction,
  autoAdvance = true,
  autoBack = true,
  keepBodyMounted = true,
  className,
}: WizardStepProps) {
  const ctx = useWizardAccordion();
  const generatedId = useId();
  const headingId = `${generatedId}-title`;
  const bodyId = `${generatedId}-body`;
  const bodyRef = useRef<HTMLDivElement>(null);

  const isActive = ctx.activeStep === n;
  const isDone = ctx.doneSteps.has(n) && !isActive;
  const state: "todo" | "active" | "done" = isActive ? "active" : isDone ? "done" : "todo";

  useEffect(() => {
    if (!isActive) return;
    const body = bodyRef.current;
    if (!body) return;
    const focusable = body.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus({ preventScroll: true });
  }, [isActive]);

  const bulletClass = cn(
    "inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full",
    state === "todo" && "[background:var(--surface)] [border:1px_solid_var(--border-strong)] [color:var(--text-muted)]",
    state === "active" && "[background:var(--accent)] [border:1px_solid_var(--accent)] [color:var(--text-on-accent)]",
    state === "done" &&
      "[background:color-mix(in_oklch,var(--success)_18%,var(--surface))] [border:1px_solid_var(--success)] [color:var(--success)]",
  );

  const cardClass = cn(
    "[border-radius:var(--radius-xl)] overflow-hidden",
    "[background:var(--surface-elevated)]",
    state === "active"
      ? "[border:1px_solid_var(--border-strong)] [box-shadow:0_1px_2px_oklch(20%_0.020_50/0.05),0_8px_18px_oklch(20%_0.020_50/0.05)]"
      : "[border:1px_solid_var(--border)]",
    className,
  );

  const handlePrimary = () => {
    if (!primaryAction || primaryAction.disabled || primaryAction.loading) return;
    primaryAction.onClick?.();
    if (autoAdvance) ctx.markDoneAndAdvance(n);
  };

  const handleSecondary = () => {
    if (!secondaryAction || secondaryAction.disabled) return;
    secondaryAction.onClick?.();
    if (autoBack) ctx.goBack(n);
  };

  const handleHeaderClick = () => {
    if (isActive) return;
    ctx.activate(n);
  };

  const showBody = isActive || keepBodyMounted;

  return (
    <li className="contents">
      <section id={generatedId} aria-labelledby={headingId} className={cardClass}>
        {isActive ? (
          <header className="flex items-start gap-3 px-4 pt-4 md:px-5 md:pt-5">
            <span className={bulletClass}>
              {state === "done" ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <span className="text-xs font-semibold">{n}</span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <span className="block [font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] [font-weight:var(--font-weight-mono)] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase">
                {eyebrow}
              </span>
              <h3
                id={headingId}
                className="mt-0.5 [font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]"
              >
                {title}
              </h3>
            </div>
          </header>
        ) : (
          <button
            type="button"
            onClick={handleHeaderClick}
            aria-expanded={false}
            aria-controls={bodyId}
            className={cn(
              "flex w-full items-start gap-3 px-4 py-4 text-left md:px-5 md:py-5",
              "[outline:none] focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:-2px]",
              "hover:[background:color-mix(in_oklch,var(--text-primary)_3%,transparent)]",
            )}
          >
            <span className={bulletClass}>
              {state === "done" ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <span className="text-xs font-semibold">{n}</span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <span className="block [font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] [font-weight:var(--font-weight-mono)] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase">
                {eyebrow}
              </span>
              <span
                id={headingId}
                className="mt-0.5 block [font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]"
              >
                {title}
              </span>
              {summary && state === "done" && (
                <span className="mt-1 block truncate [font-size:var(--text-body)] [color:var(--text-secondary)]">
                  {summary}
                </span>
              )}
            </div>
          </button>
        )}
        {showBody && (
          <div
            id={bodyId}
            ref={bodyRef}
            hidden={!isActive}
            aria-hidden={!isActive}
            className="flex flex-col gap-4 px-4 pt-4 pb-4 md:px-5 md:pt-5 md:pb-5"
          >
            {children}
            {(primaryAction || secondaryAction) && (
              <div className="flex flex-col-reverse gap-2 pt-4 [border-top:1px_solid_var(--border)] md:flex-row md:items-center md:justify-end md:gap-3">
                {secondaryAction && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={handleSecondary}
                    disabled={secondaryAction.disabled}
                    fullWidth
                    className="md:w-auto"
                  >
                    {secondaryAction.label}
                  </Button>
                )}
                {primaryAction && (
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    onClick={handlePrimary}
                    loading={primaryAction.loading}
                    disabled={primaryAction.disabled}
                    fullWidth
                    className="md:w-auto"
                  >
                    {primaryAction.label}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </li>
  );
}
