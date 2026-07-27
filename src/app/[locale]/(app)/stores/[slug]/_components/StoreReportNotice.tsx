"use client";

import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import Chip from "@/components/core/Chip";
import AlertBanner from "@/components/modules/AlertBanner";
import { useStoreReportNotice } from "./StoreReportNoticeProvider";

/**
 * Derived report notice shown to every viewer, anonymous included, while the store has at least one
 * open report. It is not a moderation status and never hides the store or affects its indexing: it
 * states that reports exist and are still unreviewed, and hands the judgment to the reader.
 *
 * `role="alert"` so it is announced when a resolution failure brings it back, and the warning tint is
 * always paired with an icon and a text title rather than carrying meaning through color alone.
 */
export default function StoreReportNoticeBanner() {
  const t = useTranslations("stores.detail");
  const { hasReportNotice } = useStoreReportNotice();

  if (!hasReportNotice) return null;

  return (
    <AlertBanner
      tone="warning"
      role="alert"
      icon={<AlertCircle size={16} aria-hidden="true" />}
      title={t("reportNoticeTitle")}
    >
      {t("reportNoticeMessage")}
    </AlertBanner>
  );
}

/**
 * Hero counterpart of the banner: a derived trust signal beside the lifecycle status chip, never a
 * status of its own. It appears and clears with the same open-report count as the banner.
 */
export function StoreReportedChip() {
  const t = useTranslations("stores.redesign.detail");
  const { hasReportNotice } = useStoreReportNotice();

  if (!hasReportNotice) return null;

  return (
    <Chip variant="warning" size="sm" icon={<AlertCircle size={11} aria-hidden="true" />}>
      {t("reportedChip")}
    </Chip>
  );
}
