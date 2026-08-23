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
  /**
   * The mobile header's trailing slot, published by `Header` as a DOM node so a route can portal a
   * control of its own into it (`HeaderAccessoryPortal`).
   *
   * A NODE rather than a `ReactNode` in state on purpose: storing an element in context means the
   * route re-publishes a fresh node on every render, and the provider then has to re-render every
   * consumer of the shell to show it. A portal target inverts that — the shell owns an empty div,
   * the route owns what goes in it, and neither re-renders the other. It is also what keeps the
   * dependency pointing the right way: `Header` knows nothing about any route's controls.
   */
  accessorySlot: HTMLElement | null;
  setAccessorySlot: (node: HTMLElement | null) => void;
};

const HeaderTitleContext = createContext<HeaderTitleContextValue | null>(null);

export function HeaderTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const [breadcrumbMiddle, setBreadcrumbMiddleState] = useState<BreadcrumbMiddle | null>(null);
  const [accessorySlot, setAccessorySlotState] = useState<HTMLElement | null>(null);
  const setTitleStable = useCallback((value: string | null) => setTitle(value), []);
  const setBreadcrumbMiddle = useCallback((value: BreadcrumbMiddle | null) => {
    setBreadcrumbMiddleState(value);
  }, []);
  // Callback ref from `Header`. Stable so the ref does not detach and re-attach on every render,
  // which would unmount and remount whatever the route has portalled into it.
  const setAccessorySlot = useCallback((node: HTMLElement | null) => setAccessorySlotState(node), []);
  return (
    <HeaderTitleContext.Provider
      value={{
        title,
        setTitle: setTitleStable,
        breadcrumbMiddle,
        setBreadcrumbMiddle,
        accessorySlot,
        setAccessorySlot,
      }}
    >
      {children}
    </HeaderTitleContext.Provider>
  );
}

export function useHeaderTitle(): HeaderTitleContextValue {
  const ctx = useContext(HeaderTitleContext);
  if (!ctx) {
    return {
      title: null,
      setTitle: () => {},
      breadcrumbMiddle: null,
      setBreadcrumbMiddle: () => {},
      accessorySlot: null,
      setAccessorySlot: () => {},
    };
  }
  return ctx;
}
