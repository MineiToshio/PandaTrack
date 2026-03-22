"use client";

import { PenSquare, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import IconButton from "@/components/core/IconButton";
import RatingStars from "@/components/core/RatingStars";
import Typography from "@/components/core/Typography";
import { Modal } from "@/components/modules/Modal";
import { POSTHOG_EVENTS } from "@/lib/constants";
import type { StoreViewerReview } from "@/queries/store";
import { deleteStoreReview } from "../_actions/deleteStoreReview";
import StoreReviewForm from "./StoreReviewForm";
import { useStoreReviewsState } from "./StoreReviewsStateProvider";

const REVIEWS_INCREMENT = 5;

type StorePublicReviewsSectionProps = {
  locale: string;
  storeSlug: string;
};

export default function StorePublicReviewsSection({ locale, storeSlug }: StorePublicReviewsSectionProps) {
  const t = useTranslations("stores");
  const tListing = useTranslations("storeListing");
  const { averageRating, reviewCount, reviews, viewerReview, applyOptimisticReviewDelete, applyOptimisticReviewSave } =
    useStoreReviewsState();
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [visibleReviewCount, setVisibleReviewCount] = useState(REVIEWS_INCREMENT);
  const [composerReviewSnapshot, setComposerReviewSnapshot] = useState<StoreViewerReview | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editingReviewSnapshot, setEditingReviewSnapshot] = useState<StoreViewerReview | null>(null);
  const [reviewIdToDelete, setReviewIdToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const hasViewerReview = viewerReview != null;
  const visibleReviews = reviews.slice(0, visibleReviewCount);
  const remainingReviewCount = Math.max(0, reviews.length - visibleReviewCount);
  const nextRevealCount = Math.min(REVIEWS_INCREMENT, remainingReviewCount);

  const closeComposer = () => {
    setIsComposerOpen(false);
    setComposerReviewSnapshot(null);
  };

  const closeEditForm = () => {
    setEditingReviewId(null);
    setEditingReviewSnapshot(null);
  };

  const openCreateForm = () => {
    setComposerReviewSnapshot(null);
    setIsComposerOpen(true);
  };

  const openEditForm = (reviewId: string) => {
    setEditingReviewId(reviewId);
    setEditingReviewSnapshot(viewerReview);
  };

  const openDeleteModal = (reviewId: string) => {
    setDeleteError(null);
    setReviewIdToDelete(reviewId);
  };

  const closeDeleteModal = () => setReviewIdToDelete(null);
  const handleShowMoreReviews = () =>
    setVisibleReviewCount((currentVisibleReviewCount) => currentVisibleReviewCount + REVIEWS_INCREMENT);

  const handleConfirmDeleteReview = () => {
    if (!reviewIdToDelete) return;
    startTransition(async () => {
      const optimisticDelete = applyOptimisticReviewDelete(reviewIdToDelete);
      const formData = new FormData();
      formData.set("reviewId", reviewIdToDelete);
      formData.set("locale", locale);
      const result = await deleteStoreReview(null, formData);
      setReviewIdToDelete(null);
      if (!result.success) {
        optimisticDelete.rollback();
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
          <div className="bg-muted/45 flex min-w-0 flex-row flex-nowrap items-center gap-2 rounded-2xl px-3 py-2">
            <div className="flex min-w-0 shrink-0 items-center gap-2">
              <RatingStars value={averageRating ?? 0} readOnly size="sm" ariaLabel={t("detail.reviews.title")} />
              <Typography size="sm" className="text-text-title shrink-0 font-semibold">
                {averageRating != null ? averageRating.toFixed(1) : t("detail.reviews.noAverage")}
              </Typography>
            </div>
            <Typography size="xs" className="text-text-muted min-w-0 truncate">
              {tListing("ratingCount", { count: reviewCount })}
            </Typography>
          </div>

          {!hasViewerReview && !isComposerOpen && (
            <Button type="button" variant="ghost" size="sm" onClick={openCreateForm}>
              {t("detail.reviews.form.openCreateCta")}
            </Button>
          )}
        </div>
      </div>

      {isComposerOpen && (
        <StoreReviewForm
          key="create-review"
          locale={locale}
          storeSlug={storeSlug}
          existingReview={composerReviewSnapshot}
          onCancel={closeComposer}
          onSaved={closeComposer}
          onOptimisticSave={applyOptimisticReviewSave}
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
        closeButtonLabel={t("detail.reviews.form.cancelCta")}
        className="max-w-xl"
      >
        <div className="space-y-5">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              ref={cancelDeleteRef}
              type="button"
              variant="secondary"
              onClick={closeDeleteModal}
              disabled={isPending}
              className="min-h-11 px-5"
            >
              {t("detail.reviews.form.cancelCta")}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirmDeleteReview}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-11 px-5"
            >
              {t("detail.reviews.form.deleteConfirmCta")}
            </Button>
          </div>
        </div>
      </Modal>

      {deleteError && (
        <Typography size="sm" className="text-destructive mt-3" role="alert">
          {t(`detail.reviews.form.errors.${deleteError}`)}
        </Typography>
      )}

      {reviews.length > 0 ? (
        <ul className="mt-5 space-y-3" role="list">
          {visibleReviews.map((review) => {
            const isEditingThis = editingReviewId === review.id;

            if (isEditingThis && review.isViewerReview && editingReviewSnapshot) {
              return (
                <li key={review.id}>
                  <StoreReviewForm
                    key={`edit-${review.id}`}
                    locale={locale}
                    storeSlug={storeSlug}
                    existingReview={editingReviewSnapshot}
                    onCancel={closeEditForm}
                    onSaved={closeEditForm}
                    onOptimisticSave={applyOptimisticReviewSave}
                  />
                </li>
              );
            }

            const reviewUpdatedAt = new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
            }).format(review.updatedAt);

            return (
              <li key={review.id} className="bg-muted/35 rounded-2xl border border-transparent p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
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
                    <div className="hidden shrink-0 items-center gap-2 lg:flex">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 gap-2 px-4"
                        aria-label={t("detail.reviews.form.openEditCta")}
                        posthogEvent={POSTHOG_EVENTS.STORE.REVIEW_EDIT_CLICKED}
                        onClick={() => openEditForm(review.id)}
                        disabled={isPending || reviewIdToDelete != null}
                      >
                        <PenSquare className="size-4 shrink-0" aria-hidden />
                        {t("detail.reviews.form.editVisibleCta")}
                      </Button>
                      <IconButton
                        Icon={Trash2}
                        variant="outline"
                        size="md"
                        iconClassName="text-destructive group-hover/icon-button:text-destructive"
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

                {review.isViewerReview && (
                  <div className="border-border/60 mt-4 grid grid-cols-2 gap-2 border-t pt-3 lg:hidden">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 justify-center gap-2"
                      aria-label={t("detail.reviews.form.openEditCta")}
                      posthogEvent={POSTHOG_EVENTS.STORE.REVIEW_EDIT_CLICKED}
                      onClick={() => openEditForm(review.id)}
                      disabled={isPending || reviewIdToDelete != null}
                    >
                      <PenSquare className="size-4 shrink-0" aria-hidden />
                      {t("detail.reviews.form.editVisibleCta")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:border-destructive/50 hover:bg-destructive/8 hover:text-destructive min-h-11 justify-center gap-2"
                      aria-label={t("detail.reviews.form.deleteCta")}
                      onClick={() => openDeleteModal(review.id)}
                      disabled={isPending || reviewIdToDelete != null}
                    >
                      <Trash2 className="size-4 shrink-0" aria-hidden />
                      {t("detail.reviews.form.deleteConfirmCta")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Typography size="sm" className="text-text-muted mt-5">
          {t("detail.reviews.empty")}
        </Typography>
      )}

      {remainingReviewCount > 0 && (
        <div className="mt-4 flex justify-center">
          <Button type="button" variant="ghost" size="sm" onClick={handleShowMoreReviews}>
            {t("detail.reviews.showMoreCta", { count: nextRevealCount })}
          </Button>
        </div>
      )}
    </section>
  );
}
