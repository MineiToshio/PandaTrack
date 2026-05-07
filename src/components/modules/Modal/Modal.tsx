"use client";

import { X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, type ReactElement, type ReactNode } from "react";
import Button from "@/components/core/Button/Button";
import IconButton from "@/components/core/IconButton";
import Portal from "@/components/core/Portal";
import { cn } from "@/lib/styles";
import { FOCUS_OPTIONS_NO_SCROLL, getFocusableElements } from "@/lib/a11y/focusable";

export type ModalRole = "dialog" | "alertdialog";

export type ModalTone = "default" | "destructive" | "warning" | "info";
export type ModalSize = "md" | "lg";

export type ModalAction = {
  label: string;
  onClick: () => void;
  /** Only meaningful for `primaryAction`. Defaults to `primary`. */
  variant?: "primary" | "destructive";
  loading?: boolean;
  disabled?: boolean;
};

export type ModalProps = {
  /** Visible state. */
  isOpen: boolean;
  /** Called when the modal must close (Esc, backdrop click, close button, programmatic). */
  onClose: () => void;
  /** Title — required for accessibility. */
  title: string;
  /**
   * Optional secondary line under the title (semantic-depth subtitle).
   * Replaces the legacy `description` prop in the new visual treatment.
   */
  subtitle?: string | ReactNode;
  /** Backward-compatible alias for `subtitle` for existing consumers. */
  description?: string | ReactNode;
  /** Body content. */
  children?: ReactNode;
  /**
   * Optional Lucide icon rendered inside a tonal icon-circle (48px) at the start of the header.
   * Pair with `tone` to choose semantic color. Without an icon, the header collapses to title + close.
   */
  icon?: ReactElement;
  /** Semantic tone for the icon-circle. Default `default` (accent). */
  tone?: ModalTone;
  /** Width preset: `md` (460px) | `lg` (768px). Default `md`. */
  size?: ModalSize;
  /** Primary CTA in the footer. */
  primaryAction?: ModalAction;
  /** Secondary CTA in the footer (aligned to the left of primary). */
  secondaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  /** Tertiary CTA placed on the far left of the footer (e.g. "Back"). */
  tertiaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  /** ARIA role: `dialog` | `alertdialog`. Default `dialog`. */
  role?: ModalRole;
  /**
   * When false, disables Esc + backdrop click + close button.
   * Default `true`. Backward-compatible alias `closeOnBackdropClick` keeps prior behavior.
   */
  dismissible?: boolean;
  /** @deprecated Use `dismissible`. Backward-compat. */
  closeOnBackdropClick?: boolean;
  /** Initial focus override. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Return focus override. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** Optional class on the modal panel. */
  className?: string;
  /** Optional class on the scrollable body. */
  bodyClassName?: string;
  /** Optional id on the title node (for aria-labelledby). */
  titleId?: string;
  /** Optional id on the subtitle node. */
  descriptionId?: string;
  /** Accessible label for the close button. Default "Close". */
  closeButtonLabel?: string;
};

const TONE_ICON_CLASSES: Record<ModalTone, string> = {
  default: "[background:color-mix(in_oklch,var(--accent)_14%,var(--surface-elevated))] [color:var(--accent)]",
  destructive:
    "[background:color-mix(in_oklch,var(--destructive)_14%,var(--surface-elevated))] [color:var(--destructive)]",
  warning: "[background:color-mix(in_oklch,var(--warning)_14%,var(--surface-elevated))] [color:var(--warning)]",
  info: "[background:color-mix(in_oklch,var(--info)_14%,var(--surface-elevated))] [color:var(--info)]",
};

/** CSS custom property name for each tone — used for inline gradient/ring styles. */
const TONE_COLOR_VAR: Record<ModalTone, string> = {
  default: "var(--accent)",
  destructive: "var(--destructive)",
  warning: "var(--warning)",
  info: "var(--info)",
};

const SIZE_MAX_WIDTH: Record<ModalSize, string> = {
  md: "460px",
  lg: "768px",
};

