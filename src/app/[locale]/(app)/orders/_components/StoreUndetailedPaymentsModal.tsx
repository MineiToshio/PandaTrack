"use client";

import { useTranslations } from "next-intl";
import { Coins } from "lucide-react";
import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import Modal from "@/components/modules/Modal/Modal";
import { formatAmountWithSymbol } from "@/lib/currency";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { UndetailedOrderPayment } from "@/lib/data/orders/pendingProductsByStoreQueries";

type StoreUndetailedPaymentsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  storeName: string;
  /** Never empty: the trigger that opens this only exists while the store has such money. */
  entries: UndetailedOrderPayment[];
  locale: string;
  returnTo: string;
};

/**
 * Money this store received against an order without naming a product, one line per order.
 *
 * It exists because the products in the group cannot show that money without inventing how it split,
 * and a collector looking at a product sitting at 0% deserves an answer better than silence. So the
 * money is NAMED where it actually is instead of being spread.
 *
 * **Why a modal and not the foot of the group** (which is where it shipped first): the list is one
 * to five lines that answer a question the collector asks occasionally, and a permanent block under
 * every product list charged that space to every store on every visit — including the eight stores
 * out of ten that have no such money at all, where the group simply ended a little lower for no
 * reason. Behind a trigger it costs nothing until it is asked for, and it becomes reachable with the
 * group COLLAPSED, which the foot never was. The canonical `<Modal>` is the app's only overlay
 * (`.agents/rules/modal-canonical-pattern.mdc`); on touch it is a bottom sheet, which is the right
 * shape for a dense list view where the foot of a 29-product group is far off screen.
 *
 * Each line is a link, because the reason to look at this list is to decide which orders to go and
 * fix. The overlay is dismissed on the way out rather than left painting over the transition.
 */
export default function StoreUndetailedPaymentsModal({
  isOpen,
  onClose,
  storeName,
  entries,
  locale,
  returnTo,
}: StoreUndetailedPaymentsModalProps) {
  const t = useTranslations("orderListing");
  const tCommon = useTranslations("common");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("storeView.undetailed.title")}
      subtitle={storeName}
      icon={<Coins size={20} aria-hidden="true" />}
      tone="info"
      closeButtonLabel={tCommon("close")}
      // No footer actions, so the body owns the bottom breathing room the footer would have given.
      bodyClassName="pb-6"
    >
      <p className="[font-size:var(--text-caption)] [line-height:var(--text-caption--line-height)] [color:var(--text-secondary)]">
        {t("storeView.undetailed.hint")}
      </p>
      <ul role="list" className="mt-3 flex flex-col">
        {entries.map((entry, index) => (
          <li key={entry.orderId}>
            <ViewTransitionLink
              href={`/${locale}${ROUTES.orders}/${entry.orderId}?returnTo=${encodeURIComponent(returnTo)}`}
              viewTransitionEntity="order"
              onClick={onClose}
              // The whole row is the target, which is what puts it over the 44px touch floor without
              // a pseudo-element: rows in normal flow cannot overlap, so there is no contested band
              // (`docs/design/interface-patterns.md` §12, "a dense cluster is RESIZED").
              className={cn(
                "flex min-h-11 items-center justify-between gap-3 [font-size:var(--text-caption)] [color:var(--text-secondary)]",
                "hover:[color:var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
                index < entries.length - 1 && "[border-bottom:1px_solid_var(--border)]",
              )}
            >
              <span className="truncate [font-family:var(--font-mono)]">{entry.humanReadableId}</span>
              <span className="shrink-0 [color:var(--text-primary)] tabular-nums">
                {formatAmountWithSymbol(entry.amountMinor, entry.currencyCode, locale)}
              </span>
            </ViewTransitionLink>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
