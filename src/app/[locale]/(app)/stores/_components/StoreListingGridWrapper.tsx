"use client";

import { useStoreListingNavigation } from "./StoreListingPendingContext";
import StoreListingGridSkeleton from "./StoreListingGridSkeleton";

/**
 * Shows the skeleton grid while a filter/sort/pagination navigation is in flight,
 * then renders the real server-delivered content once the transition resolves.
 */
export default function StoreListingGridWrapper({ children }: { children: React.ReactNode }) {
  const { isPending } = useStoreListingNavigation();
  return isPending ? <StoreListingGridSkeleton /> : <>{children}</>;
}
