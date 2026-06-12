"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, AlertCircle, Info, AlertTriangle, RotateCcw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/styles";
import type { ToastItem } from "@/contexts/ToastContext";

type ToastProps = {
  toast: ToastItem;
  onRemove: (id: string) => void;
};

const VARIANT_CONFIG = {
  success: {
    containerClass: "border-success/20 bg-card",
    iconClass: "text-success",
    progressClass: "bg-success",
    Icon: CheckCircle,
    role: "status" as const,
    ariaLive: "polite" as const,
  },
  error: {
    containerClass: "border-destructive/20 bg-card",
    iconClass: "text-destructive",
    progressClass: "bg-destructive",
    Icon: AlertCircle,
    role: "alert" as const,
    ariaLive: "assertive" as const,
  },
  info: {
    containerClass: "border-info/20 bg-card",
    iconClass: "text-info",
    progressClass: "bg-info",
    Icon: Info,
    role: "status" as const,
    ariaLive: "polite" as const,
  },
  warning: {
    containerClass: "border-warning/20 bg-card",
    iconClass: "text-warning",
    progressClass: "bg-warning",
    Icon: AlertTriangle,
    role: "status" as const,
    ariaLive: "polite" as const,
  },
  // Neutral-undo (ADR 0001 D4): reversible operations executed directly, paired with an
  // inline "Deshacer" action via `toast.action`.
  neutral: {
    containerClass: "border-border bg-card",
    iconClass: "text-text-secondary",
    progressClass: "bg-text-muted",
    Icon: RotateCcw,
    role: "status" as const,
    ariaLive: "polite" as const,
  },
} as const;

export default function Toast({ toast, onRemove }: ToastProps) {
  const t = useTranslations("common");
  const { id, message, variant, duration, action } = toast;
  const config = VARIANT_CONFIG[variant];
  const { Icon } = config;

  const [visible, setVisible] = useState(false);
  const dismissedRef = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setVisible(false);
    setTimeout(() => onRemove(id), 300);
  }, [id, onRemove]);

  const handleActionClick = () => {
    action?.onClick();
    dismiss();
  };

  useEffect(() => {
    const enterFrame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });

    const exitTimer = setTimeout(dismiss, duration);

    return () => {
      cancelAnimationFrame(enterFrame);
      clearTimeout(exitTimer);
    };
  }, [dismiss, duration]);

  return (
    <div
      role={config.role}
      aria-live={config.ariaLive}
      aria-atomic="true"
      className={cn(
        "relative flex w-full items-start gap-3 overflow-hidden rounded-xl border px-4 py-3 shadow-lg transition-all duration-300 ease-out",
        config.containerClass,
        visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0",
      )}
    >
      <Icon size={18} className={cn("mt-0.5 shrink-0", config.iconClass)} aria-hidden />
      <p className="text-text-body min-w-0 flex-1 text-sm leading-snug">{message}</p>
      {action && (
        <button
          type="button"
          onClick={handleActionClick}
          className="text-accent shrink-0 cursor-pointer text-sm font-semibold hover:underline"
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        className="text-text-muted hover:text-foreground shrink-0 cursor-pointer transition-colors"
        aria-label={t("dismiss")}
      >
        <X size={16} aria-hidden />
      </button>
      <div
        className={cn("absolute bottom-0 left-0 h-0.5", config.progressClass)}
        style={{ animation: `toast-progress ${duration}ms linear forwards` }}
        aria-hidden
      />
    </div>
  );
}
