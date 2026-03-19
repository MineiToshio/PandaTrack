"use client";

import { PenSquare } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import IconButton from "@/components/core/IconButton";
import RatingStars from "@/components/core/RatingStars";
import Typography from "@/components/core/Typography";
import type { PublicStoreReview, StoreViewerReview } from "@/queries/store";
import StoreReviewForm from "./StoreReviewForm";

type StorePublicReviewsSectionProps = {
  locale: string;
  storeSlug: string;
  averageRating: number | null;
  reviewCount: number;
  reviews: PublicStoreReview[];
  viewerReview: StoreViewerReview | null;
};

export default function StorePublicReviewsSection({
  locale,
  storeSlug,
  averageRating,
  reviewCount,
  reviews,
  viewerReview,
}: StorePublicReviewsSectionProps) {
  const t = useTranslations("stores");
  const tListing = useTranslations("storeListing");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const hasViewerReview = viewerReview != null;

  const closeEditForm = () => setEditingReviewId(null);

  return (
    <section className="bg-background/70 rounded-3xl p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <Typography size="xs" className="text-text-muted">
            {t("detail.reviews.eyebrow")}
          </Typography>
          <Typography size="sm" className="text-text-title font-semibold">
            {t("detail.reviews.title")}
          </Typography>
          <Typography size="sm" className="text-text-muted">
            {t("detail.reviews.description")}
          </Typography>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="bg-muted/45 inline-flex items-center gap-2 rounded-2xl px-3 py-2">
            <RatingStars value={averageRating ?? 0} readOnly size="sm" ariaLabel={t("detail.reviews.title")} />
            <Typography size="sm" className="text-text-title font-semibold">
              {averageRating != null ? averageRating.toFixed(1) : t("detail.reviews.noAverage")}
            </Typography>
            <Typography size="xs" className="text-text-muted">
              {tListing("ratingCount", { count: reviewCount })}
            </Typography>
          </div>

          {!hasViewerReview && !isComposerOpen && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsComposerOpen(true)}>
              {t("detail.reviews.form.openCreateCta")}
            </Button>
          )}
        </div>
      </div>

      {isComposerOpen && (
        <StoreReviewForm
          key={viewerReview ? `${viewerReview.updatedAt.toISOString()}-${viewerReview.overallRating}` : "new-review"}
          locale={locale}
          storeSlug={storeSlug}
          existingReview={viewerReview}
          onCancel={() => setIsComposerOpen(false)}
          onSaved={() => setIsComposerOpen(false)}
        />
      )}

      {reviews.length > 0 ? (
        <ul className="mt-5 space-y-3" role="list">
          {reviews.map((review) => {
            const isEditingThis = editingReviewId === review.id;

            if (isEditingThis && review.isViewerReview && viewerReview) {
              return (
                <li key={review.id}>
                  <StoreReviewForm
                    key={`edit-${review.id}-${viewerReview.updatedAt.toISOString()}`}
                    locale={locale}
                    storeSlug={storeSlug}
                    existingReview={viewerReview}
                    onCancel={closeEditForm}
                    onSaved={closeEditForm}
                  />
                </li>
              );
            }

            const reviewUpdatedAt = new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
            }).format(review.updatedAt);

            return (
              <li key={review.id} className="bg-muted/35 rounded-2xl border border-transparent p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Typography size="sm" className="text-text-title font-semibold">
                        {review.authorName || t("detail.reviews.anonymousAuthor")}
                      </Typography>
                      {review.isViewerReview && (
                        <span className="bg-background text-text-body inline-flex rounded-full px-2 py-1 text-xs font-medium">
                          {t("detail.reviews.yourReviewBadge")}
                        </span>
                      )}
                      <Typography size="xs" className="text-text-muted">
                        {reviewUpdatedAt}
                      </Typography>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <RatingStars value={review.overallRating} readOnly size="sm" />
                      <Typography size="xs" className="text-text-muted">
                        {t("detail.reviews.ratingBadge", { rating: review.overallRating })}
                      </Typography>
                    </div>
                  </div>

                  {review.isViewerReview && (
                    <IconButton
                      Icon={PenSquare}
                      size="sm"
                      aria-label={t("detail.reviews.form.openEditCta")}
                      onClick={() => setEditingReviewId(review.id)}
                    />
                  )}
                </div>

                <Typography size="sm" className="text-text-body mt-3 whitespace-pre-line">
                  {review.comment || t("detail.reviews.noComment")}
                </Typography>
              </li>
            );
          })}
        </ul>
      ) : (
        <Typography size="sm" className="text-text-muted mt-5">
          {t("detail.reviews.empty")}
        </Typography>
      )}
    </section>
  );
}
