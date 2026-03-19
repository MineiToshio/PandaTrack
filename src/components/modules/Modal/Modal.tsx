"use client";

import { useEffect, useId, useRef } from "react";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";

export type ModalRole = "dialog" | "alertdialog";

export type ModalProps = {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the modal should close (backdrop click, Escape key, or explicit close action). */
  onClose: () => void;
  /** Modal title. Required for accessibility (aria-labelledby). */
  title: string;
  /** Optional description or body text. Used for aria-describedby when provided. */
  description?: string;
  /** Content rendered below the title/description (e.g. actions or custom body). */
  children: React.ReactNode;
  /** Role: "dialog" for general dialogs, "alertdialog" for confirmations that require a choice. */
  role?: ModalRole;
  /** When true, clicking the backdrop calls onClose. Default true for dialog, often false for alertdialog. */
  closeOnBackdropClick?: boolean;
  /** Ref to focus when the modal opens. If not set, the first focusable element in the panel receives focus. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Ref to focus when the modal closes. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** Optional class name for the content panel. */
  className?: string;
  /** Optional id for the title element (for aria-labelledby). Auto-generated if not provided. */
  titleId?: string;
  /** Optional id for the description element (for aria-describedby). Auto-generated if not provided. */
  descriptionId?: string;
};

/**
 * Reusable modal with backdrop, focus management, and Escape key support.
 * Use for confirmations, forms, or any overlay that requires user attention.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  role = "dialog",
  closeOnBackdropClick = true,
  initialFocusRef,
  returnFocusRef,
  className,
  titleId: titleIdProp,
  descriptionId: descriptionIdProp,
}: ModalProps) {
  const generatedTitleId = useId();
  const generatedDescriptionId = useId();
  const titleId = titleIdProp ?? generatedTitleId;
  const descriptionId = descriptionIdProp ?? generatedDescriptionId;
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const returnFocusNode = returnFocusRef?.current ?? null;
    previousActiveElementRef.current = document.activeElement ?? null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);

    const focusTarget = initialFocusRef?.current ?? panelRef.current;
    if (focusTarget) {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else {
        const firstFocusable = focusTarget.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        firstFocusable?.focus();
      }
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const node = (returnFocusRef != null ? returnFocusNode : previousActiveElementRef.current) as HTMLElement | null;
      if (node && typeof node.focus === "function") {
        node.focus();
      }
    };
  }, [isOpen, onClose, initialFocusRef, returnFocusRef]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (closeOnBackdropClick) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role={role}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <button
        type="button"
        className="bg-background/70 absolute inset-0 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        className={cn(
          "border-border bg-background relative z-10 w-full max-w-lg rounded-xl border p-6 shadow-xl",
          className,
        )}
        role="document"
      >
        <Heading as="h2" id={titleId} size="sm" className="text-text-title mb-2">
          {title}
        </Heading>
        {description && (
          <Typography id={descriptionId} size="sm" className="text-text-body mb-4">
            {description}
          </Typography>
        )}
        {children}
      </div>
    </div>
  );
}
