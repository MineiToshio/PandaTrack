"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOrderItemPaidDeclaredAction } from "../../_actions/orderItemActions";

export type PaidDeclarationFailure = "ITEM_NOT_FOUND" | "other";

export type UseOrderItemPaidDeclarationOptions = {
  orderId: string;
  itemId: string;
  initialDeclared: boolean;
  /**
   * Called after the local state has already been rolled back. The consumer owns the toast: a mark
   * is a statement only the collector could make, so losing one silently is not an option here even
   * though the sibling arrived-toggle reverts without a word.
   */
  onError: (failure: PaidDeclarationFailure) => void;
};

export type OrderItemPaidDeclaration = {
  declared: boolean;
  isPending: boolean;
  toggle: () => void;
};

/**
 * The "Marcar pagado" toggle, shared by every surface that shows an order product.
 *
 * Optimistic by default (`optimistic-client-updates.mdc`): the chip flips before the server is
 * asked and flips back if the write fails. The collector marks several products in a row, so a
 * round trip between each one would be the whole interaction.
 *
 * Presentation stays with the caller, the same split `useOrderItemArrivedToggle` uses: the list's
 * chip and the detail's pill are drawn at different scales, and what has to be identical is the
 * behaviour, which lives here.
 */
export function useOrderItemPaidDeclaration({
  orderId,
  itemId,
  initialDeclared,
  onError,
}: UseOrderItemPaidDeclarationOptions): OrderItemPaidDeclaration {
  const router = useRouter();
  const [declared, setDeclared] = useState(initialDeclared);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const previous = declared;
    const target = !previous;
    setDeclared(target);
    startTransition(async () => {
      try {
        const result = await setOrderItemPaidDeclaredAction(orderId, itemId, target);
        if (result.ok) {
          // Not a refetch to update this control: the chip already flipped locally. It is what keeps
          // the server-rendered siblings that COUNT marks honest, above all the order detail's
          // "marcados: N de M" line and the warning that hangs off it, which live in another tree.
          router.refresh();
          return;
        }
        setDeclared(previous);
        onError(result.error === "ITEM_NOT_FOUND" ? "ITEM_NOT_FOUND" : "other");
      } catch {
        // A rejected Server Action call (a transport failure) is not a refusal the server described,
        // it is no answer at all. Inside a transition an uncaught rejection re-throws during render
        // and replaces the whole page with the (app)/error.tsx boundary, so it gets the exact same
        // treatment as `result.ok === false` above instead of escaping the transition.
        setDeclared(previous);
        onError("other");
      }
    });
  };

  return { declared, isPending, toggle };
}
