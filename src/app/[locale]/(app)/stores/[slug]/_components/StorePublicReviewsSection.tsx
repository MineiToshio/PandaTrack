"use client";

import { PenSquare, Star, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import IconButton from "@/components/core/IconButton";
import RatingStars from "@/components/core/RatingStars";
import Typography from "@/components/core/Typography";
import { Modal } from "@/components/modules/Modal";
import { POSTHOG_EVENTS } from "@/lib/constants";
import type { StoreViewerReview } from "@/queries/store";
import SectionSurfaceCard from "@/components/modules/SectionSurfaceCard";
import { deleteStoreReview } from "../_actions/deleteStoreReview";
import StoreReviewForm from "./StoreReviewForm";
import { useStoreReviewsState } from "./StoreReviewsStateProvider";

const REVIEWS_INCREMENT = 5;

type StoreReviewsWriteCtaProps = {
  onClick: () => void;
  /** `ghost` reads as a text link; `outline` reads as a button (desktop). */
  variant?: "ghost" | "outline";
};

function StoreReviewsWriteCta({ onClick, variant = "outline" }: StoreReviewsWriteCtaProps) {
  const t = useTranslations("stores");
  return (
    <Button
      type="button"
      variant={variant}
      size="md"
      className="min-h-11 shrink-0 gap-2"
      posthogEvent={POSTHOG_EVENTS.STORE.REVIEW_WRITE_CLICKED}
      onClick={onClick}
    >
      <PenSquare className="size-4 shrink-0" aria-hidden />
      {t("detail.reviews.form.openCreateCta")}
    </Button>
  );
}

function StoreReviewsTitleBlock() {
  const t = useTranslations("stores");
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Star className="text-accent size-4 shrink-0" aria-hidden />
      <h2 id="section-store-reviews" className="text-text-title text-sm leading-tight font-semibold sm:text-base">
        {t("detail.reviews.title")}
      </h2>
    </div>
  );
}

type StoreReviewsRatingSummaryProps = {
  averageRating: number | null | undefined;
  reviewCount: number;
};

function StoreReviewsRatingSummary({ averageRating, reviewCount }: StoreReviewsRatingSummaryProps) {
  const t = useTranslations("stores");
  const tListing = useTranslations("storeListing");
  return (
    <div className="bg-primary/8 border-primary/20 flex max-w-full min-w-0 flex-row flex-nowrap items-center gap-2 rounded-2xl border px-3 py-2">
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <RatingStars value={averageRating ?? 0} readOnly size="sm" ariaLabel={t("detail.reviews.title")} />
        <Typography size="sm" className="text-text-body shrink-0">
          {averageRating != null ? averageRating.toFixed(1) : t("detail.reviews.noAverage")}
        </Typography>
      </div>
      <Typography size="xs" className="text-text-muted min-w-0 truncate">
        {tListing("ratingCount", { count: reviewCount })}
      </Typography>
    </div>
  );
}

type StorePublicReviewsSectionProps = {
  locale: string;
  storeSlug: string;
};

export default function StorePublicReviewsSection({ locale, storeSlug }: StorePublicReviewsSectionProps) {
  const t = useTranslations("stores");
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

  const showWriteReviewCta = !hasViewerReview && !isComposerOpen;

  return (
    <SectionSurfaceCard
      headerStart={<StoreReviewsTitleBlock />}
      headerEnd={
        showWriteReviewCta ? (
          <div className="hidden shrink-0 lg:block">
            <StoreReviewsWriteCta variant="outline" onClick={openCreateForm} />
          </div>
        ) : null
      }
    >
      <div className="space-y-3">
        <Typography size="sm" className="text-text-muted max-w-2xl">
          {t("detail.reviews.description")}
        </Typography>
      </div>

      <div className="flex min-w-0 flex-row flex-wrap items-center gap-3">
        <div className="w-fit max-w-full">
          <StoreReviewsRatingSummary averageRating={averageRating} reviewCount={reviewCount} />
        </div>
        {showWriteReviewCta ? (
          <div className="lg:hidden">
            <StoreReviewsWriteCta variant="ghost" onClick={openCreateForm} />
          </div>
        ) : null}
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
              <li
                key={review.id}
                className="bg-muted/35 border-border/50 border-l-highlight/45 rounded-2xl border border-l-4 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Typography as="span" size="sm" className="text-text-body">
                        {review.authorName || t("detail.reviews.anonymousAuthor")}
                      </Typography>
                      {review.isViewerReview && (
                        <span className="bg-background text-text-body inline-flex items-center rounded-lg px-2 py-1 text-xs leading-none font-medium">
                          {t("detail.reviews.yourReviewBadge")}
                        </span>
                      )}
                      <Typography as="span" size="xs" className="text-text-muted">
                        {reviewUpdatedAt}
                      </Typography>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <RatingStars value={review.overallRating} readOnly size="sm" />
                      <Typography as="span" size="xs" className="text-text-muted">
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
    </SectionSurfaceCard>
  );
}
