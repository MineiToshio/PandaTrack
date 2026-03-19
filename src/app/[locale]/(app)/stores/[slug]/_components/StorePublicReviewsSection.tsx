"use client";

import { PenSquare, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import IconButton from "@/components/core/IconButton";
import RatingStars from "@/components/core/RatingStars";
import Typography from "@/components/core/Typography";
import { Modal } from "@/components/modules/Modal";
import { cn } from "@/lib/styles";
import type { PublicStoreReview, StoreViewerReview } from "@/queries/store";
import { deleteStoreReview } from "../_actions/deleteStoreReview";
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
  const router = useRouter();
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [reviewIdToDelete, setReviewIdToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const hasViewerReview = viewerReview != null;

  const closeEditForm = () => setEditingReviewId(null);

  const openDeleteModal = (reviewId: string) => {
    setDeleteError(null);
    setReviewIdToDelete(reviewId);
  };

  const closeDeleteModal = () => setReviewIdToDelete(null);

  const handleConfirmDeleteReview = () => {
    if (!reviewIdToDelete) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("reviewId", reviewIdToDelete);
      formData.set("locale", locale);
      const result = await deleteStoreReview(null, formData);
      setReviewIdToDelete(null);
      if (result.success) {
        router.refresh();
      } else {
        setDeleteError(result.error);
      }
    });
  };

  return (
    <section className="bg-background/70 rounded-3xl p-5 shadow-sm sm:p-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
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

        <div className="flex min-w-0 shrink-0 flex-col items-start gap-3 sm:items-end">
          <div
            className={cn(
              "bg-muted/45 rounded-2xl px-3 py-2",
              "flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2",
            )}
          >
            <div className="flex items-center gap-2">
              <RatingStars value={averageRating ?? 0} readOnly size="sm" ariaLabel={t("detail.reviews.title")} />
              <Typography size="sm" className="text-text-title font-semibold">
                {averageRating != null ? averageRating.toFixed(1) : t("detail.reviews.noAverage")}
              </Typography>
            </div>
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

      <Modal
        isOpen={reviewIdToDelete != null}
        onClose={closeDeleteModal}
        title={t("detail.reviews.form.deleteConfirmModalTitle")}
        description={t("detail.reviews.form.deleteConfirmModalDescription")}
        role="alertdialog"
        closeOnBackdropClick={false}
        initialFocusRef={cancelDeleteRef}
      >
        <div className="flex flex-wrap gap-2">
          <Button
            ref={cancelDeleteRef}
            type="button"
            variant="secondary"
            onClick={closeDeleteModal}
            disabled={isPending}
          >
            {t("detail.reviews.form.cancelCta")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleConfirmDeleteReview}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t("detail.reviews.form.deleteConfirmCta")}
          </Button>
        </div>
      </Modal>

      {deleteError && (
        <Typography size="sm" className="text-destructive mt-3" role="alert">
          {t(`detail.reviews.form.errors.${deleteError}`)}
        </Typography>
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
                    <div className="flex shrink-0 items-center gap-1">
                      <IconButton
                        Icon={PenSquare}
                        size="sm"
                        aria-label={t("detail.reviews.form.openEditCta")}
                        onClick={() => setEditingReviewId(review.id)}
                        disabled={isPending || reviewIdToDelete != null}
                      />
                      <IconButton
                        Icon={Trash2}
                        size="sm"
                        aria-label={t("detail.reviews.form.deleteCta")}
                        onClick={() => openDeleteModal(review.id)}
                        disabled={isPending || reviewIdToDelete != null}
                      />
                    </div>
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
