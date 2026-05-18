"use client";

import { createContext, useCallback, useContext, useState } from "react";

/**
 * Optional middle breadcrumb between the primary-area crumb (e.g. "Pedidos", "Tiendas")
 * and the rest of the trail. Used by edit pages where the segment between the section
 * and the action is a dynamic entity name/id (store name, order code).
 */
export type BreadcrumbMiddle = {
  label: string;
  href: string;
};

type HeaderTitleContextValue = {
  title: string | null;
  setTitle: (title: string | null) => void;
  breadcrumbMiddle: BreadcrumbMiddle | null;
  setBreadcrumbMiddle: (value: BreadcrumbMiddle | null) => void;
};

const HeaderTitleContext = createContext<HeaderTitleContextValue | null>(null);

export function HeaderTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const [breadcrumbMiddle, setBreadcrumbMiddleState] = useState<BreadcrumbMiddle | null>(null);
  const setTitleStable = useCallback((value: string | null) => setTitle(value), []);
  const setBreadcrumbMiddle = useCallback((value: BreadcrumbMiddle | null) => {
    setBreadcrumbMiddleState(value);
  }, []);
  return (
    <HeaderTitleContext.Provider
      value={{
        title,
        setTitle: setTitleStable,
        breadcrumbMiddle,
        setBreadcrumbMiddle,
      }}
    >
      {children}
    </HeaderTitleContext.Provider>
  );
}

export function useHeaderTitle(): HeaderTitleContextValue {
  const ctx = useContext(HeaderTitleContext);
  if (!ctx) {
    return { title: null, setTitle: () => {}, breadcrumbMiddle: null, setBreadcrumbMiddle: () => {} };
  }
  return ctx;
}
