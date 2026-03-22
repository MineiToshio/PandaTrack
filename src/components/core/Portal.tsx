"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export type PortalProps = {
  children: React.ReactNode;
  /** DOM node to render into. Defaults to `document.body`. */
  container?: HTMLElement | null;
};

const noopSubscribe = () => () => {};

/**
 * Renders children into a DOM node outside the React parent tree (typically `document.body`).
 * Use for overlays and dialogs that must escape ancestor `overflow: hidden` or stacking contexts
 * that would otherwise clip or re-anchor `position: fixed`.
 */
export default function Portal({ children, container }: PortalProps) {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  if (!isClient) {
    return null;
  }

  const mountTarget = container ?? document.body;
  return createPortal(children, mountTarget);
}
