"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StoreListingPendingContext } from "./StoreListingPendingContext";

/**
 * Provides a shared `navigate(url)` + `isPending` context to all children so that
 * filters, sorting, and pagination all trigger the same `useTransition` — which the
 * grid wrapper uses to swap in the skeleton loading UI.
 */
export default function StoreListingShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (url: string) => {
      startTransition(() => {
        router.push(url);
      });
    },
    [router],
  );

  return (
    <StoreListingPendingContext.Provider value={{ isPending, navigate }}>
      {children}
    </StoreListingPendingContext.Provider>
  );
}
