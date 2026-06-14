"use client";

import { RotateCw, TriangleAlert, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Button from "@/components/core/Button/Button";
import Eyebrow from "@/components/core/Eyebrow";
import { cn } from "@/lib/styles";

export type SectionErrorTone = "destructive" | "warning";

const TONE_ICON: Record<SectionErrorTone, typeof TriangleAlert> = {
  destructive: TriangleAlert,
  warning: WifiOff,
};

// Top-accent uses oklch (chromatic status tokens) per the §9.17 Chip-Eyebrow + Top-Accent vocabulary.
const TOP_ACCENT: Record<SectionErrorTone, string> = {
  destructive: "color-mix(in oklch, var(--destructive) 55%, transparent)",
  warning: "color-mix(in oklch, var(--warning) 55%, transparent)",
};

export type SectionErrorProps = {
  /** Context-specific message (which section failed + that the rest of the page works). */
  message: string;
  /** `destructive` for load failures (default), `warning` for transient offline. */
  tone?: SectionErrorTone;
  /** Chip eyebrow label. Defaults to the tone-appropriate i18n string. */
  title?: string;
  /** Retry button label. Defaults to the i18n string. */
  retryLabel?: string;
  /** Retry handler. Defaults to `router.refresh()` (re-runs the Server Components). */
  onRetry?: () => void;
  className?: string;
};

/**
 * Inline error for a region (card/list) that failed to load while the rest of the page lives
 * (ADR 0013). Built on the §9.17 Chip-Eyebrow + Top-Accent vocabulary. Presentation only — it
 * does NOT capture to Sentry; the fallible fetch that renders it owns the single capture.
 */
export default function SectionError({
  message,
  tone = "destructive",
  title,
  retryLabel,
  onRetry,
  className,
}: SectionErrorProps) {
  const t = useTranslations("components.sectionError");
  const router = useRouter();
  const Icon = TONE_ICON[tone];

  const resolvedTitle = title ?? (tone === "warning" ? t("offline.title") : t("title"));
  const resolvedRetryLabel = retryLabel ?? t("retry");

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
      return;
    }
    router.refresh();
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex flex-col items-start gap-2.5 rounded-[var(--radius-xl)] p-5 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]",
        className,
      )}
      style={{ borderTop: `2px solid ${TOP_ACCENT[tone]}` }}
    >
      <Eyebrow variant="chip" tone={tone} icon={Icon}>
        {resolvedTitle}
      </Eyebrow>
      <p className="max-w-[54ch] [font-size:var(--text-body)] [line-height:1.5] [color:var(--text-secondary)]">
        {message}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleRetry}
        leadingIcon={<RotateCw size={15} aria-hidden />}
      >
        {resolvedRetryLabel}
      </Button>
    </div>
  );
}
