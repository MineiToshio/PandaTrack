"use client";

import { createContext, useContext } from "react";

type StoreListingPendingContextValue = {
  isPending: boolean;
  navigate: (url: string) => void;
};

export const StoreListingPendingContext = createContext<StoreListingPendingContextValue>({
  isPending: false,
  navigate: () => {},
});

export function useStoreListingNavigation() {
  return useContext(StoreListingPendingContext);
}
