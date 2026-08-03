import type { ReactElement, ReactNode, RefObject } from "react";

export type ModalRole = "dialog" | "alertdialog";

export type ModalTone = "default" | "destructive" | "warning" | "info" | "success";

export type ModalSize = "md" | "lg";

/**
 * How the modal presents itself on mobile.
 *
 * - `adaptive` (default) — bottom sheet under 768px, centered dialog above. Correct for anything
 *   the user has to *do*: confirms, forms, option lists, decisions. The sheet sits under the thumb
 *   and reads as a task surface.
 * - `centered` — centered dialog at every width. For content the user only has to *look at*, where
 *   a drawer misreads the intent and wastes the screen: a drawer implies "pick something", and
 *   anchoring to the bottom forfeits the height a viewed image wants. Use it for media viewing,
 *   not to dodge the sheet on a form.
 */
export type ModalPresentation = "adaptive" | "centered";

export type ModalAction = {
  label: string;
  onClick: () => void;
  /**
   * Only meaningful for `primaryAction`. Defaults to `primary`.
   * `success` / `warning` paint the primary CTA with the matching semantic token
   * (M06 — e.g. "Marcar como llegada" / "Cancelar entrega").
   */
  variant?: "primary" | "destructive" | "success" | "warning";
  loading?: boolean;
  disabled?: boolean;
};

export type ModalSecondaryAction = {
  label: string;
  onClick: () => void;
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
  /** Width preset for desktop dialog: `md` (460px) | `lg` (768px). Default `md`. Ignored on mobile sheet. */
  size?: ModalSize;
  /** Mobile presentation. Default `adaptive` (bottom sheet). See `ModalPresentation`. */
  presentation?: ModalPresentation;
  /** Primary CTA in the footer. */
  primaryAction?: ModalAction;
  /** Secondary CTA in the footer (aligned to the left of primary). */
  secondaryAction?: ModalSecondaryAction;
  /** Tertiary CTA placed on the far left of the footer (e.g. "Back"). */
  tertiaryAction?: ModalSecondaryAction;
  /** ARIA role: `dialog` | `alertdialog`. Default `dialog`. */
  role?: ModalRole;
  /**
   * When false, disables Esc + backdrop click + close button.
   * Default `true`. Backward-compatible alias `closeOnBackdropClick` keeps prior behavior.
   */
  dismissible?: boolean;
  /** @deprecated Use `dismissible`. Backward-compat. */
  closeOnBackdropClick?: boolean;
  /** Initial focus override (desktop dialog only). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Return focus override (desktop dialog only). */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Optional class on the modal panel / sheet content. */
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

export const TONE_ICON_CLASSES: Record<ModalTone, string> = {
  default: "[background:color-mix(in_oklch,var(--accent)_14%,var(--surface-elevated))] [color:var(--accent)]",
  destructive:
    "[background:color-mix(in_oklch,var(--destructive)_14%,var(--surface-elevated))] [color:var(--destructive)]",
  warning: "[background:color-mix(in_oklch,var(--warning)_14%,var(--surface-elevated))] [color:var(--warning)]",
  info: "[background:color-mix(in_oklch,var(--info)_14%,var(--surface-elevated))] [color:var(--info)]",
  success: "[background:color-mix(in_oklch,var(--success)_14%,var(--surface-elevated))] [color:var(--success)]",
};

/** CSS custom property name for each tone — used for inline gradient/ring styles. */
export const TONE_COLOR_VAR: Record<ModalTone, string> = {
  default: "var(--accent)",
  destructive: "var(--destructive)",
  warning: "var(--warning)",
  info: "var(--info)",
  success: "var(--success)",
};

export const SIZE_MAX_WIDTH: Record<ModalSize, string> = {
  md: "460px",
  lg: "768px",
};
