"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";

type FxBannerProps = {
  count: number;
  onOpenModal: () => void;
};

export default function FxBanner({ count, onOpenModal }: FxBannerProps) {
  const t = useTranslations("orderListing");
  if (count <= 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-[var(--radius-2xl)] p-4 [background:color-mix(in_oklch,var(--accent)_8%,var(--surface-elevated))] [border:1px_solid_color-mix(in_oklch,var(--accent)_24%,transparent)] lg:flex-row lg:items-center lg:justify-between lg:p-4"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full [color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_14%,transparent)]"
        >
          <RefreshCw width={16} height={16} />
        </span>
        <p className="[font-size:var(--text-body)] [color:var(--text-primary)]">{t("fx.banner", { count })}</p>
      </div>
      <div className="flex justify-end">
        {/* Status-banner CTAs use `tonal`, never `primary` (playbook §1). */}
        <Button variant="tonal" size="md" leadingIcon={<RefreshCw size={14} aria-hidden />} onClick={onOpenModal}>
          {t("fx.cta")}
        </Button>
      </div>
    </div>
  );
}
