import { getTranslations } from "next-intl/server";
import { GitCompare, MessageSquare, TriangleAlert, User } from "lucide-react";
import Chip from "@/components/core/Chip";
import type { AdminPendingStoreChangeRequest } from "@/lib/data/admin/adminStoreChangeRequestQueries";
import type { ModerationStoreRef } from "@/lib/data/admin/moderationQueueQueries";
import { ReviewActions, ReviewCard, ReviewHeader, ReviewSection } from "../ReviewShell";
import StoreMetaChips from "../StoreMetaChips";
import FieldDiff from "./FieldDiff";
import ChangeRequestReviewActions from "./ChangeRequestReviewActions";

type ChangeRequestReviewProps = {
  store: ModerationStoreRef;
  request: AdminPendingStoreChangeRequest;
  locale: string;
};

/** Change-request review: the field-level diff (two-value drift cut), the requester comment, and apply / reject. */
export default async function ChangeRequestReview({ store, request, locale }: ChangeRequestReviewProps) {
  const t = await getTranslations({ locale, namespace: "admin.review" });
  const tQueue = await getTranslations({ locale, namespace: "admin.queue" });

  const drifted = request.storeDriftedSinceSubmission;

  return (
    <ReviewCard ariaLabel={`${tQueue("category.change_request")}: ${store.name}`}>
      <ReviewHeader
        eyebrowIcon={drifted ? TriangleAlert : GitCompare}
        eyebrowTone={drifted ? "warning" : "warm"}
        eyebrowLabel={tQueue("category.change_request")}
        title={store.name}
        meta={
          <StoreMetaChips
            store={store}
            locale={locale}
            extra={
              <>
                <Chip variant="warning">{tQueue("fieldsChanged", { count: request.fieldRows.length })}</Chip>
                {drifted && (
                  <Chip variant="warning" icon={<TriangleAlert className="size-3" aria-hidden />}>
                    {tQueue("driftTag")}
                  </Chip>
                )}
              </>
            }
          />
        }
      />

      {drifted && (
        <div className="border-border border-b px-5 py-4">
          <div className="flex gap-2.5 rounded-[var(--radius-md)] border [border-color:color-mix(in_oklch,var(--warning)_40%,transparent)] p-3 [background:color-mix(in_oklch,var(--warning)_8%,var(--surface))]">
            <TriangleAlert className="size-4 shrink-0 [color:var(--warning)]" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <strong className="text-text-primary text-sm">{t("drift.bannerTitle")}</strong>
              <span className="text-xs [color:var(--text-muted)]">{t("drift.bannerBody")}</span>
            </div>
          </div>
        </div>
      )}

      <ReviewSection title={t("change.sectionDiff")} icon={GitCompare}>
        <p className="text-xs [color:var(--text-muted)]">{t("change.listHint")}</p>
        {request.effectiveDiffEmpty && (
          <p className="rounded-[var(--radius-md)] border [border-color:color-mix(in_oklch,var(--warning)_40%,transparent)] p-2.5 text-xs [color:var(--warning)] [background:color-mix(in_oklch,var(--warning)_8%,var(--surface))]">
            {t("drift.nothingToApply")}
          </p>
        )}
        <FieldDiff fieldRows={request.fieldRows} storeDrifted={drifted} locale={locale} />
      </ReviewSection>

      <ReviewSection title={t("change.sectionComment")} icon={MessageSquare}>
        <p className="text-text-primary text-sm italic">
          {request.comment ? `“${request.comment}”` : t("change.noComment")}
        </p>
        <div className="flex items-center gap-1.5 text-xs [color:var(--text-muted)]">
          <User className="size-3.5 shrink-0" aria-hidden />
          <span>{t("proposedBy")}</span>
          <span className="text-text-secondary font-medium">@{request.requester.username}</span>
        </div>
      </ReviewSection>

      <ReviewActions>
        <ChangeRequestReviewActions slug={store.slug} locale={locale} changeRequestId={request.id} />
      </ReviewActions>
    </ReviewCard>
  );
}
