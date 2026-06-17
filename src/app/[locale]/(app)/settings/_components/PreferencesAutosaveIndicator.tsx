"use client";

import { Check, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/styles";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export type PreferencesAutosaveIndicatorProps = {
  status: AutosaveStatus;
  /** Epoch ms of the last successful save. Drives the rolling "Saved Ns ago" label. */
  lastSavedAt: number | null;
  className?: string;
};

export default function PreferencesAutosaveIndicator({
  status,
  lastSavedAt,
  className,
}: PreferencesAutosaveIndicatorProps) {
  const t = useTranslations("settings.preferences.autosave");
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (status !== "saved" || lastSavedAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [lastSavedAt, status]);

  if (status === "idle") return null;

  if (status === "saving") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-[12px] [color:var(--text-muted)]", className)}>
        <Loader2 size={12} aria-hidden="true" className="animate-spin" />
        {t("saving")}
      </span>
    );
  }

  if (status === "error") {
    return (
      <span
        className={cn("inline-flex items-center gap-1.5 text-[12px] [color:var(--destructive)]", className)}
        role="alert"
      >
        <TriangleAlert size={12} aria-hidden="true" />
        {t("error")}
      </span>
    );
  }

  const elapsedSeconds = lastSavedAt != null ? Math.max(1, Math.round((now - lastSavedAt) / 1000)) : null;
  // Past one minute a rolling seconds counter reads as noise — fall back to the plain label.
  const label =
    elapsedSeconds == null || elapsedSeconds >= 60
      ? t("saved")
      : elapsedSeconds < 5
        ? t("savedRecently")
        : t("savedAgo", { seconds: elapsedSeconds });

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] [color:var(--success)]", className)}>
      <Check size={12} aria-hidden="true" />
      {label}
    </span>
  );
}
