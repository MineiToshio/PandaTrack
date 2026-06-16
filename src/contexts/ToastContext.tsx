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
  /** Duration in milliseconds. Defaults to 5000 for the neutral (undo) variant, 4000 otherwise. */
  duration?: number;
  action?: ToastAction;
};

type ToastContextValue = {
  addToast: (message: string, options?: AddToastOptions) => void;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Auto-dismiss window for non-undo toasts (success / info / warning / error). */
export const DEFAULT_DURATION_MS = 4000;
/** Light reversible undo (reopen, soft-delete of a payment, bulk select): 5s read window. */
export const NEUTRAL_UNDO_DURATION_MS = 5000;
/**
 * Whole-entity reversible undo (delete / cancel of an order, delivery or store) — more data
 * at stake, so a longer 8s window. Opt-in: today's destructive actions confirm via a modal
 * (irreversible) per optimistic-client-updates.mdc; this is the canonical window for when an
 * entity-delete undo flow is introduced.
 */
export const ENTITY_DELETE_UNDO_DURATION_MS = 8000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, options?: AddToastOptions) => {
    counterRef.current += 1;
    const id = `toast-${counterRef.current}`;
    const variant = options?.variant ?? "success";
    // Neutral-undo toasts default to the 5s read window (not 4s) so a callsite that forgets
    // `duration` still gives the reader time to hit "Deshacer" / `Z` before it auto-dismisses.
    const duration = options?.duration ?? (variant === "neutral" ? NEUTRAL_UNDO_DURATION_MS : DEFAULT_DURATION_MS);
    const toast: ToastItem = { id, message, variant, duration, action: options?.action };
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
