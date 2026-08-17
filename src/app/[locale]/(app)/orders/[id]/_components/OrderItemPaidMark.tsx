"use client";

import { useTranslations } from "next-intl";
import { useToast } from "@/contexts/ToastContext";
import PaidMarkControl from "../../_components/share/PaidMarkControl";
import type { PaidDeclarationFailure } from "../../_components/share/useOrderItemPaidDeclaration";

export type OrderItemPaidMarkProps = {
  orderId: string;
  itemId: string;
  itemName: string;
  initialDeclared: boolean;
  proven: boolean;
  /** `offersPaidMark` for this product; see {@link PaidMarkControl}. */
  offersMark: boolean;
  locked: boolean;
};

/**
 * The order detail's client boundary around {@link PaidMarkControl}.
 *
 * The list around it renders on the server, and a Server Component cannot hand a function across
 * the boundary, so the toast owner has to be this leaf rather than the list. Same split
 * `OrderItemStatePill` already uses for the delivery-state toggle.
 *
 * `showMarkWhenProven` is on here and nowhere else: the detail is the audit surface, so a mark put
 * there by mistake stays visible and removable even while the order's own balance already proves
 * the product settled.
 */
export default function OrderItemPaidMark({
  orderId,
  itemId,
  itemName,
  initialDeclared,
  proven,
  offersMark,
  locked,
}: OrderItemPaidMarkProps) {
  const t = useTranslations("orders.detail.items.paidMark");
  const { addToast } = useToast();

  const handleError = (failure: PaidDeclarationFailure) => {
    addToast(failure === "ITEM_NOT_FOUND" ? t("reload") : t("error"), { variant: "error" });
  };

  return (
    <PaidMarkControl
      orderId={orderId}
      itemId={itemId}
      itemName={itemName}
      initialDeclared={initialDeclared}
      proven={proven}
      offersMark={offersMark}
      showMarkWhenProven
      locked={locked}
      size="sm"
      onError={handleError}
    />
  );
}
