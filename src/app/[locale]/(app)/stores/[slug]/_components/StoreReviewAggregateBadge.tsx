"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/styles";
import { useStoreReviewsState } from "./StoreReviewsStateProvider";

type StoreReviewAggregateBadgeProps = {
  className?: string;
};

export default function StoreReviewAggregateBadge({ className }: StoreReviewAggregateBadgeProps) {
  const { averageRating, reviewCount } = useStoreReviewsState();

  if (averageRating == null) {
    return null;
  }

  return (
    <span className={cn(className, "bg-background/80 text-text-body")}>
      <Star className="text-warning size-3.5 fill-current" aria-hidden />
      {averageRating.toFixed(1)}
      {reviewCount > 0 ? ` (${reviewCount})` : ""}
    </span>
  );
}
