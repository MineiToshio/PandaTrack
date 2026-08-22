"use client";

import { useState } from "react";
import { ChevronDown, HandCoins, Store as StoreIcon, Truck, User as UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import Chip from "@/components/core/Chip";
import StoreAvatar from "@/components/core/StoreAvatar";
import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import { formatAmountWithSymbol } from "@/lib/currency";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { PendingProductsByStoreGroup } from "@/lib/data/orders/pendingProductsByStoreQueries";
import StoreUndetailedPaymentsModal from "./StoreUndetailedPaymentsModal";

type StoreGroupHeaderProps = {
  store: PendingProductsByStoreGroup["store"];
  openOrdersCount: number;
  pendingProductCount: number;
  debts: PendingProductsByStoreGroup["debts"];
  /**
   * Orders of this store holding money that names no product (`FR-05-51`). Empty for most stores,
   * and the trigger that opens the list does not render at all when it is.
   */
  undetailedByOrder: PendingProductsByStoreGroup["undetailedByOrder"];
  locale: string;
  /** Carried into each order link of the undetailed list so the detail can come back here. */
  returnTo: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  /** Opens the store payment sheet for this group. Omitted (or the group has no debt row at all)
      keeps the action disabled — nothing to declare a payment against. */
  onRegisterPayment?: () => void;
};

/**
 * Collapsible header of one store group in the Orders "Por tienda" view: identity, open-orders /
 * pending-products summary, one stacked debt line per currency, and the group's actions
 * ("Registrar pago", the "Sin desglosar" list when the store has such money, and "Ver tienda").
 */
export default function StoreGroupHeader({
  store,
  openOrdersCount,
  pendingProductCount,
  debts,
  undetailedByOrder,
  locale,
  returnTo,
  isExpanded,
  onToggleExpand,
  onRegisterPayment,
}: StoreGroupHeaderProps) {
  const t = useTranslations("orderListing");
  const tStores = useTranslations("stores");
  const [isUndetailedOpen, setIsUndetailedOpen] = useState(false);
  // The "Registrar pago" gate stays on the LIFETIME `debtMinor`, deliberately not switched to
  // `openOrderDebtMinor` alongside the displayed chip below: the payment-validation ceiling
  // (`STORE_DEBT_EXCEEDED`) is lifetime-wide (`FR-05-63`), so a store with only a COMPLETED order
  // still carrying a balance must still offer the action, even though its open-order chip reads
  // zero.
  const canRegisterPayment = Boolean(onRegisterPayment) && debts.some((debt) => debt.debtMinor > 0);
  const undetailedCount = undetailedByOrder.length;

  const handleOpenUndetailed = () => {
    setIsUndetailedOpen(true);
    posthog.capture(POSTHOG_EVENTS.ORDER.LIST_STORE_UNDETAILED_OPENED, {
      store_id: store.id,
      order_count: undetailedCount,
    });
  };

  /**
   * The same trigger, mounted in two slots and shown at one breakpoint each.
   *
   * The owner's placement — between "Registrar pago" and "Ver tienda" — is a DESKTOP layout and only
   * a desktop layout: measured at `--text-caption`, that cluster is already ~278px of the ~252px a
   * 320px viewport leaves inside the card and of the ~307px a 375px one does, so a fourth labelled
   * control does not fit on any phone (it would need a ~495px viewport). Rather than make an
   * already-tight row wrap into three lines with the chevron stranded on its own, the touch slot is
   * the identity block's money line, which is `flex-wrap` already, has the card's full width, and
   * sits beside the very figure this list qualifies. `docs/design/interface-patterns.md` §12: when a
   * desktop pattern gets crowded, switch to a dedicated mobile pattern rather than forcing it.
   *
   * Chosen by CSS, not by `useIsMobile()`: nothing here needs to know the viewport before paint, and
   * a hydration-time read would render one of the two first and swap it.
   */
  const renderUndetailedTrigger = (className: string) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleOpenUndetailed}
      aria-label={t("storeView.undetailed.triggerAria", { count: undetailedCount, store: store.name })}
      className={className}
    >
      {t("storeView.undetailed.trigger", { count: undetailedCount })}
    </Button>
  );

  const isPerson = store.sellerType === "PERSON";
  const isProxy = store.sellerType === "PROXY";
  const TypeIcon = isPerson ? UserIcon : isProxy ? Truck : StoreIcon;
  const sellerTypeLabel = isPerson
    ? tStores("create.sellerTypePerson")
    : isProxy
      ? tStores("create.sellerTypeProxy")
      : tStores("create.sellerTypeRetailer");
  const storeHref = `/${locale}${ROUTES.stores}/${store.slug}`;
  const bodyId = `store-group-body-${store.id}`;

  return (
    <>
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:gap-4 md:p-5">
        <div className="flex min-w-0 items-start gap-3">
          {store.logoUrl ? (
            <StoreAvatar store={{ name: store.name, logo: { src: store.logoUrl, aspect: "square" } }} size={40} />
          ) : (
            <StoreAvatar store={{ name: store.name }} size={40} isPerson={isPerson} />
          )}
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="min-w-0 truncate [font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
                {store.name}
              </p>
              <span className="inline-flex shrink-0 items-center gap-1 [font-size:var(--text-caption)] [color:var(--text-muted)]">
                <TypeIcon size={12} aria-hidden />
                {sellerTypeLabel}
              </span>
            </div>
            <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">
              {t("storeView.orderSummary", { orders: openOrdersCount, products: pendingProductCount })}
            </p>
            {(debts.length > 0 || undetailedCount > 0) && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {debts.map((debt) => {
                  // Credit stays on the LIFETIME `debtMinor` (`FR-05-63`): "in credit" is a fact
                  // about the store's whole history. The DISPLAYED positive figure below switches
                  // to `openOrderDebtMinor` (`ADR 0033`): a fully delivered order leaves this chip
                  // together with its own payments, so a store with only a settled-but-undeclared
                  // COMPLETED order reads no chip at all rather than a stale "Debes" one.
                  const inFavor = debt.debtMinor < 0;
                  return inFavor ? (
                    <Chip key={debt.currencyCode} variant="success" size="sm">
                      <span className="tabular-nums">
                        {t("storeView.creditAmount", {
                          amount: formatAmountWithSymbol(Math.abs(debt.debtMinor), debt.currencyCode, locale),
                        })}
                      </span>
                    </Chip>
                  ) : (
                    <span
                      key={debt.currencyCode}
                      className="[font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums"
                    >
                      {t("storeView.openOrderDebtAmount", {
                        amount: formatAmountWithSymbol(debt.openOrderDebtMinor, debt.currencyCode, locale),
                      })}
                    </span>
                  );
                })}
                {/* Touch slot. `min-h-11` rather than a `::before`: the neighbours here are the debt
                  figure and, on a wrap, the row above — both cases where §12 says to RESIZE the box,
                  since two expansions closer than their insets hand the whole band to the later one
                  in the DOM. Dropped from `md:` up, where the desktop slot below takes over. */}
                {undetailedCount > 0 && renderUndetailedTrigger("min-h-11 md:hidden")}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end md:self-auto">
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
          {/* Desktop slot: exactly between the primary action and "Ver tienda". `ghost` is outline
            only, so it never competes with the elevated `secondary` beside it. */}
          {undetailedCount > 0 && renderUndetailedTrigger("hidden md:inline-flex")}
          <ViewTransitionLink
            href={storeHref}
            viewTransitionEntity="store"
            // `min-h-9` renders 36px tall (caption text, no vertical padding), 8px under the touch
            // floor. The expansion is VERTICAL ONLY (`inset:-4px_0`): the text already makes the link
            // ~76px wide, and the row's `gap-2` (8px) is fully spoken for on the right by the chevron
            // button's own `inset:-4px`, so any horizontal growth here would collide with it. The 4px
            // added above and below stays inside the header's 12px column gap and its 16px bottom
            // padding, neither of which holds another control. Dropped from `md:` up like every other
            // expansion in this repo.
            className="relative inline-flex min-h-9 items-center gap-1 px-2 [font-size:var(--text-caption)] [color:var(--text-secondary)] before:absolute before:[inset:-4px_0] before:content-[''] hover:[color:var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)] md:before:inset-0"
          >
            {t("storeView.viewStore")}
          </ViewTransitionLink>
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={isExpanded}
            aria-controls={bodyId}
            aria-label={isExpanded ? t("card.collapse") : t("card.expand")}
            // Tap target ≥44×44 on mobile via the `::before` pseudo (same mechanism as `IconButton`):
            // padding inside a fixed `h-9 w-9` box never grows the box, so `inset:-4px` on 36px
            // expands the hit area outward to 44 instead. The nearest control is the "ver tienda"
            // link at the row's `gap-2` (8px), exactly the 2×4px the two expansions need, so no extra
            // clearance is required. `md:before:inset-0` drops the extra area on desktop.
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] [color:var(--text-secondary)] before:absolute before:[inset:-4px] before:content-[''] hover:[color:var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)] md:before:inset-0"
          >
            <ChevronDown
              width={16}
              height={16}
              aria-hidden="true"
              className={cn("transition-transform duration-200", isExpanded && "rotate-180")}
            />
          </button>
        </div>
      </div>

      {/* One overlay per group, whichever of the two triggers opened it. Mounted only while there is
          something to show, so the list inside it is never empty. */}
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
