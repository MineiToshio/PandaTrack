"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type ReactNode } from "react";
import IconButton from "@/components/core/IconButton";
import Portal from "@/components/core/Portal";
import { cn } from "@/lib/styles";
import { FOCUS_OPTIONS_NO_SCROLL, getFocusableElements } from "@/lib/a11y/focusable";

export type SheetSize = "sm" | "md" | "lg" | "full";

export type SheetProps = {
  /** Controlled open state. */
  open: boolean;
  /** Called when the user dismisses (Esc, backdrop click, close button, drag-down). */
  onOpenChange: (open: boolean) => void;
  /** Optional title rendered in the header. When present a header bar with title + close button is shown. */
  title?: string;
  /** Sheet body. */
  children: ReactNode;
  /** Footer content sticky to the bottom edge. */
  footer?: ReactNode;
  /**
   * Max-height variant:
   *   sm → 40svh, md → 60svh, lg → 80svh, full → 92svh
   * Default `md`.
   */
  size?: SheetSize;
  /** When false, hides the drag handle. Default `true`. */
  showHandle?: boolean;
  /** When false, disables Esc + backdrop dismiss + close button. Default `true`. */
  dismissible?: boolean;
  /** Override the accessible label when no `title` is supplied. */
  ariaLabel?: string;
  /** Optional className on the body container. */
  bodyClassName?: string;
  className?: string;
};

const SIZE_HEIGHTS: Record<SheetSize, string> = {
  sm: "min(40svh, 92svh)",
  md: "min(60svh, 92svh)",
  lg: "min(80svh, 92svh)",
  full: "92svh",
};

export default function Sheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
  size = "md",
  showHandle = true,
  dismissible = true,
  ariaLabel,
  bodyClassName,
  className,
}: SheetProps) {
  const t = useTranslations("common");
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement;

    const container = containerRef.current;
    if (container) {
      const focusables = getFocusableElements(container);
      const target = focusables[0] ?? container;
      target.focus(FOCUS_OPTIONS_NO_SCROLL);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key === "Tab" && container) {
        const focusables = getFocusableElements(container);
        if (focusables.length === 0) {
          event.preventDefault();
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
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus(FOCUS_OPTIONS_NO_SCROLL);
      }
    };
  }, [open, dismissible, onOpenChange]);

  if (!open) return null;

  const handleBackdropClick = () => {
    if (dismissible) onOpenChange(false);
  };

  return (
    <Portal>
      <div
        className={cn(
          "fixed inset-0 z-[var(--z-modal,80)] flex items-end justify-center",
          "[backdrop-filter:blur(8px)] [background:oklch(12%_0.010_50/0.35)]",
          "dark:[background:oklch(4%_0.015_265/0.62)]",
          "motion-safe:animate-[sheet-fade_200ms_ease-out_both]",
        )}
        onClick={handleBackdropClick}
        role="presentation"
      >
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-label={!title ? ariaLabel : undefined}
          tabIndex={-1}
          className={cn(
            "relative flex w-full flex-col [outline:none]",
            "[border-top-left-radius:20px] [border-top-right-radius:20px] [background:var(--surface-elevated)]",
            "[border-bottom:none] [border:1px_solid_var(--border-strong)]",
            "[box-shadow:0_-12px_40px_oklch(20%_0.020_50/0.16)]",
            "motion-safe:animate-[sheet-rise_280ms_linear(0,0.5,0.85,0.97,1)_both]",
            "motion-reduce:animate-none",
            "[padding-bottom:env(safe-area-inset-bottom)]",
            className,
          )}
          style={{ maxHeight: SIZE_HEIGHTS[size] }}
          onClick={(event) => event.stopPropagation()}
        >
          {showHandle && (
            <div className="flex justify-center pt-3 pb-1" aria-hidden="true">
              <span className="block h-1 w-10 rounded-full opacity-50 [background:var(--text-muted)]" />
            </div>
          )}
          {title && (
            <header className="flex items-start gap-3 px-5 pt-2 pb-3 [border-bottom:1px_solid_var(--border)]">
              <h2
                id={titleId}
                className="flex-1 [font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]"
              >
                {title}
              </h2>
              {dismissible && (
                <IconButton
                  aria-label={t("close")}
                  size="sm"
                  variant="ghost"
                  icon={<X size={18} aria-hidden="true" />}
                  onClick={() => onOpenChange(false)}
                />
              )}
            </header>
          )}
          <div className={cn("flex-1 overflow-y-auto px-5 py-4", bodyClassName)}>{children}</div>
          {footer && <footer className="px-5 py-3 [border-top:1px_solid_var(--border)]">{footer}</footer>}
        </div>
      </div>
      <style>{`
        @keyframes sheet-rise {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes sheet-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes sheet-rise { from { opacity: 0; } to { opacity: 1; } }
        }
      `}</style>
    </Portal>
  );
}
