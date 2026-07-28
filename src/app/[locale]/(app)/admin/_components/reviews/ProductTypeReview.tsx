import { getTranslations } from "next-intl/server";
import { MessageSquare, Sparkles, Tag, User } from "lucide-react";
import type { AdminPendingStoreProductTypeRequest } from "@/lib/data/admin/adminStoreProductTypeRequestQueries";
import { ReviewCard, ReviewHeader, ReviewHint, ReviewSection } from "../ReviewShell";
import ProductTypeReviewForm from "./ProductTypeReviewForm";

type ProductTypeReviewProps = {
  request: AdminPendingStoreProductTypeRequest;
  locale: string;
};

/** Product-type suggestion review: requester and reason, plus the editable catalog form (approve / reject). */
export default async function ProductTypeReview({ request, locale }: ProductTypeReviewProps) {
  const t = await getTranslations({ locale, namespace: "admin.review" });
  const tQueue = await getTranslations({ locale, namespace: "admin.queue" });

  return (
    <ReviewCard ariaLabel={`${tQueue("category.product_type")}: ${request.suggestedName}`}>
      <ReviewHeader
        eyebrowIcon={Tag}
        eyebrowTone="cool"
        eyebrowLabel={tQueue("category.product_type")}
        title={request.suggestedName}
      />
      <ReviewSection title={t("type.sectionReason")} icon={MessageSquare}>
        <p className="text-text-primary text-sm italic">
          {request.reason ? `“${request.reason}”` : t("type.noReason")}
        </p>
        <div className="flex items-center gap-1.5 text-xs [color:var(--text-muted)]">
          <User className="size-3.5 shrink-0" aria-hidden />
          <span>{t("proposedBy")}</span>
          <span className="text-text-secondary font-medium">@{request.requester.username}</span>
        </div>
      </ReviewSection>
      <ReviewSection title={t("type.sectionCatalog")} icon={Sparkles}>
        <ProductTypeReviewForm
          requestId={request.id}
          locale={locale}
          suggestedName={request.suggestedName}
          suggestedKeySlug={request.suggestedKeySlug}
        />
      </ReviewSection>
      <ReviewHint>{t("type.catalogHint")}</ReviewHint>
    </ReviewCard>
  );
}
