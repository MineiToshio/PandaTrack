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
      if (key === "redesign.detail.reviewsHeader.viewAll") {
        return `See all ${values?.count ?? 0} reviews`;
      }
      if (key === "redesign.detail.reviewsHeader.beTheFirst") {
        return "Be the first to review this store.";
      }
      if (key === "redesign.detail.reviewsHeader.totalCount") {
        return `${values?.count ?? 0} reviews`;
      }
      if (key === "redesign.detail.reviewsHeader.noAverage") {
        return "—";
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

vi.mock("../StoreReviewForm", () => ({
  default: () => <div data-testid="review-form" />,
}));

vi.mock("@/components/core/RatingStars", () => ({
  default: () => <div data-testid="rating-stars" />,
}));

vi.mock("@/components/core/StarRating", () => ({
  default: () => <div data-testid="star-rating" />,
}));

vi.mock("@/components/core/Avatar", () => ({
  default: () => <div data-testid="avatar" />,
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

  it("shows the first 4 community reviews and expands to all on click", async () => {
    const user = userEvent.setup();

    render(<StorePublicReviewsSection locale="en" storeSlug="test-store" />);

    expect(screen.getByText("Review comment 1")).toBeInTheDocument();
    expect(screen.getByText("Review comment 4")).toBeInTheDocument();
    expect(screen.queryByText("Review comment 5")).not.toBeInTheDocument();

    const expandCta = screen.getByRole("button", { name: "See all 12 reviews" });
    expect(expandCta).toBeInTheDocument();

    await user.click(expandCta);

    expect(screen.getByText("Review comment 5")).toBeInTheDocument();
    expect(screen.getByText("Review comment 12")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /See all .* reviews/ })).not.toBeInTheDocument();
  });
});
