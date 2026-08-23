"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import type { PendingProductsByStoreGroup } from "@/lib/data/orders/pendingProductsByStoreQueries";
import StoreUndetailedPaymentsModal from "./StoreUndetailedPaymentsModal";

type StoreGroupActionsProps = {
  store: PendingProductsByStoreGroup["store"];
  debts: PendingProductsByStoreGroup["debts"];
  /** Orders of this store holding money that names no product (`FR-05-51`). Usually empty. */
  undetailedByOrder: PendingProductsByStoreGroup["undetailedByOrder"];
  locale: string;
  /** Carried into each order link of the undetailed list so the detail can come back here. */
  returnTo: string;
  onRegisterPayment?: () => void;
  className?: string;
};

/**
 * The action cluster of one store group, in order: "Registrar pago", "Sin desglosar" (only when the
 * store holds money that names no product), then "Ver tienda".
 *
 * The order is the collector's own and it is not arbitrary: the two money controls belong together,
 * so the one that EXPLAINS an existing figure sits beside the one that adds to it, and the
 * navigation out of the group is last.
 *
 * Split out of `StoreGroupHeader` when the header was compressed to identity + figure. These three
 * only mean anything once you have decided to work on this store, which is exactly what expanding
 * the group says, so on a phone they render inside the BODY and a closed group costs nothing for
 * them. From `md` up they stay on the header row, where they have always had the width.
 *
 * `flex-wrap` is the safety valve rather than a promise the row always fits: at 320px the three
 * labelled controls need more than the ~254px inside the card, so the third one drops to a second
 * line instead of overflowing. Two controls (the common case, since "Sin desglosar" is rare) fit on
 * one line at every width.
 */
export default function StoreGroupActions({
  store,
  debts,
  undetailedByOrder,
  locale,
  returnTo,
  onRegisterPayment,
  className,
}: StoreGroupActionsProps) {
  const t = useTranslations("orderListing");
  const [isUndetailedOpen, setIsUndetailedOpen] = useState(false);

  // The gate stays on the LIFETIME `debtMinor`, deliberately not on the `openOrderDebtMinor` the
  // header displays: the payment-validation ceiling (`STORE_DEBT_EXCEEDED`) is lifetime-wide
  // (`FR-05-63`), so a store whose only balance sits on a COMPLETED order must still offer the
  // action even though its header figure reads zero.
  const canRegisterPayment = Boolean(onRegisterPayment) && debts.some((debt) => debt.debtMinor > 0);
  const undetailedCount = undetailedByOrder.length;
  const storeHref = `/${locale}${ROUTES.stores}/${store.slug}`;

  const handleOpenUndetailed = () => {
    setIsUndetailedOpen(true);
    posthog.capture(POSTHOG_EVENTS.ORDER.LIST_STORE_UNDETAILED_OPENED, {
      store_id: store.id,
      order_count: undetailedCount,
    });
  };

  return (
    <>
      <div className={className}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leadingIcon={<HandCoins size={14} aria-hidden />}
          onClick={onRegisterPayment}
          disabled={!canRegisterPayment}
          title={canRegisterPayment ? undefined : t("storeView.registerPaymentDisabledHint")}
          aria-label={canRegisterPayment ? undefined : t("storeView.registerPaymentDisabledHint")}
        >
          {t("storeView.registerPayment")}
        </Button>

        {undetailedCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleOpenUndetailed}
            aria-label={t("storeView.undetailed.triggerAria", { count: undetailedCount, store: store.name })}
          >
            {t("storeView.undetailed.trigger", { count: undetailedCount })}
          </Button>
        )}

        <ViewTransitionLink
          href={storeHref}
          viewTransitionEntity="store"
          // `min-h-11` rather than a `::before`: this cluster's neighbours are other controls at
          // `gap-2`, and two pseudo-expansions closer than their insets hand the whole contested
          // band to the later one in the DOM (`interface-patterns.md` §12). A real 44px box cannot
          // mis-target. Dropped back to the compact height from `md` up, where the pointer is
          // precise and the row is denser.
          className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-md)] px-2 [font-size:var(--text-caption)] [color:var(--text-secondary)] hover:[color:var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)] md:min-h-9"
        >
          {t("storeView.viewStore")}
        </ViewTransitionLink>
      </div>

      {/* Mounted only while there is something to show, so the list inside is never empty. */}
      {undetailedCount > 0 && (
        <StoreUndetailedPaymentsModal
          isOpen={isUndetailedOpen}
          onClose={() => setIsUndetailedOpen(false)}
          storeName={store.name}
          entries={undetailedByOrder}
          locale={locale}
          returnTo={returnTo}
        />
      )}
    </>
  );
}
