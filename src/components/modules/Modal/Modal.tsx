"use client";

import { useEffect, useId, useRef, useEffectEvent } from "react";
import { X } from "lucide-react";
import Heading from "@/components/core/Heading";
import Portal from "@/components/core/Portal";
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
  /** Accessible label for the optional close button. */
  closeButtonLabel?: string;
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Avoid scrolling the page when focus moves inside a fixed overlay (browser default scroll-into-view). */
const FOCUS_OPTIONS_NO_SCROLL: FocusOptions = { preventScroll: true };

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("aria-hidden"),
  );
}

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
  closeButtonLabel,
}: ModalProps) {
  const generatedTitleId = useId();
  const generatedDescriptionId = useId();
  const titleId = titleIdProp ?? generatedTitleId;
  const descriptionId = descriptionIdProp ?? generatedDescriptionId;
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<Element | null>(null);
  const onCloseEvent = useEffectEvent(onClose);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseEvent();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusableElements = getFocusableElements(panelRef.current);
      if (focusableElements.length === 0) {
        event.preventDefault();
        panelRef.current.focus(FOCUS_OPTIONS_NO_SCROLL);
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus(FOCUS_OPTIONS_NO_SCROLL);
      } else if (!event.shiftKey && activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus(FOCUS_OPTIONS_NO_SCROLL);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const returnFocusNode = returnFocusRef?.current ?? null;
    previousActiveElementRef.current = document.activeElement ?? null;

    const focusTarget = initialFocusRef?.current ?? panelRef.current;
    if (focusTarget) {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus(FOCUS_OPTIONS_NO_SCROLL);
      } else {
        const firstFocusable = getFocusableElements(focusTarget)[0];
        if (firstFocusable) {
          firstFocusable.focus(FOCUS_OPTIONS_NO_SCROLL);
        } else {
          focusTarget.focus(FOCUS_OPTIONS_NO_SCROLL);
        }
      }
    }

    return () => {
      const node = (returnFocusRef != null ? returnFocusNode : previousActiveElementRef.current) as HTMLElement | null;
      if (node && typeof node.focus === "function") {
        node.focus(FOCUS_OPTIONS_NO_SCROLL);
      }
    };
  }, [isOpen, initialFocusRef, returnFocusRef]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (closeOnBackdropClick) onClose();
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <button
          type="button"
          className="from-background/82 via-background/64 to-background/82 absolute inset-0 bg-linear-to-br backdrop-blur-md"
          onClick={handleBackdropClick}
          aria-hidden
          tabIndex={-1}
        />
        <div
          ref={panelRef}
          tabIndex={-1}
          className={cn(
            "border-border/70 bg-card/95 text-foreground relative z-10 w-full max-w-xl overflow-hidden rounded-[28px] border shadow-[0_32px_90px_-40px_rgba(15,23,42,0.6)] backdrop-blur",
            className,
          )}
          role="document"
        >
          <div
            className="from-primary/16 via-highlight/8 pointer-events-none absolute inset-x-0 top-0 h-[min(52%,18rem)] min-h-44 bg-linear-to-b to-transparent sm:min-h-52"
            aria-hidden
          />
          <div
            className="bg-primary/10 pointer-events-none absolute -top-10 right-0 size-32 rounded-full blur-3xl sm:size-36"
            aria-hidden
          />
          <div
            className="bg-highlight/10 pointer-events-none absolute top-24 -left-10 size-28 rounded-full blur-3xl sm:top-28 sm:size-32"
            aria-hidden
          />

          <div className="relative flex max-h-[min(85vh,48rem)] flex-col">
            <div className="border-border/60 flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-6 sm:py-6">
              <div className="min-w-0 space-y-2">
                <span
                  className={cn(
                    "bg-primary/12 inline-flex h-2 w-16 rounded-full",
                    role === "alertdialog" && "bg-destructive/16",
                  )}
                  aria-hidden
                />
                <div className="space-y-2">
                  <Heading
                    as="h2"
                    id={titleId}
                    size="xs"
                    className="text-text-title text-xl leading-tight font-semibold tracking-tight sm:text-2xl"
                  >
                    {title}
                  </Heading>
                  {description && (
                    <Typography id={descriptionId} size="xs" className="text-text-body max-w-2xl leading-6">
                      {description}
                    </Typography>
                  )}
                </div>
              </div>

              {closeButtonLabel ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="border-border bg-background/82 text-text-muted hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background inline-flex size-11 shrink-0 items-center justify-center rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  aria-label={closeButtonLabel}
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">{children}</div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
