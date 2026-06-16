"use client";

import { useTranslations } from "next-intl";
import Portal from "@/components/core/Portal";
import Toast from "./Toast";
import type { ToastItem } from "@/contexts/ToastContext";

type ToastContainerProps = {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
};

export default function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const t = useTranslations("components.toast");

  if (toasts.length === 0) return null;

  return (
    <Portal>
      <div
        aria-label={t("regionLabel")}
        className="fixed right-4 bottom-4 left-4 z-50 flex flex-col gap-2 sm:right-6 sm:bottom-6 sm:left-auto sm:w-full sm:max-w-sm"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </div>
    </Portal>
  );
}
