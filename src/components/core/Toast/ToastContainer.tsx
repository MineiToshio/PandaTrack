"use client";

import { useTranslations } from "next-intl";
import Portal from "@/components/core/Portal";
import { cn } from "@/lib/styles";
import Toast from "./Toast";
import type { ToastItem } from "@/contexts/ToastContext";

type ToastContainerProps = {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
  /** Raises the stack above the floating action button on routes where it renders. */
  raiseForFab?: boolean;
};

export default function ToastContainer({ toasts, onRemove, raiseForFab = false }: ToastContainerProps) {
  const t = useTranslations("components.toast");

  if (toasts.length === 0) return null;

  return (
    <Portal>
      <div
        aria-label={t("regionLabel")}
        className={cn(
          "fixed right-4 bottom-4 left-4 z-50 flex flex-col gap-2 sm:right-6 sm:bottom-6 sm:left-auto sm:w-full sm:max-w-sm",
          // The FAB only renders below 1024px (`lg:hidden`), so the raised inset matches it
          // one-for-one with `max-lg:`. Above that breakpoint the toast keeps its default inset.
          raiseForFab && "max-lg:bottom-[calc(var(--fab-offset)+var(--fab-h)+var(--space-3))]",
        )}
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </div>
    </Portal>
  );
}
