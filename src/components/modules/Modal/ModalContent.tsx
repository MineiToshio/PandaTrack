"use client";

import { X } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import Button from "@/components/core/Button/Button";
import IconButton from "@/components/core/IconButton";
import { cn } from "@/lib/styles";
import type { ModalAction, ModalSecondaryAction, ModalTone } from "./Modal.types";
import { TONE_ICON_CLASSES } from "./Modal.types";

export type ModalHeaderProps = {
  title: string;
  subtitle?: string | ReactNode;
  icon?: ReactElement;
  tone?: ModalTone;
  dismissible?: boolean;
  onClose: () => void;
  titleId: string;
  descriptionId: string;
  closeButtonLabel?: string;
};

/**
 * Modal header — shared between desktop dialog and mobile sheet. Renders
 * the optional tonal icon-circle (ADR 0008 Semantic Depth), title, optional
 * subtitle and an inline close button when the modal is dismissible.
 */
export function ModalHeader({
  title,
  subtitle,
  icon,
  tone = "default",
  dismissible = true,
  onClose,
  titleId,
  descriptionId,
  closeButtonLabel = "Close",
}: ModalHeaderProps) {
  const hasSubtitle = subtitle != null && subtitle !== "";

  return (
    <header className="flex items-start gap-4 px-6 pt-6 pb-0">
      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex h-12 w-12 flex-shrink-0 items-center justify-center [border-radius:24px]",
            TONE_ICON_CLASSES[tone],
          )}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {/* Demo `.m01b-title` (CSS line 2578): 17px / 700 / line-height 1.3 / text-primary.
            Previous values (1.125rem / semibold) drifted from spec — bringing back to demo. */}
        <h2
          id={titleId}
          className="[font-size:1.0625rem] [line-height:1.3] [font-weight:var(--font-weight-display)] [color:var(--text-primary)]"
        >
          {title}
        </h2>
        {hasSubtitle && (
          // Demo `.m01b-subtitle` (CSS line 2579): 13px / text-secondary / line-height 1.4 /
          // margin-top 3px.
          <p id={descriptionId} className="mt-[3px] [font-size:13px] [line-height:1.4] [color:var(--text-secondary)]">
            {subtitle}
          </p>
        )}
      </div>
      {dismissible && (
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
  );
}

export type ModalFooterProps = {
  primaryAction?: ModalAction;
  secondaryAction?: ModalSecondaryAction;
  tertiaryAction?: ModalSecondaryAction;
  /** When true the footer sticks to the bottom of the scroll container (mobile sheet). */
  sticky?: boolean;
};

/**
 * Modal footer — shared between desktop dialog and mobile sheet. Renders up
 * to three actions: tertiary on the far left, secondary and primary on the
 * right. In sticky mode (mobile sheet) the footer pins to the bottom and
 * respects the iOS safe area inset.
 */
export function ModalFooter({ primaryAction, secondaryAction, tertiaryAction, sticky = false }: ModalFooterProps) {
  const hasAny = Boolean(primaryAction || secondaryAction || tertiaryAction);
  if (!hasAny) return null;

  return (
    <footer
      className={cn(
        "flex items-center justify-between gap-2 px-6 pt-3 pb-5 [border-top:1px_solid_var(--border)]",
        sticky &&
          "sticky bottom-0 [padding-bottom:calc(20px+env(safe-area-inset-bottom))] [background:var(--surface-elevated)]",
      )}
    >
      <div>
        {tertiaryAction && (
          <Button variant="ghost" size="sm" onClick={tertiaryAction.onClick} disabled={tertiaryAction.disabled}>
            {tertiaryAction.label}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {secondaryAction && (
          <Button variant="secondary" size="md" onClick={secondaryAction.onClick} disabled={secondaryAction.disabled}>
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
  );
}

export type ModalBodyProps = {
  children?: ReactNode;
  className?: string;
};

export function ModalBody({ children, className }: ModalBodyProps) {
  if (children == null || children === false) return null;
  return <div className={cn("flex-1 overflow-y-auto px-6 pt-4 pb-1", className)}>{children}</div>;
}
