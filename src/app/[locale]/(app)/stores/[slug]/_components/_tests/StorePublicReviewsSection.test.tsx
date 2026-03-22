import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { PublicStoreReview } from "@/queries/store";
import StorePublicReviewsSection from "../StorePublicReviewsSection";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useStoreReviewsStateMock } = vi.hoisted(() => ({
  useStoreReviewsStateMock: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: { count?: number }) => {
    if (namespace === "stores") {
      if (key === "detail.reviews.title") return "Community reviews";
      if (key === "detail.reviews.description") return "Public reviews help collectors judge store trust.";
      if (key === "detail.reviews.form.openCreateCta") return "Write a review";
      if (key === "detail.reviews.showMoreCta") {
        return `View ${values?.count ?? 0} more reviews`;
      }

      return key;
    }

    if (namespace === "storeListing" && key === "ratingCount") {
      return `${values?.count ?? 0} reviews`;
    }

    return key;
  },
}));

vi.mock("../StoreReviewsStateProvider", () => ({
  useStoreReviewsState: useStoreReviewsStateMock,
}));

vi.mock("../_actions/deleteStoreReview", () => ({
  deleteStoreReview: vi.fn(),
}));

vi.mock("@/components/core/RatingStars", () => ({
  default: () => <div data-testid="rating-stars" />,
}));

vi.mock("@/components/modules/Modal", () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) => (isOpen ? <div>{children}</div> : null),
}));

function buildReview(index: number): PublicStoreReview {
  return {
    id: `review-${index}`,
    overallRating: 4,
    comment: `Review comment ${index}`,
    createdAt: new Date(`2026-01-${String(index).padStart(2, "0")}T00:00:00.000Z`),
    updatedAt: new Date(`2026-02-${String(index).padStart(2, "0")}T00:00:00.000Z`),
    authorName: `Reviewer ${index}`,
    isViewerReview: false,
  };
}

describe("StorePublicReviewsSection", () => {
  beforeEach(() => {
    useStoreReviewsStateMock.mockReturnValue({
      averageRating: 4.2,
      reviewCount: 12,
      reviews: Array.from({ length: 12 }, (_, index) => buildReview(index + 1)),
      viewerReview: null,
      applyOptimisticReviewDelete: vi.fn(),
      applyOptimisticReviewSave: vi.fn(),
    });
  });

  it("reveals community reviews in batches of five", async () => {
    const user = userEvent.setup();

    render(<StorePublicReviewsSection locale="en" storeSlug="test-store" />);

    expect(screen.getByText("Review comment 1")).toBeInTheDocument();
    expect(screen.getByText("Review comment 5")).toBeInTheDocument();
    expect(screen.queryByText("Review comment 6")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View 5 more reviews" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View 5 more reviews" }));

    expect(screen.getByText("Review comment 10")).toBeInTheDocument();
    expect(screen.queryByText("Review comment 11")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View 2 more reviews" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View 2 more reviews" }));

    expect(screen.getByText("Review comment 12")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /View .* more reviews/ })).not.toBeInTheDocument();
  });
});
