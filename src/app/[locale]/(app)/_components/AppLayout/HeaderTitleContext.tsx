"use client";

import { createContext, useCallback, useContext, useState } from "react";

/** Optional second breadcrumb after "Stores" on store edit (dynamic store name + link to detail). */
export type BreadcrumbAfterStores = {
  label: string;
  href: string;
};

type HeaderTitleContextValue = {
  title: string | null;
  setTitle: (title: string | null) => void;
  breadcrumbAfterStores: BreadcrumbAfterStores | null;
  setBreadcrumbAfterStores: (value: BreadcrumbAfterStores | null) => void;
};

const HeaderTitleContext = createContext<HeaderTitleContextValue | null>(null);

export function HeaderTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const [breadcrumbAfterStores, setBreadcrumbAfterStoresState] = useState<BreadcrumbAfterStores | null>(null);
  const setTitleStable = useCallback((value: string | null) => setTitle(value), []);
  const setBreadcrumbAfterStores = useCallback((value: BreadcrumbAfterStores | null) => {
    setBreadcrumbAfterStoresState(value);
  }, []);
  return (
    <HeaderTitleContext.Provider
      value={{
        title,
        setTitle: setTitleStable,
        breadcrumbAfterStores,
        setBreadcrumbAfterStores,
      }}
    >
      {children}
    </HeaderTitleContext.Provider>
  );
}

export function useHeaderTitle(): HeaderTitleContextValue {
  const ctx = useContext(HeaderTitleContext);
  if (!ctx) {
    return { title: null, setTitle: () => {}, breadcrumbAfterStores: null, setBreadcrumbAfterStores: () => {} };
  }
  return ctx;
}
