"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import ToastContainer from "@/components/core/Toast/ToastContainer";

export type ToastVariant = "success" | "error" | "info" | "warning" | "neutral";

/** Inline CTA rendered next to the message (e.g. "Deshacer" — ADR 0001 D4 neutral-undo). */
export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  /** Duration in milliseconds before the toast auto-dismisses. */
  duration: number;
  action?: ToastAction;
};

type AddToastOptions = {
  variant?: ToastVariant;
  /** Duration in milliseconds. Defaults to 4000. */
  duration?: number;
  action?: ToastAction;
};

type ToastContextValue = {
  addToast: (message: string, options?: AddToastOptions) => void;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, options?: AddToastOptions) => {
    counterRef.current += 1;
    const id = `toast-${counterRef.current}`;
    const toast: ToastItem = {
      id,
      message,
      variant: options?.variant ?? "success",
      duration: options?.duration ?? DEFAULT_DURATION_MS,
      action: options?.action,
    };
    setToasts((prev) => [...prev, toast]);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return ctx;
}
