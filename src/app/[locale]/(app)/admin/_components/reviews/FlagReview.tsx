import { getTranslations } from "next-intl/server";
import { TriangleAlert } from "lucide-react";
import Chip from "@/components/core/Chip";
import type { AdminOpenStoreReport } from "@/lib/data/admin/adminStoreReportQueries";
import type { ModerationStoreRef } from "@/lib/data/admin/moderationQueueQueries";
import { ReviewActions, ReviewCard, ReviewHeader, ReviewHint, ReviewSection } from "../ReviewShell";
import StoreMetaChips from "../StoreMetaChips";
import ReportCard from "./ReportCard";
import FlagReviewActions from "./FlagReviewActions";

type FlagReviewProps = {
  store: ModerationStoreRef;
  reports: AdminOpenStoreReport[];
  locale: string;
};

/** Suggested-removal review: the accumulated reports plus flag / unflag / remove. */
export default async function FlagReview({ store, reports, locale }: FlagReviewProps) {
  const t = await getTranslations({ locale, namespace: "admin.review" });
  const tQueue = await getTranslations({ locale, namespace: "admin.queue" });

  return (
    <ReviewCard ariaLabel={`${tQueue("category.flag")}: ${store.name}`}>
      <ReviewHeader
        eyebrowIcon={TriangleAlert}
        eyebrowTone="destructive"
        eyebrowLabel={tQueue("category.flag")}
        title={store.name}
        meta={
          <StoreMetaChips
            store={store}
            locale={locale}
            extra={<Chip variant="destructive">{tQueue("reportsAccumulated", { count: reports.length })}</Chip>}
          />
        }
      />
      <ReviewSection title={t("flag.sectionReports")} icon={TriangleAlert}>
        <div className="flex flex-col gap-2">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} locale={locale} />
          ))}
        </div>
      </ReviewSection>
      <ReviewHint>{t("flag.hint")}</ReviewHint>
      <ReviewActions>
        <FlagReviewActions slug={store.slug} storeName={store.name} locale={locale} status={store.status} />
      </ReviewActions>
    </ReviewCard>
  );
}
