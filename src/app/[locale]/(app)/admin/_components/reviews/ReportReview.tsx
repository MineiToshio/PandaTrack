import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import type { AdminOpenStoreReport } from "@/lib/data/admin/adminStoreReportQueries";
import type { ModerationStoreRef } from "@/lib/data/admin/moderationQueueQueries";
import { ReviewActions, ReviewCard, ReviewHeader, ReviewSection } from "../ReviewShell";
import StoreMetaChips from "../StoreMetaChips";
import ReportCard from "./ReportCard";
import ReportReviewActions from "./ReportReviewActions";

type ReportReviewProps = {
  store: ModerationStoreRef;
  report: AdminOpenStoreReport;
  locale: string;
};

/** Review for a single open report: reason, raw text, admin-only reporter, plus resolve / dismiss / remove. */
export default async function ReportReview({ store, report, locale }: ReportReviewProps) {
  const t = await getTranslations({ locale, namespace: "admin.review" });
  const tQueue = await getTranslations({ locale, namespace: "admin.queue" });

  return (
    <ReviewCard ariaLabel={`${tQueue("category.report")}: ${store.name}`}>
      <ReviewHeader
        eyebrowIcon={ShieldAlert}
        eyebrowTone="destructive"
        eyebrowLabel={tQueue("category.report")}
        title={store.name}
        meta={<StoreMetaChips store={store} locale={locale} />}
      />
      <ReviewSection title={t("report.sectionReport")} icon={ShieldAlert}>
        <ReportCard report={report} locale={locale} />
      </ReviewSection>
      <ReviewActions>
        <ReportReviewActions slug={store.slug} storeName={store.name} locale={locale} reportId={report.id} />
      </ReviewActions>
    </ReviewCard>
  );
}
