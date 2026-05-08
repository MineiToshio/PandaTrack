"use client";

import { ArrowRight, Check, ChevronRight, ChevronUp, X } from "lucide-react";
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
  /** Override the default leading icon. Pass `null` to remove it. */
  leadingIcon?: ReactNode | null;
  /** Override the default trailing icon. Pass `null` to remove it. */
  trailingIcon?: ReactNode | null;
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
  /**
   * Optional pre-advance validator. Called after `primaryAction.onClick` and before auto-advance.
   * Return `false` to block the advance — typically the caller will set local error state to render
   * inline error messages on fields with missing data.
   */
  validate?: () => boolean;
  /** When true, secondary calls `goBack(n)` after running its `onClick`. Default `true`. */
  autoBack?: boolean;
  /**
   * When true (default), the step body stays mounted in the DOM even when collapsed,
   * so any form inputs inside preserve their values across step transitions.
   * The body is still visually hidden via the HTML `hidden` attribute and `aria-hidden`.
   * Set to `false` when the body is heavy and you want to lazy-mount it.
   */
  keepBodyMounted?: boolean;
  /** When true, the collapsed header is not clickable (used for gated wizards). */
  disabled?: boolean;
  /** When true, the step bullet renders with the destructive palette (active step has errors). */
  hasError?: boolean;
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
  validate,
  autoBack = true,
  keepBodyMounted = true,
  disabled = false,
  hasError = false,
  className,
}: WizardStepProps) {
  const ctx = useWizardAccordion();
  const generatedId = useId();
  const headingId = `${generatedId}-title`;
  const bodyId = `${generatedId}-body`;
  const bodyRef = useRef<HTMLDivElement>(null);

  const isActive = ctx.activeStep === n;
  const isErrored = ctx.erroredSteps.has(n) || (isActive && hasError);
  const isDone = ctx.doneSteps.has(n) && !isActive && !isErrored;
  const state: "todo" | "active" | "done" | "errored" = isActive
    ? "active"
    : isDone
      ? "done"
      : isErrored
        ? "errored"
        : "todo";

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
    state === "active" &&
      !isErrored &&
      "[background:var(--accent)] [border:1px_solid_var(--accent)] [color:var(--text-on-accent)]",
    (state === "errored" || (state === "active" && isErrored)) &&
      "[background:color-mix(in_oklch,var(--destructive)_10%,transparent)] [border:1px_solid_var(--destructive)] [color:var(--destructive)]",
    state === "done" &&
      "[background:color-mix(in_oklch,var(--success)_15%,transparent)] [border:1px_solid_var(--success)] [color:var(--success)]",
  );

  const cardClass = cn(
    "[border-radius:var(--radius-xl)]",
    "[background:var(--surface-elevated)]",
    state === "active"
      ? "[border:1px_solid_color-mix(in_oklch,var(--accent)_32%,var(--border-strong))] [box-shadow:0_0_0_3px_color-mix(in_oklch,var(--accent)_10%,transparent)]"
      : "[border:1px_solid_var(--border)] [box-shadow:inset_0_0_0_1px_color-mix(in_oklch,var(--accent)_10%,transparent)]",
    className,
  );

  const handlePrimary = () => {
    if (!primaryAction || primaryAction.disabled || primaryAction.loading) return;
    primaryAction.onClick?.();
    if (validate) {
      const isValid = validate();
      ctx.reportValidation(n, isValid);
      if (!isValid) return;
    }
    if (autoAdvance) ctx.markDoneAndAdvance(n);
  };

  const handleSecondary = () => {
    if (!secondaryAction || secondaryAction.disabled) return;
    secondaryAction.onClick?.();
    if (autoBack) ctx.goBack(n);
  };

  const handleHeaderClick = () => {
    if (isActive || disabled) return;
    ctx.activate(n);
  };

  const showBody = isActive || keepBodyMounted;

  return (
    <li className="contents">
      <section id={generatedId} data-wizard-step={n} aria-labelledby={headingId} className={cardClass}>
        {isActive ? (
          <header className="flex items-start gap-3 px-4 pt-4 md:px-5 md:pt-5">
            <span className={bulletClass}>
              {state === "done" ? (
                <Check size={14} aria-hidden="true" />
              ) : isErrored ? (
                <X size={14} aria-hidden="true" />
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
            <span className="mt-1 flex-shrink-0 [color:var(--text-muted)]" aria-hidden="true">
              <ChevronUp size={16} />
            </span>
          </header>
        ) : (
          <button
            type="button"
            onClick={handleHeaderClick}
            aria-expanded={false}
            aria-controls={bodyId}
            disabled={disabled}
            className={cn(
              "flex w-full items-start gap-3 px-4 py-4 text-left md:px-5 md:py-5",
              "[outline:none] focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:-2px]",
              !disabled && "hover:[background:color-mix(in_oklch,var(--text-primary)_3%,transparent)]",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <span className={bulletClass}>
              {state === "done" ? (
                <Check size={14} aria-hidden="true" />
              ) : isErrored ? (
                <X size={14} aria-hidden="true" />
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
            <span className="mt-1 flex-shrink-0 [color:var(--text-muted)]" aria-hidden="true">
              <ChevronRight size={16} />
            </span>
          </button>
        )}
        {showBody && (
          <div
            id={bodyId}
            ref={bodyRef}
            hidden={!isActive}
            aria-hidden={!isActive}
            className="flex flex-col gap-4 pt-4 pr-4 pb-4 pl-[3.5rem] md:pt-5 md:pr-5 md:pb-5 md:pl-[3.75rem]"
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
                    leadingIcon={primaryAction.leadingIcon ?? undefined}
                    trailingIcon={
                      primaryAction.trailingIcon === null
                        ? undefined
                        : (primaryAction.trailingIcon ?? <ArrowRight size={14} aria-hidden="true" />)
                    }
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
