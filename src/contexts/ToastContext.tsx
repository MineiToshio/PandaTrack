"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import ToastContainer from "@/components/core/Toast/ToastContainer";

export type ToastVariant = "success" | "error" | "info" | "warning" | "neutral" | "achievement";

/** Inline CTA rendered next to the message (e.g. "Deshacer" — ADR 0001 D4 neutral-undo). */
export type ToastAction = {
  label: string;
  onClick: () => void;
};

/** The achievement variant's payload: the art slot and the two support lines around the name. */
export type ToastAchievement = {
  /**
   * Rendered where the variant icon sits. Decorative: the three text lines carry every fact.
   *
   * The slot has no intrinsic width of its own, so size the node before passing it: `MedalStage`
   * carries a `max-width: 100%` ceiling for the narrow grid cell, and a slot that never states a
   * width leaves that ceiling resolving against nothing.
   */
  media: React.ReactNode;
  /** Mono uppercase line above the name. */
  kicker: string;
  /** Muted line under the name. */
  meta: string;
  /** Rarity ring token (e.g. `var(--rarity-holo)`) tinting the halo and the countdown bar. */
  ringVar: string;
};

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  /** Duration in milliseconds before the toast auto-dismisses. */
  duration: number;
  action?: ToastAction;
  achievement?: ToastAchievement;
};

type AddToastOptions = {
  variant?: ToastVariant;
  /** Duration in milliseconds. Defaults to 5000 for the neutral (undo) variant, 4000 otherwise. */
  duration?: number;
  action?: ToastAction;
  achievement?: ToastAchievement;
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

type ToastProviderProps = {
  children: React.ReactNode;
  /**
   * Raises the toast stack's bottom inset by the floating action button's height plus its
   * margin on routes where that button renders. Owned by the caller (the app shell)
   * since it already knows the current route and re-uses `isFabEligibleRoute`.
   */
  fabOffsetActive?: boolean;
};

export function ToastProvider({ children, fabOffsetActive = false }: ToastProviderProps) {
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
    const toast: ToastItem = {
      id,
      message,
      variant,
      duration,
      action: options?.action,
      achievement: options?.achievement,
    };
    setToasts((prev) => [...prev, toast]);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} raiseForFab={fabOffsetActive} />
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
