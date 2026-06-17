"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import Portal from "@/components/core/Portal";
import { cn } from "@/lib/styles";
import { FOCUS_OPTIONS_NO_SCROLL, getFocusableElements } from "@/lib/a11y/focusable";
import type { ModalProps } from "./Modal.types";
import { SIZE_MAX_WIDTH } from "./Modal.types";
import { ModalBody, ModalFooter, ModalHeader } from "./ModalContent";

/**
 * # ModalDialog — desktop centered modal (ADR 0008 · Semantic Depth)
 *
 * Internal implementation of the canonical `<Modal>` for desktop viewports.
 * Hand-rolled (no external deps) — implements its own focus trap, scroll
 * lock, Esc and backdrop click handling, plus the Semantic Depth visual
 * contract (backdrop blur, tonal icon-circle, spring animation).
 *
 * Do NOT import this file directly from feature code. The smart wrapper
 * `<Modal>` (Modal.tsx) chooses between this and `<ModalSheet>` based on
 * viewport. See `docs/design/decisions/0008-modal-enhancement.md`.
 */
export default function ModalDialog({
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
          <ModalBody className={bodyClassName}>{children}</ModalBody>
          <ModalFooter
            primaryAction={primaryAction}
            secondaryAction={secondaryAction}
            tertiaryAction={tertiaryAction}
          />
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
