"use client";

import PerPageSelect, { type PerPageSelectProps } from "@/components/modules/PerPageSelect";
import { useStoreListingNavigation } from "./StoreListingPendingContext";

/**
 * Drop-in replacement for the shared `PerPageSelect` inside `StoreListingPagination`. Routes the
 * page-size change through the shared `navigate()` so it triggers the same `useTransition`-backed
 * skeleton as filter, sort, and page-number changes (mirrors `PaginationLink`).
 */
export default function StorePerPageSelect(props: Omit<PerPageSelectProps, "onNavigate">) {
  const { navigate } = useStoreListingNavigation();
  return <PerPageSelect {...props} onNavigate={navigate} />;
}
