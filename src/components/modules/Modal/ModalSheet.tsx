"use client";

import { useId, type ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/styles";
import type { ModalProps } from "./Modal.types";
import { hasModalFooter, ModalFooter, ModalHeader } from "./ModalContent";

/**
 * # ModalSheet — mobile bottom sheet (ADR 0008 Extension · Adaptive)
 *
 * Internal implementation of the canonical `<Modal>` for mobile viewports
 * (<768px). Uses Vaul (built on Radix Dialog) for drag-to-dismiss, focus
 * trap, scroll lock, Esc handling and iOS safe-area awareness.
 *
 * Inherits Semantic Depth: same tonal icon-circle, same backdrop blur,
 * same `--radius-2xl` (top corners only), same tones — only the
 * positioning changes (anchored to viewport bottom instead of centered).
 *
 * Do NOT import this file directly from feature code. The smart wrapper
 * `<Modal>` (Modal.tsx) chooses between this and `<ModalDialog>` based on
 * viewport.
 */
export default function ModalSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  description,
  children,
  icon,
  tone = "default",
  primaryAction,
  secondaryAction,
  tertiaryAction,
  role = "dialog",
  dismissible,
  closeOnBackdropClick,
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

  const isDismissible = dismissible ?? closeOnBackdropClick ?? true;
  const subtitleNode = subtitle ?? description;
  const hasSubtitle = subtitleNode != null && subtitleNode !== "";

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <Drawer.Root open={isOpen} onOpenChange={handleOpenChange} dismissible={isDismissible} direction="bottom">
      <Drawer.Portal>
        <Drawer.Overlay
          className={cn(
            "fixed inset-0 z-[var(--z-modal,80)]",
            "[backdrop-filter:blur(8px)] [-webkit-backdrop-filter:blur(8px)] [background:var(--surface-overlay)]",
            "motion-safe:animate-[modal-fade_200ms_cubic-bezier(0.2,0,0,1)_both]",
          )}
        />
        <Drawer.Content
          role={role}
          aria-labelledby={titleId}
          aria-describedby={hasSubtitle ? descriptionId : undefined}
          className={cn(
            "fixed right-0 bottom-0 left-0 z-[var(--z-modal,80)] flex max-h-[78vh] flex-col [outline:none]",
            "[border-radius:20px_20px_0_0] [background:var(--surface-elevated)] [border-top:1px_solid_var(--border-strong)]",
            "[box-shadow:0_-8px_32px_color-mix(in_oklch,var(--text-primary)_22%,transparent)]",
            className,
          )}
        >
          {/* Radix Dialog requires Title + Description for a11y; we render
              them visually-hidden because our visible header inside
              ModalHeader already shows the same content with theme-aware
              styles. */}
          <Drawer.Title className="sr-only">{title}</Drawer.Title>
          {hasSubtitle && <Drawer.Description className="sr-only">{subtitleNode as ReactNode}</Drawer.Description>}
          <div className="mx-auto mt-2 mb-1 h-1 w-9 flex-shrink-0 rounded-full [background:var(--border-strong)]" />
          <ModalHeader
            title={title}
            subtitle={subtitleNode}
            icon={icon}
            tone={tone}
            dismissible={isDismissible}
            onClose={onClose}
            titleId={titleId}
            descriptionId={descriptionId}
            closeButtonLabel={closeButtonLabel}
          />
          {children != null && children !== false && (
            <div
              className={cn(
                "flex-1 overflow-y-auto px-6 pt-4",
                // Without a footer the body is the last thing in the sheet, so it also inherits the
                // footer's job of clearing the iOS home indicator.
                hasModalFooter({ primaryAction, secondaryAction, tertiaryAction })
                  ? "pb-1"
                  : "[padding-bottom:calc(20px+env(safe-area-inset-bottom))]",
                bodyClassName,
              )}
            >
              {children}
            </div>
          )}
          <ModalFooter
            primaryAction={primaryAction}
            secondaryAction={secondaryAction}
            tertiaryAction={tertiaryAction}
            sticky
          />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
