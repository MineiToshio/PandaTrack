"use client";

import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { useProgressionFeedback } from "@/contexts/ProgressionFeedbackContext";
import type { PublicStoreReview, StoreViewerReview } from "@/lib/data/stores/storeQueries";
import type { SavedStoreReview } from "../_actions/saveStoreReview";

type StoreReviewsState = {
  averageRating: number | null;
  reviewCount: number;
  reviews: PublicStoreReview[];
  viewerReview: StoreViewerReview | null;
};

type ReviewDraft = {
  overallRating: number;
  comment: string | null;
};

type OptimisticReviewController = {
  commit: (review: SavedStoreReview) => void;
  rollback: () => void;
};

type StoreReviewsStateContextValue = StoreReviewsState & {
  applyOptimisticReviewSave: (draft: ReviewDraft) => OptimisticReviewController;
  applyOptimisticReviewDelete: (reviewId: string) => { rollback: () => void };
};

type StoreReviewsStateProviderProps = PropsWithChildren<StoreReviewsState>;

const StoreReviewsStateContext = createContext<StoreReviewsStateContextValue | null>(null);

function roundAverageRating(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function findViewerReviewCard(reviews: PublicStoreReview[]): PublicStoreReview | undefined {
  return reviews.find((review) => review.isViewerReview);
}

function buildReviewStateFromProps({
  averageRating,
  reviewCount,
  reviews,
  viewerReview,
}: StoreReviewsState): StoreReviewsState {
  return {
    averageRating,
    reviewCount,
    reviews,
    viewerReview,
  };
}

export default function StoreReviewsStateProvider({
  averageRating,
  reviewCount,
  reviews,
  viewerReview,
  children,
}: StoreReviewsStateProviderProps) {
  const [state, setState] = useState<StoreReviewsState>(() =>
    buildReviewStateFromProps({ averageRating, reviewCount, reviews, viewerReview }),
  );
  const { announceProgression } = useProgressionFeedback();

  const applyOptimisticReviewSave = useCallback(
    (draft: ReviewDraft): OptimisticReviewController => {
      const snapshot = state;
      const now = new Date();
      const existingViewerCard = findViewerReviewCard(snapshot.reviews);
      const viewerAuthorName = existingViewerCard?.authorName ?? null;
      const currentTotal = (snapshot.averageRating ?? 0) * snapshot.reviewCount;
      const nextReviewCount = snapshot.viewerReview ? snapshot.reviewCount : snapshot.reviewCount + 1;
      const nextAverageRating =
        nextReviewCount === 0
          ? null
          : roundAverageRating(
              snapshot.viewerReview
                ? (currentTotal - snapshot.viewerReview.overallRating + draft.overallRating) / nextReviewCount
                : (currentTotal + draft.overallRating) / nextReviewCount,
            );

      const optimisticReview: PublicStoreReview = {
        id: existingViewerCard?.id ?? `temp-review-${Date.now()}`,
        overallRating: draft.overallRating,
        comment: draft.comment,
        createdAt: existingViewerCard?.createdAt ?? now,
        updatedAt: now,
        authorName: viewerAuthorName,
        isViewerReview: true,
      };

      setState({
        averageRating: nextAverageRating,
        reviewCount: nextReviewCount,
        viewerReview: {
          overallRating: draft.overallRating,
          comment: draft.comment,
          updatedAt: now,
        },
        reviews: existingViewerCard
          ? snapshot.reviews.map((review) => (review.isViewerReview ? optimisticReview : review))
          : [optimisticReview, ...snapshot.reviews],
      });

      return {
        commit: (review) => {
          setState((current) => {
            const currentViewerCard = findViewerReviewCard(current.reviews);
            const reconciledReview: PublicStoreReview = {
              id: review.id,
              overallRating: review.overallRating,
              comment: review.comment,
              createdAt: review.createdAt,
              updatedAt: review.updatedAt,
              authorName: review.authorName,
              isViewerReview: true,
            };

            return {
              averageRating: current.averageRating,
              reviewCount: current.reviewCount,
              viewerReview: {
                overallRating: review.overallRating,
                comment: review.comment,
                updatedAt: review.updatedAt,
              },
              reviews: currentViewerCard
                ? current.reviews.map((item) => (item.isViewerReview ? reconciledReview : item))
                : [reconciledReview, ...current.reviews],
            };
          });
          // Both review submitters (the inline composer and the edit form) reconcile through this
          // one callback, so what the saved review credited is announced here rather than once per
          // form, after the reconciled row is already on screen.
          announceProgression(review.progression);
        },
        rollback: () => {
          setState(snapshot);
        },
      };
    },
    [announceProgression, state],
  );

  const applyOptimisticReviewDelete = useCallback(
    (reviewId: string) => {
      const snapshot = state;
      const currentViewerReview = snapshot.viewerReview;

      if (!currentViewerReview) {
        return {
          rollback: () => {
            setState(snapshot);
          },
        };
      }

      const currentTotal = (snapshot.averageRating ?? 0) * snapshot.reviewCount;
      const nextReviewCount = Math.max(0, snapshot.reviewCount - 1);
      const nextAverageRating =
        nextReviewCount === 0
          ? null
          : roundAverageRating((currentTotal - currentViewerReview.overallRating) / nextReviewCount);

      setState({
        averageRating: nextAverageRating,
        reviewCount: nextReviewCount,
        viewerReview: null,
        reviews: snapshot.reviews.filter((review) => review.id !== reviewId),
      });

      return {
        rollback: () => {
          setState(snapshot);
        },
      };
    },
    [state],
  );

  const value = useMemo<StoreReviewsStateContextValue>(
    () => ({
      ...state,
      applyOptimisticReviewSave,
      applyOptimisticReviewDelete,
    }),
    [applyOptimisticReviewDelete, applyOptimisticReviewSave, state],
  );

  return <StoreReviewsStateContext.Provider value={value}>{children}</StoreReviewsStateContext.Provider>;
}

export function useStoreReviewsState() {
  const context = useContext(StoreReviewsStateContext);

  if (!context) {
    throw new Error("useStoreReviewsState must be used within StoreReviewsStateProvider.");
  }

  return context;
}
