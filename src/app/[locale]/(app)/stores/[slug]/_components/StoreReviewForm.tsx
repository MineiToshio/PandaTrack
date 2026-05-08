"use client";

import { type FormEvent, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Label from "@/components/core/Label";
import RatingStars from "@/components/core/RatingStars";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import SectionTitleWithAccent from "@/components/modules/SectionTitleWithAccent";
import type { StoreViewerReview } from "@/queries/store";
import { saveStoreReview, type SaveStoreReviewResult, type SavedStoreReview } from "../_actions/saveStoreReview";

type StoreReviewFormProps = {
  locale: string;
  storeSlug: string;
  existingReview: StoreViewerReview | null;
  onCancel?: () => void;
  onSaved?: (review: SavedStoreReview) => void;
  onOptimisticSave?: (draft: { overallRating: number; comment: string | null }) => {
    commit: (review: SavedStoreReview) => void;
    rollback: () => void;
  };
};

function translateReviewError(t: ReturnType<typeof useTranslations>, errorKey: string) {
  return t.has(`detail.reviews.form.errors.${errorKey}`)
    ? t(`detail.reviews.form.errors.${errorKey}`)
    : t("error.validation_failed");
}

export default function StoreReviewForm({
  locale,
  storeSlug,
  existingReview,
  onCancel,
  onSaved,
  onOptimisticSave,
}: StoreReviewFormProps) {
  const t = useTranslations("stores");
  const [isPending, setIsPending] = useState(false);
  const [state, setState] = useState<SaveStoreReviewResult | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [ratingValue, setRatingValue] = useState(existingReview?.overallRating ?? 0);
  const startedAsEditRef = useRef(existingReview != null);

  const fieldErrors = state?.success === false ? state.fieldErrors : undefined;
  const overallRatingError = fieldErrors?.overallRating?.[0];
  const commentError = fieldErrors?.comment?.[0];
  const formError = !state?.success ? state?.error : null;
  const updatedAtLabel = existingReview
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(existingReview.updatedAt)
    : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formRef.current) {
      return;
    }

    const formData = new FormData(formRef.current);
    const rawComment = formData.get("comment");
    const comment = typeof rawComment === "string" ? rawComment.trim() || null : null;
    const optimisticController =
      ratingValue > 0
        ? onOptimisticSave?.({
            overallRating: ratingValue,
            comment,
          })
        : null;

    flushSync(() => {
      setIsPending(true);
    });

    try {
      const result = await saveStoreReview(null, formData);
      if (result.success) {
        optimisticController?.commit(result.review);
        onSaved?.(result.review);
      } else {
        optimisticController?.rollback();
      }
      setState(result);
    } catch {
      optimisticController?.rollback();
      setState({ success: false, error: "saveReviewFailed" });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="bg-muted/35 mt-5 space-y-4 rounded-2xl p-4 sm:p-5"
      aria-busy={isPending}
    >
      <input type="hidden" name="slug" value={storeSlug} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="overallRating" value={ratingValue > 0 ? ratingValue : ""} />

      <div className="space-y-1">
        <SectionTitleWithAccent as="h3">{t("detail.reviews.form.title")}</SectionTitleWithAccent>
        <Typography size="sm" className="text-text-muted">
          {t("detail.reviews.form.description")}
        </Typography>
      </div>

      <div>
        <Label color="title" spacing="tight">
          {t("detail.reviews.form.ratingLabel")}
        </Label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <RatingStars
            value={ratingValue}
            onChange={setRatingValue}
            size="lg"
            disabled={isPending}
            ariaLabel={t("detail.reviews.form.ratingLabel")}
          />
          <Typography size="sm" className="text-text-body font-medium">
            {ratingValue > 0
              ? t("detail.reviews.form.ratingSelected", { rating: ratingValue })
              : t("detail.reviews.form.ratingPlaceholder")}
          </Typography>
        </div>
        <Typography size="xs" className="text-text-muted mt-2 lg:hidden">
          {t("detail.reviews.form.ratingHelper")}
        </Typography>
        {overallRatingError && (
          <Typography size="xs" className="text-destructive mt-1" role="alert">
            {translateReviewError(t, overallRatingError)}
          </Typography>
        )}
      </div>

      <div>
        <Label htmlFor="store-review-comment" color="title">
          {t("detail.reviews.form.commentLabel")}
        </Label>
        <Textarea
          id="store-review-comment"
          name="comment"
          defaultValue={existingReview?.comment ?? ""}
          rows={5}
          maxLength={1000}
          disabled={isPending}
          error={Boolean(commentError)}
          aria-invalid={Boolean(commentError)}
          placeholder={t("detail.reviews.form.commentPlaceholder")}
          className="mt-1 resize-y whitespace-pre-wrap"
        />
        {commentError && (
          <Typography size="xs" className="text-destructive mt-1" role="alert">
            {translateReviewError(t, commentError)}
          </Typography>
        )}
        {updatedAtLabel && (
          <Typography size="xs" className="text-text-muted mt-1.5">
            {t("detail.reviews.form.lastUpdated", { date: updatedAtLabel })}
          </Typography>
        )}
      </div>

      {state?.success && (
        <Typography size="xs" className="text-text-body" role="status" aria-live="polite">
          {t("detail.reviews.form.success")}
        </Typography>
      )}

      {formError && (
        <Typography size="xs" className="text-destructive" role="alert">
          {translateReviewError(t, formError)}
        </Typography>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" variant="primary" size="lg" disabled={isPending} className="w-full sm:w-auto">
          {isPending
            ? startedAsEditRef.current
              ? t("detail.reviews.form.updating")
              : t("detail.reviews.form.submitting")
            : startedAsEditRef.current
              ? t("detail.reviews.form.updateCta")
              : t("detail.reviews.form.submitCta")}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={isPending}
            className="w-full sm:w-auto"
            onClick={onCancel}
          >
            {t("detail.reviews.form.cancelCta")}
          </Button>
        )}
      </div>
    </form>
  );
}
