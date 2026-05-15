"use client";

import { ArrowLeft, ArrowRight, Check, ChevronRight, ChevronUp, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
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
  /**
   * Where the per-step action buttons render.
   * - `"inline"` (default): inside the step body, below the form content, separated by a top border.
   * - `"sticky-on-mobile"`: inline on `md+` (same as default), but fixed at the bottom of the
   *   viewport on `<md` with `safe-area-inset-bottom` padding. Used for mobile wizards (S7-A.2
   *   `s7-mob-actionbar` pattern). The page is responsible for adding bottom padding so the
   *   content does not sit under the bar (e.g. `pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0`).
   */
  actionsLayout?: "inline" | "sticky-on-mobile";
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
  actionsLayout = "inline",
  className,
}: WizardStepProps) {
  const ctx = useWizardAccordion();
  const generatedId = useId();
  const headingId = `${generatedId}-title`;
  const bodyId = `${generatedId}-body`;
  const bodyRef = useRef<HTMLDivElement>(null);
  // Ref to the mobile sticky primary button so we can briefly pulse it when the
  // user taps inside the step body — surfaces the action bar to first-time users.
  const stickyPrimaryRef = useRef<HTMLButtonElement>(null);
  // Throttle so rapid taps don't restart the pulse every frame.
  const lastPulseRef = useRef(0);
  const triggerStickyPulse = useCallback(() => {
    const btn = stickyPrimaryRef.current;
    if (!btn) return;
    const now = Date.now();
    if (now - lastPulseRef.current < 1200) return;
    lastPulseRef.current = now;
    btn.classList.remove("animate-wizard-pulse");
    // Force reflow so the animation restarts (otherwise classList.add is a no-op).
    void btn.offsetWidth;
    btn.classList.add("animate-wizard-pulse");
  }, []);
  const handleBodyPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (actionsLayout !== "sticky-on-mobile") return;
      // Don't pulse if the user tapped the sticky bar itself (avoids feedback loop).
      if (stickyPrimaryRef.current?.contains(event.target as Node)) return;
      triggerStickyPulse();
    },
    [actionsLayout, triggerStickyPulse],
  );

  const isAllOpen = ctx.layout === "all-open";
  // In all-open layout there is no notion of an active step — every body is visible
  // and the bullet defaults to its neutral "todo" appearance unless explicitly errored.
  const isActive = !isAllOpen && ctx.activeStep === n;
  const isErrored = ctx.erroredSteps.has(n) || (isActive && hasError);
  const isDone = !isAllOpen && ctx.doneSteps.has(n) && !isActive && !isErrored;
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
      : isErrored
        ? "[border:1px_solid_var(--destructive)] [box-shadow:inset_0_0_0_1px_color-mix(in_oklch,var(--destructive)_10%,transparent)]"
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
    // If this step is locked by `gated` mode (future step user hasn't earned
    // yet), nudge them toward the sticky CTA at the bottom of the viewport
    // instead of doing nothing silently.
    if (!ctx.canActivate(n)) {
      ctx.pulseStickyHint();
      return;
    }
    ctx.activate(n);
  };

  // The active step in sticky-on-mobile mode owns the visible bottom CTA.
  // Register `triggerStickyPulse` so that locked-step header clicks (handled
  // in other WizardStep instances) can pulse this button via context.
  useEffect(() => {
    if (!isActive || isAllOpen || actionsLayout !== "sticky-on-mobile") return;
    ctx.registerStickyPulse(triggerStickyPulse);
    return () => ctx.registerStickyPulse(null);
  }, [isActive, isAllOpen, actionsLayout, ctx, triggerStickyPulse]);

  const showBody = isAllOpen || isActive || keepBodyMounted;
  const bodyHidden = !isAllOpen && !isActive;

  // Shared header content (bullet + eyebrow + title) — rendered identically in all
  // three header variants below to keep the visual rhythm consistent.
  const headerInner = (
    <>
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
        {isAllOpen || isActive ? (
          <h3
            id={headingId}
            className="mt-0.5 [font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]"
          >
            {title}
          </h3>
        ) : (
          <span
            id={headingId}
            className="mt-0.5 block [font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]"
          >
            {title}
          </span>
        )}
        {!isAllOpen && summary && state === "done" && (
          <span className="mt-1 block truncate [font-size:var(--text-body)] [color:var(--text-secondary)]">
            {summary}
          </span>
        )}
      </div>
    </>
  );

  return (
    <li className="contents">
      <section id={generatedId} data-wizard-step={n} aria-labelledby={headingId} className={cardClass}>
        {isAllOpen ? (
          // Static anchor header — no toggle, no chevron, no hover affordance.
          <header className="flex items-start gap-3 px-4 pt-4 md:px-5 md:pt-5">{headerInner}</header>
        ) : isActive ? (
          <header className="flex items-start gap-3 px-4 pt-4 md:px-5 md:pt-5">
            {headerInner}
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
            {headerInner}
            <span className="mt-1 flex-shrink-0 [color:var(--text-muted)]" aria-hidden="true">
              <ChevronRight size={16} />
            </span>
          </button>
        )}
        {showBody && (
          <div
            id={bodyId}
            ref={bodyRef}
            hidden={bodyHidden}
            aria-hidden={bodyHidden}
            onPointerDown={handleBodyPointerDown}
            // Mobile: body fills the full width (no left-indent under the bullet) —
            // matches the demo S7 mobile wizard. Desktop: indent so content lines
            // up with the title to the right of the bullet.
            className="flex flex-col gap-4 p-4 md:pt-5 md:pr-5 md:pb-5 md:pl-[3.75rem]"
          >
            {children}
            {/* Per-step primary/secondary buttons only render in wizard layout — in
                all-open the parent owns a single submit footer outside the wizard.
                `actionsLayout="sticky-on-mobile"` hides the inline bar on `<md` and
                renders a parallel fixed-bottom bar (see below). */}
            {!isAllOpen && (primaryAction || secondaryAction) && (
              <div
                className={cn(
                  "flex flex-col-reverse gap-2 pt-4 [border-top:1px_solid_var(--border)] md:flex-row md:items-center md:justify-end md:gap-3",
                  actionsLayout === "sticky-on-mobile" && "hidden md:flex",
                )}
              >
                {secondaryAction && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={handleSecondary}
                    disabled={secondaryAction.disabled}
                    leadingIcon={
                      secondaryAction.leadingIcon === null
                        ? undefined
                        : (secondaryAction.leadingIcon ?? <ArrowLeft size={14} aria-hidden="true" />)
                    }
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
            {/* Mobile sticky action bar (only when `actionsLayout="sticky-on-mobile"`).
                The bar is fixed to the viewport bottom on `<md` and hidden on `md+`. */}
            {!isAllOpen && actionsLayout === "sticky-on-mobile" && (primaryAction || secondaryAction) && (
              <div
                role="group"
                aria-label="Acciones del paso"
                className={cn(
                  "fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 px-4 py-3 md:hidden",
                  "[background:var(--surface-elevated)] [border-top:1px_solid_var(--border)]",
                  "[padding-bottom:calc(0.75rem_+_env(safe-area-inset-bottom))]",
                )}
              >
                {secondaryAction && (
                  <Button
                    variant="ghost"
                    size="md"
                    type="button"
                    onClick={handleSecondary}
                    disabled={secondaryAction.disabled}
                    leadingIcon={
                      secondaryAction.leadingIcon === null
                        ? undefined
                        : (secondaryAction.leadingIcon ?? <ArrowLeft size={14} aria-hidden="true" />)
                    }
                    className="shrink-0"
                    style={{ flex: "0 0 96px" }}
                  >
                    {secondaryAction.label}
                  </Button>
                )}
                {primaryAction && (
                  <Button
                    ref={stickyPrimaryRef}
                    variant="primary"
                    size="md"
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
                    className="flex-1"
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