/**
 * # Modal — canonical component (ADR 0008 · Semantic Depth)
 *
 * **THIS IS THE ONLY MODAL COMPONENT IN THE APP.** Any confirm dialog,
 * destructive prompt, info overlay, form-in-modal, or decision overlay
 * across PandaTrack MUST consume this component. Do not create new modal
 * components. Do not roll a dialog from scratch with a portal + div.
 * Do not copy the visual from legacy modals you may find in the demo
 * HTML — those have been mapped to this same canonical pattern.
 *
 * If you need behavior this component does not yet support, extend it
 * here (add a prop, a tone, a size) — do not fork it.
 *
 * ## Visual contract (Semantic Depth)
 * - Backdrop `blur(8px)` with light/dark calibrated tints.
 * - Icon-circle 48px tonal (default `--accent`, destructive, warning, info).
 * - Border-radius 20px (`--radius-2xl`), footer with `border-top`.
 * - Spring enter (`280ms linear stops`) + opacity exit fast.
 * - `prefers-reduced-motion` → fade only, no scale.
 * - Focus trap, Esc to close, backdrop click to close (when `dismissible`).
 *
 * ## API summary
 * - Required: `isOpen`, `onClose`, `title`.
 * - Visual: `icon` + `tone` (header), `size` (`md` 460px / `lg` 768px),
 *   `subtitle` (or legacy `description`).
 * - Actions: `primaryAction`, `secondaryAction`, `tertiaryAction`.
 * - Behavior: `dismissible` (default `true`), `role` (`dialog` | `alertdialog`).
 * - Backward-compat aliases preserved: `description`, `closeOnBackdropClick`,
 *   `closeButtonLabel`.
 *
 * ## When to use which `tone`
 * - `default` — informational, neutral confirm, form modal.
 * - `destructive` — irreversible action (delete, cancel order, remove store).
 * - `warning` — caution / non-destructive but sensitive (report, flag, dispute).
 * - `info` — explanatory / decision with multiple non-destructive paths.
 *
 * ## Related
 * - Spec: `docs/redesign/components/Modal.md`
 * - ADR: `docs/redesign/decisions/0008-modal-enhancement.md`
 * - Mobile counterpart: `Sheet` (same Semantic Depth language for bottom sheets).
 * - Cursor rule: `.cursor/rules/modal-canonical-pattern.mdc` (alwaysApply).
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  description,
  children,
  icon,
  tone = "default",
  size = "md",
  primaryAction,
  secondaryAction,
  tertiaryAction,
  role = "dialog",
  dismissible,
  closeOnBackdropClick,
  initialFocusRef,
  returnFocusRef,
  className,
  bodyClassName,
  titleId: titleIdProp,
  descriptionId: descriptionIdProp,
  closeButtonLabel = "Close",
}: ModalProps) {
  const generatedTitleId = useId();
  const generatedDescriptionId = useId();
  const titleId = titleIdProp ?? generatedTitleId;
  const descriptionId = descriptionIdProp ?? generatedDescriptionId;
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<Element | null>(null);
  // Stable ref so onClose never appears in the useEffect deps — prevents
  // the effect from re-running (and re-focusing) on every parent re-render.
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  const isDismissible = dismissible ?? closeOnBackdropClick ?? true;
  const subtitleNode = subtitle ?? description;
  const hasSubtitle = subtitleNode != null && subtitleNode !== "";
  const hasFooter = Boolean(primaryAction || secondaryAction || tertiaryAction);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current = document.activeElement ?? null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusInitial = () => {
      const explicit = initialFocusRef?.current;
      if (explicit) {
        explicit.focus(FOCUS_OPTIONS_NO_SCROLL);
        return;
      }
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getFocusableElements(panel);
      const target = focusables[0] ?? panel;
      target.focus(FOCUS_OPTIONS_NO_SCROLL);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isDismissible) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = getFocusableElements(panelRef.current);
      if (focusables.length === 0) {
        event.preventDefault();
        panelRef.current.focus(FOCUS_OPTIONS_NO_SCROLL);
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus(FOCUS_OPTIONS_NO_SCROLL);
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus(FOCUS_OPTIONS_NO_SCROLL);
      }
    };

    focusInitial();
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const node = (returnFocusRef?.current ?? previousActiveElementRef.current) as HTMLElement | null;
      if (node && typeof node.focus === "function") {
        node.focus(FOCUS_OPTIONS_NO_SCROLL);
      }
    };
  }, [isOpen, isDismissible, initialFocusRef, returnFocusRef]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (isDismissible) onClose();
  };

  return (
    <Portal>
      <div
        className={cn(
          "fixed inset-0 z-[var(--z-modal,80)] flex items-center justify-center p-4",
          "[backdrop-filter:blur(8px)] [-webkit-backdrop-filter:blur(8px)] [background:oklch(12%_0.010_50/0.35)]",
          "dark:[background:oklch(4%_0.015_265/0.62)]",
          "motion-safe:animate-[modal-fade_200ms_cubic-bezier(0.2,0,0,1)_both]",
        )}
        onClick={handleBackdropClick}
        role="presentation"
      >
        <div
          ref={panelRef}
          role={role}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={hasSubtitle ? descriptionId : undefined}
          tabIndex={-1}
          className={cn(
            "relative flex max-h-[calc(100vh-80px)] w-full flex-col overflow-hidden [outline:none]",
            "[border-radius:20px] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]",
            "[box-shadow:0_14px_28px_oklch(20%_0.020_50/0.10),0_2px_6px_oklch(20%_0.020_50/0.06)]",
            "dark:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.04),0_0_0_1px_var(--border-strong),0_0_24px_color-mix(in_oklch,var(--accent)_5%,transparent)]",
            "motion-safe:animate-[modal-spring_280ms_linear(0,0.5,0.85,0.97,1)_both]",
            "motion-reduce:animate-[modal-fade_200ms_ease-out_both]",
            className,
          )}
          style={{ maxWidth: SIZE_MAX_WIDTH[size] }}
          onClick={(event) => event.stopPropagation()}
        >
          <header className={cn("flex items-start gap-4 px-6 pt-6 pb-0", icon && "relative")}>
            {icon && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse 160% 120% at -10% -20%, color-mix(in oklch, ${TONE_COLOR_VAR[tone]} 9%, transparent) 0%, transparent 65%)`,
                }}
                aria-hidden="true"
              />
            )}
            {icon && (
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex h-12 w-12 flex-shrink-0 items-center justify-center [border-radius:24px]",
                  TONE_ICON_CLASSES[tone],
                )}
                style={{
                  boxShadow: `0 0 0 5px color-mix(in oklch, ${TONE_COLOR_VAR[tone]} 11%, transparent)`,
                }}
              >
                {icon}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                className="[font-size:1.125rem] [line-height:1.3] [font-weight:var(--font-weight-semibold)] [letter-spacing:-0.01em] [color:var(--text-primary)]"
              >
                {title}
              </h2>
              {hasSubtitle && (
                <p
                  id={descriptionId}
                  className="mt-1 [font-size:var(--text-body)] [line-height:1.5] [color:var(--text-secondary)]"
                >
                  {subtitleNode}
                </p>
              )}
            </div>
            {isDismissible && (
              <IconButton
                aria-label={closeButtonLabel}
                size="sm"
                variant="ghost"
                icon={<X size={18} aria-hidden="true" />}
                onClick={onClose}
                className="-mt-0.5 flex-shrink-0"
              />
            )}
          </header>
          {children != null && children !== false && (
            <div className={cn("flex-1 overflow-y-auto px-6 pt-4 pb-1", bodyClassName)}>{children}</div>
          )}
          {hasFooter && (
            <footer className="flex items-center justify-between gap-2 px-6 pt-3 pb-5 [border-top:1px_solid_var(--border)]">
              <div>
                {tertiaryAction && (
                  <Button variant="ghost" size="sm" onClick={tertiaryAction.onClick} disabled={tertiaryAction.disabled}>
                    {tertiaryAction.label}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {secondaryAction && (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={secondaryAction.onClick}
                    disabled={secondaryAction.disabled}
                  >
                    {secondaryAction.label}
                  </Button>
                )}
                {primaryAction && (
                  <Button
                    variant={primaryAction.variant === "destructive" ? "destructive" : "primary"}
                    size="md"
                    onClick={primaryAction.onClick}
                    loading={primaryAction.loading}
                    disabled={primaryAction.disabled}
                  >
                    {primaryAction.label}
                  </Button>
                )}
              </div>
            </footer>
          )}
        </div>
      </div>
      <style>{`
        @keyframes modal-spring {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes modal-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </Portal>
  );
}
