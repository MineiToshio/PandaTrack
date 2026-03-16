"use client";

import { createContext, useCallback, useContext, useState } from "react";

type HeaderTitleContextValue = {
  title: string | null;
  setTitle: (title: string | null) => void;
};

const HeaderTitleContext = createContext<HeaderTitleContextValue | null>(null);

export function HeaderTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const setTitleStable = useCallback((value: string | null) => setTitle(value), []);
  return (
    <HeaderTitleContext.Provider value={{ title, setTitle: setTitleStable }}>{children}</HeaderTitleContext.Provider>
  );
}

export function useHeaderTitle(): HeaderTitleContextValue {
  const ctx = useContext(HeaderTitleContext);
  if (!ctx) {
    return { title: null, setTitle: () => {} };
  }
  return ctx;
}
