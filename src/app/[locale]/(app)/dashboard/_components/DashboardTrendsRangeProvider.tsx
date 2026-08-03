"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useMemo, useTransition, type ReactNode } from "react";

type TrendsRangeTransition = {
  /** True while the server is resolving a newly picked range. */
  isPending: boolean;
  /** Navigates to `query` inside a transition, so the pending flag covers the server round trip. */
  navigate: (query: string) => void;
};

const TrendsRangeTransitionContext = createContext<TrendsRangeTransition | null>(null);

/**
 * Owns the range control's navigation transition and shares its pending flag with the chart
 * surface underneath.
 *
 * The range lives in the URL and the series are resolved on the server, so picking a preset is a
 * round trip, not a local state change. React keeps the previous UI on screen for the duration of
 * a transition, which without this would leave the old charts sitting there looking settled while
 * a different range loads. Hoisting the transition here lets the control and the charts read one
 * pending flag, instead of the control knowing it is busy while the charts it drives do not.
 */
export function DashboardTrendsRangeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const value = useMemo<TrendsRangeTransition>(
    () => ({
      isPending,
      navigate: (query: string) => {
        startTransition(() => {
          router.replace(`${pathname}${query}`, { scroll: false });
        });
      },
    }),
    [isPending, pathname, router],
  );

  return <TrendsRangeTransitionContext.Provider value={value}>{children}</TrendsRangeTransitionContext.Provider>;
}

export function useTrendsRangeTransition(): TrendsRangeTransition {
  const context = useContext(TrendsRangeTransitionContext);
  if (!context) {
    throw new Error("useTrendsRangeTransition must be used inside DashboardTrendsRangeProvider");
  }
  return context;
}
