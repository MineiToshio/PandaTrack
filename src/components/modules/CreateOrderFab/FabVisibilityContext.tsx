"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type FabVisibility = {
  selectionActive: boolean;
  setSelectionActive: Dispatch<SetStateAction<boolean>>;
};

const FabVisibilityContext = createContext<FabVisibility>({
  selectionActive: false,
  setSelectionActive: () => {},
});

/** The shell and the single active selection share ownership of the bottom action slot. */
export function FabVisibilityProvider({ children }: { children: ReactNode }) {
  const [selectionActive, setSelectionActive] = useState(false);
  return (
    <FabVisibilityContext.Provider value={{ selectionActive, setSelectionActive }}>
      {children}
    </FabVisibilityContext.Provider>
  );
}

export function useFabSelectionActive() {
  return useContext(FabVisibilityContext).selectionActive;
}

/** Releases the slot on cancellation, successful arrival, view change, or route unmount. */
export function useSelectionFabSuppression(active: boolean) {
  const { setSelectionActive } = useContext(FabVisibilityContext);
  useEffect(() => {
    setSelectionActive(active);
    return () => setSelectionActive(false);
  }, [active, setSelectionActive]);
}
