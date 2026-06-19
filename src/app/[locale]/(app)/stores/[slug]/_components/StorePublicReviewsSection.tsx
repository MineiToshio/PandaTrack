"use client";

import { PenSquare, Trash2 } from "lucide-react";
import { type FormEvent, useMemo, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import Avatar from "@/components/core/Avatar";
import Button from "@/components/core/Button/Button";
import IconButton from "@/components/core/IconButton";
import RatingStars from "@/components/core/RatingStars";
import StarRating from "@/components/core/StarRating";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import { Modal } from "@/components/modules/Modal";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { PublicStoreReview, StoreViewerReview } from "@/queries/store";
import { deleteStoreReview } from "../_actions/deleteStoreReview";
import { saveStoreReview, type SavedStoreReview } from "../_actions/saveStoreReview";
import StoreReviewForm from "./StoreReviewForm";
import { useStoreReviewsState } from "./StoreReviewsStateProvider";

const PREVIEW_REVIEW_COUNT = 4;

type StorePublicReviewsSectionProps = {
  locale: string;
  storeSlug: string;
};

/**
 * Public reviews block for the store detail page.
 * Visual contract: see the Stores prototype at `docs/product/prd-02-collector-app/frd-04-store-domain/prototype/store-domain.html`
 * and the Velvet design system at `docs/design/`. Reviews subcards:
 *   - Big aggregate header (38px number + 20px stars + count copy).
 *   - Inline accent-tinted composer when the viewer hasn't reviewed yet.
 *   - "Tu reseña" eyebrow + accent-tinted card pinning the viewer's review at the top.
 *   - Plain row markup for community reviews (avatar + author + stars + body).
 *   - Single "Ver todas las N reseñas" CTA → expands to show all remaining.
 *
 * Designed to live inside `<CollapsibleSection eyebrow="Reseñas">` (no outer card chrome).
 */
export default function StorePublicReviewsSection({ locale, storeSlug }: StorePublicReviewsSectionProps) {
  const t = useTranslations("stores");
  const { averageRating, reviewCount, reviews, viewerReview, applyOptimisticReviewDelete, applyOptimisticReviewSave } =
    useStoreReviewsState();
  const [showAll, setShowAll] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editingReviewSnapshot, setEditingReviewSnapshot] = useState<StoreViewerReview | null>(null);
  const [reviewIdToDelete, setReviewIdToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasViewerReview = viewerReview != null;

  // Split reviews: viewer's review (pinned) + community reviews (the rest).
  const { viewerReviewItem, communityReviews } = useMemo(() => {
    const viewer = reviews.find((r) => r.isViewerReview) ?? null;
    const community = reviews.filter((r) => !r.isViewerReview);
    return { viewerReviewItem: viewer, communityReviews: community };
  }, [reviews]);

  const visibleCommunityReviews = showAll ? communityReviews : communityReviews.slice(0, PREVIEW_REVIEW_COUNT);
  const remainingCommunityCount = Math.max(0, communityReviews.length - visibleCommunityReviews.length);

  const closeEditForm = () => {
    setEditingReviewId(null);
    setEditingReviewSnapshot(null);
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

  const handleShowAll = () => setShowAll(true);

  const showInlineComposer = !hasViewerReview;

  return (
    <div className="space-y-4">
      {/* Big aggregate header */}
      <ReviewsAggregateHeader averageRating={averageRating} reviewCount={reviewCount} />

      {/* Inline composer when viewer hasn't reviewed yet — compact accent-tinted card per HTML mockup */}
      {showInlineComposer && (
        <InlineReviewComposer locale={locale} storeSlug={storeSlug} onOptimisticSave={applyOptimisticReviewSave} />
      )}

      {/* Pinned viewer review at top */}
      {viewerReviewItem && !showInlineComposer && (
        <div className="space-y-2">
          <span className="block [font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] [font-weight:var(--font-weight-mono)] [letter-spacing:0.06em] [color:var(--accent)] uppercase">
            {t("detail.reviews.yourReviewBadge")}
          </span>
          <ReviewCard
            review={viewerReviewItem}
            isViewer
            isEditingThis={editingReviewId === viewerReviewItem.id && editingReviewSnapshot != null}
            editingSnapshot={editingReviewSnapshot}
            locale={locale}
            storeSlug={storeSlug}
            onOpenEdit={() => openEditForm(viewerReviewItem.id)}
            onOpenDelete={() => openDeleteModal(viewerReviewItem.id)}
            onCancelEdit={closeEditForm}
            onSavedEdit={closeEditForm}
            onOptimisticSave={applyOptimisticReviewSave}
            disableActions={isPending || reviewIdToDelete != null}
          />
        </div>
      )}

      {/* Community reviews — flat rows with bottom dividers per HTML `.review-row` */}
      {communityReviews.length > 0 ? (
        <ul role="list">
          {visibleCommunityReviews.map((review, index) => (
            <li
              key={review.id}
              className={cn(
                "py-3.5",
                index < visibleCommunityReviews.length - 1 && "[border-bottom:1px_solid_var(--border)]",
              )}
            >
              <ReviewCard
                review={review}
                locale={locale}
                storeSlug={storeSlug}
                disableActions={isPending || reviewIdToDelete != null}
              />
            </li>
          ))}
        </ul>
      ) : reviewCount === 0 ? (
        <Typography size="sm" className="text-text-muted text-center">
          {t("redesign.detail.reviewsHeader.beTheFirst")}
        </Typography>
      ) : null}

      {/* "Ver todas las N reseñas" CTA — full-width ghost per HTML `btn ghost full` */}
      {remainingCommunityCount > 0 && (
        <Button type="button" variant="ghost" onClick={handleShowAll} fullWidth>
          {t("redesign.detail.reviewsHeader.viewAll", { count: reviewCount })}
        </Button>
      )}

      {/* Delete confirmation */}
      <Modal
        isOpen={reviewIdToDelete != null}
        onClose={closeDeleteModal}
        title={t("detail.reviews.form.deleteConfirmModalTitle")}
        description={t("detail.reviews.form.deleteConfirmModalDescription")}
        icon={<Trash2 size={20} aria-hidden="true" />}
        tone="destructive"
        role="alertdialog"
        dismissible={false}
        primaryAction={{
          label: t("detail.reviews.form.deleteConfirmCta"),
          onClick: handleConfirmDeleteReview,
          variant: "destructive",
          loading: isPending,
          disabled: isPending,
        }}
        secondaryAction={{
          label: t("detail.reviews.form.cancelCta"),
          onClick: closeDeleteModal,
          disabled: isPending,
        }}
      />

      {deleteError && (
        <Typography size="sm" className="text-destructive" role="alert">
          {t(`detail.reviews.form.errors.${deleteError}`)}
        </Typography>
      )}
    </div>
  );
}

// ─── Aggregate header ─────────────────────────────────────────────────────────

type ReviewsAggregateHeaderProps = {
  averageRating: number | null | undefined;
  reviewCount: number;
};

function ReviewsAggregateHeader({ averageRating, reviewCount }: ReviewsAggregateHeaderProps) {
  const t = useTranslations("stores");
  const tListing = useTranslations("storeListing");
  const isMissing = averageRating == null;

  return (
    <div className="flex items-center gap-4 pb-3.5 [border-bottom:1px_solid_var(--border)]">
      <span
        className={cn(
          "[font-size:38px] [line-height:1] [font-weight:700] tabular-nums",
          isMissing ? "[color:var(--text-muted)]" : "[color:var(--text-primary)]",
        )}
      >
        {isMissing ? t("redesign.detail.reviewsHeader.noAverage") : averageRating.toFixed(1)}
      </span>
      <div className="flex flex-col gap-1">
        {isMissing ? (
          <span className="[font-size:20px] [color:var(--text-muted)]" aria-hidden="true">
            ★★★★★
          </span>
        ) : (
          <StarRating value={averageRating} size={20} />
        )}
        <span className="[font-size:12px] [color:var(--text-muted)]">
          {reviewCount > 0
            ? tListing("ratingCount", { count: reviewCount })
            : t("redesign.detail.reviewsHeader.totalCount", { count: 0 })}
        </span>
      </div>
    </div>
  );
}

// ─── Review card ──────────────────────────────────────────────────────────────

type ReviewCardProps = {
  review: PublicStoreReview;
  locale: string;
  storeSlug: string;
  isViewer?: boolean;
  isEditingThis?: boolean;
  editingSnapshot?: StoreViewerReview | null;
  onOpenEdit?: () => void;
  onOpenDelete?: () => void;
  onCancelEdit?: () => void;
  onSavedEdit?: () => void;
  onOptimisticSave?: (draft: { overallRating: number; comment: string | null }) => {
    commit: (review: import("../_actions/saveStoreReview").SavedStoreReview) => void;
    rollback: () => void;
  };
  disableActions?: boolean;
};

function ReviewCard({
  review,
  locale,
  storeSlug,
  isViewer = false,
  isEditingThis = false,
  editingSnapshot,
  onOpenEdit,
  onOpenDelete,
  onCancelEdit,
  onSavedEdit,
  onOptimisticSave,
  disableActions,
}: ReviewCardProps) {
  const t = useTranslations("stores");

  const updatedLabel = useMemo(() => {
    const updatedAt = review.updatedAt instanceof Date ? review.updatedAt : new Date(review.updatedAt);
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(updatedAt);
  }, [locale, review.updatedAt]);

  if (isEditingThis && editingSnapshot) {
    return (
      <StoreReviewForm
        key={`edit-${review.id}`}
        locale={locale}
        storeSlug={storeSlug}
        existingReview={editingSnapshot}
        onCancel={onCancelEdit}
        onSaved={onSavedEdit}
        onOptimisticSave={onOptimisticSave}
      />
    );
  }

  const authorName = review.authorName || t("detail.reviews.anonymousAuthor");

  return (
    <article
      className={cn(
        "flex gap-3",
        isViewer &&
          "rounded-lg p-2.5 [background:color-mix(in_oklch,var(--accent)_5%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--accent)_15%,transparent)]",
      )}
    >
      <Avatar user={{ name: isViewer ? t("detail.reviews.youLabel") : authorName }} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="[font-size:13px] [font-weight:600] [color:var(--text-primary)]">
            {isViewer ? t("detail.reviews.youLabel") : authorName}
          </span>
          <RatingStars value={review.overallRating} readOnly size="sm" />
          <span className="[font-size:11px] [color:var(--text-muted)]">{updatedLabel}</span>
          {/* "link" variant is legacy — tertiary actions use "ghost" (playbook §1) */}
          {isViewer && onOpenEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={onOpenEdit}
              disabled={disableActions}
              posthogEvent={POSTHOG_EVENTS.STORE.REVIEW_EDIT_CLICKED}
              leadingIcon={<PenSquare size={14} aria-hidden="true" />}
            >
              {t("detail.reviews.form.editVisibleCta")}
            </Button>
          )}
          {isViewer && onOpenDelete && (
            <IconButton
              Icon={Trash2}
              variant="ghost"
              size="sm"
              iconClassName="text-destructive"
              aria-label={t("detail.reviews.form.deleteCta")}
              onClick={onOpenDelete}
              disabled={disableActions}
            />
          )}
        </div>
        <p className="mt-0.5 [font-size:13px] [line-height:1.5] whitespace-pre-line [color:var(--text-secondary)]">
          {review.comment || t("detail.reviews.noComment")}
        </p>
      </div>
    </article>
  );
}

// ─── Compact inline composer (HTML mockup variant) ────────────────────────────

type InlineReviewComposerProps = {
  locale: string;
  storeSlug: string;
  onOptimisticSave?: (draft: { overallRating: number; comment: string | null }) => {
    commit: (review: SavedStoreReview) => void;
    rollback: () => void;
  };
};

/**
 * Compact accent-tinted review composer (see the Stores prototype at
 * `docs/product/prd-02-collector-app/frd-04-store-domain/prototype/store-domain.html`):
 *   - Small heading "Comparte tu reseña pública"
 *   - Click-to-rate stars
 *   - 2-row textarea with placeholder
 *   - Right-aligned small primary submit
 *
 * Reuses the `saveStoreReview` action and the parent's optimistic-save callback so the
 * pinned-viewer-review state updates without a server round trip.
 */
function InlineReviewComposer({ locale, storeSlug, onOptimisticSave }: InlineReviewComposerProps) {
  const t = useTranslations("stores");
  const formRef = useRef<HTMLFormElement | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formRef.current) return;
    if (ratingValue <= 0) {
      setErrorKey("ratingRequired");
      return;
    }

    const formData = new FormData(formRef.current);
    const rawComment = formData.get("comment");
    const comment = typeof rawComment === "string" ? rawComment.trim() || null : null;
    const optimisticController = onOptimisticSave?.({ overallRating: ratingValue, comment });

    flushSync(() => {
      setIsPending(true);
      setErrorKey(null);
    });

    try {
      const result = await saveStoreReview(null, formData);
      if (result.success) {
        optimisticController?.commit(result.review);
        // Parent state will swap this composer for the pinned viewer review on next render.
      } else {
        optimisticController?.rollback();
        setErrorKey(result.error ?? "saveReviewFailed");
      }
    } catch {
      optimisticController?.rollback();
      setErrorKey("saveReviewFailed");
    } finally {
      setIsPending(false);
    }
  };

  const errorMessage =
    errorKey && t.has(`detail.reviews.form.errors.${errorKey}`)
      ? t(`detail.reviews.form.errors.${errorKey}`)
      : errorKey
        ? t("error.validation_failed")
        : null;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      aria-busy={isPending}
      className="rounded-[10px] p-3 [background:color-mix(in_oklch,var(--accent)_5%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--accent)_15%,transparent)]"
    >
      <input type="hidden" name="slug" value={storeSlug} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="overallRating" value={ratingValue > 0 ? ratingValue : ""} />

      <div className="[font-size:12px] [font-weight:600] [color:var(--text-secondary)]">
        {t("detail.reviews.form.title")}
      </div>

      <div className="mt-2">
        <RatingStars
          value={ratingValue}
          onChange={(next) => {
            setRatingValue(next);
            if (errorKey === "ratingRequired") setErrorKey(null);
          }}
          size="md"
          disabled={isPending}
          ariaLabel={t("detail.reviews.form.ratingLabel")}
        />
      </div>

      <Textarea
        id="store-public-review-comment"
        name="comment"
        rows={2}
        maxLength={1000}
        disabled={isPending}
        placeholder={t("redesign.detail.writeReviewPlaceholder")}
        className="mt-2.5 resize-y"
      />

      {errorMessage && (
        <Typography size="xs" className="text-destructive mt-2" role="alert">
          {errorMessage}
        </Typography>
      )}

      <div className="mt-2 flex justify-end">
        <Button type="submit" variant="primary" size="sm" loading={isPending} disabled={isPending}>
          {t("redesign.detail.publishReview")}
        </Button>
      </div>
    </form>
  );
}
