"use client";

import { createPortal } from "react-dom";
import { useHeaderTitle } from "./HeaderTitleContext";

/**
 * Renders a route's own control into the mobile header's trailing slot.
 *
 * The slot exists for a control that is at once the STATE and the SWITCH of the screen below it:
 * the orders list "Por pedido / Por tienda" chooser is the first, and the reason the slot exists.
 * That control was competing for width in the list's sticky toolbar (94px of the 343 a 375px phone
 * has), while the header it now sits in carries 250x56px of dead space on every mobile screen of
 * the app. Moving it also fixes something the toolbar could not: the header is `sticky top-0`, so
 * the active view stays readable with the list scrolled, and the page title alone ("Pedidos") never
 * said which of the two views was on.
 *
 * Deliberately NOT a general-purpose action slot. An ordinary action belongs in the content, next
 * to what it acts on; only a control that answers "where am I" earns a place in the shell.
 *
 * Renders nothing until `Header` has published the node, which is one paint after the first mount.
 * That is invisible in practice (the header renders in the same commit) and it is what keeps this
 * safe during SSR, where there is no slot at all.
 */
export default function HeaderAccessoryPortal({ children }: { children: React.ReactNode }) {
  const { accessorySlot } = useHeaderTitle();
  if (!accessorySlot) return null;
  return createPortal(children, accessorySlot);
}
