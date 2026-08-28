"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, AlertCircle, Info, AlertTriangle, Award, RotateCcw, X } from "lucide-react";
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
  // Medal unlock (FR-12-29). Ambient by contract: a celebration must never interrupt what the
  // collector was reading, so `status`/`polite` and never `alert` — the medal is already theirs,
  // there is nothing to act on. The base surface here is deliberately plain; the rarity halo and
  // the countdown tint are composed per-toast from `achievement.ringVar`, since the grade is only
  // known at call time. `Icon` is the fallback for a caller that raises the variant without a
  // payload (art still missing, or a non-medal achievement): the toast degrades to a normal one.
  achievement: {
    containerClass: "border-border bg-card",
    iconClass: "text-accent-warm",
    progressClass: "bg-accent-warm",
    Icon: Award,
    role: "status" as const,
    ariaLive: "polite" as const,
  },
} as const;

/** Exit transition length — kept in sync with --motion-base (the container transition). */
const EXIT_ANIMATION_MS = 280;

/**
 * Achievement halo: `--elevation-3` plus a wide glow mixed from the rarity ring, and a border
 * mixed off `--border-strong` so the toast still reads as a bordered surface when the ring is a
 * low-chroma grade (`--rarity-normal`). `color-mix` over tokens rather than literal colors is what
 * keeps this legible in both themes: in dark, `--elevation-3` is a composition (inset + ring +
 * micro-glow) and the mix resolves against the dark `--rarity-*` values automatically.
 */
function buildHaloStyle(ringVar: string): React.CSSProperties {
  return {
    borderColor: `color-mix(in oklch, ${ringVar} 40%, var(--border-strong))`,
    boxShadow: `var(--elevation-3), 0 0 40px -14px color-mix(in oklch, ${ringVar} 60%, transparent)`,
  };
}

export default function Toast({ toast, onRemove }: ToastProps) {
  const t = useTranslations("common");
  const { id, message, variant, duration, action, achievement } = toast;
  const config = VARIANT_CONFIG[variant];
  const { Icon } = config;

  const [visible, setVisible] = useState(false);
  const dismissedRef = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setVisible(false);
    setTimeout(() => onRemove(id), EXIT_ANIMATION_MS);
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
        "relative flex w-full items-start gap-3 overflow-hidden rounded-xl border px-4 py-3 transition-[transform,opacity] [transition-duration:var(--motion-base)] [transition-timing-function:var(--ease-emphasis)]",
        achievement ? "bg-card" : "shadow-lg",
        !achievement && config.containerClass,
        // motion.md §4 "Toast enter/exit": under reduced motion the toast appears and disappears
        // WITHOUT the slide, so the offset is gated behind `motion-safe:` instead of being
        // overridden afterwards. The opacity fade and the JS dismiss timer are untouched, which is
        // the "reduced ≠ none" policy: still a transition, just no travel.
        visible ? "translate-x-0 opacity-100" : "opacity-0 motion-safe:translate-x-4",
      )}
      style={achievement ? buildHaloStyle(achievement.ringVar) : undefined}
    >
      {achievement ? (
        // The art is decorative: the kicker, the name and the meta line already state the rarity,
        // the series and the count, so a screen reader loses nothing by skipping it.
        <div className="mt-0.5 shrink-0" aria-hidden>
          {achievement.media}
        </div>
      ) : (
        <Icon size={18} className={cn("mt-0.5 shrink-0", config.iconClass)} aria-hidden />
      )}
      {achievement ? (
        <div className="min-w-0 flex-1">
          <span
            className="block [font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] [font-weight:var(--font-weight-mono)] [letter-spacing:0.16em] uppercase"
            style={{ color: achievement.ringVar }}
          >
            {achievement.kicker}
          </span>
          {/* `break-words` on both support lines and the name: a long medal name must wrap inside
              the container's `sm:max-w-sm`, never clip or push the dismiss target off the edge. */}
          <p className="text-text-body mt-0.5 text-sm leading-snug font-bold break-words">{message}</p>
          <span className="text-text-muted mt-0.5 block text-xs leading-snug break-words">{achievement.meta}</span>
        </div>
      ) : (
        <p className="text-text-body min-w-0 flex-1 text-sm leading-snug">{message}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={handleActionClick}
          className="text-accent shrink-0 cursor-pointer text-sm font-semibold hover:underline"
        >
          {action.label}
        </button>
      )}
      {/*
        The dismiss target is 44×44 and grows INWARD, over the toast's own `px-4 py-3` padding,
        via the matching negative margins. The `::before` recipe cannot be used here at all: the
        root is `overflow-hidden` (it clips the countdown bar to the rounded corners) and an
        `overflow-hidden` ancestor removes a pseudo-element from hit-testing entirely. A real box
        pulled into padding is not the "padding inside a fixed box" antipattern either — the box
        really is 44px, and it eats dead space, not a neighbour's clearance (the action button is
        still `gap-3` away, and flow boxes cannot overlap). Because the margins cancel the box's
        own size, the toast's height and the message's width are unchanged at every breakpoint,
        so there is no compact variant to drop back to.
      */}
      <button
        type="button"
        onClick={dismiss}
        className="text-text-muted hover:text-foreground -my-3 -mr-3 grid size-11 shrink-0 cursor-pointer place-items-center transition-colors"
        aria-label={t("dismiss")}
      >
        <X size={16} aria-hidden />
      </button>
      <div
        className={cn("toast-countdown absolute inset-x-0 bottom-0 h-0.5", !achievement && config.progressClass)}
        style={{
          animationDuration: `${duration}ms`,
          // The hairline carries the same rarity tint as the halo, so the countdown reads as part
          // of the medal rather than as generic chrome.
          ...(achievement ? { backgroundColor: achievement.ringVar } : null),
        }}
        aria-hidden
      />
    </div>
  );
}
