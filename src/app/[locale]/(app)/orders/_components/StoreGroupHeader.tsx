"use client";

import { ChevronDown, HandCoins, Store as StoreIcon, Truck, User as UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Chip from "@/components/core/Chip";
import StoreAvatar from "@/components/core/StoreAvatar";
import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import { formatAmountWithSymbol } from "@/lib/currency";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { PendingProductsByStoreGroup } from "@/lib/data/orders/pendingProductsByStoreQueries";

type StoreGroupHeaderProps = {
  store: PendingProductsByStoreGroup["store"];
  openOrdersCount: number;
  pendingProductCount: number;
  debts: PendingProductsByStoreGroup["debts"];
  locale: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  /** Opens the store payment sheet for this group. Omitted (or the group has no debt row at all)
      keeps the action disabled — nothing to declare a payment against. */
  onRegisterPayment?: () => void;
};

/**
 * Collapsible header of one store group in the Orders "Por tienda" view: identity, open-orders /
 * pending-products summary, one stacked debt line per currency, and the group's two actions
 * ("Registrar pago" — disabled until Fase 4 wires the mutation, and "Ver tienda").
 */
export default function StoreGroupHeader({
  store,
  openOrdersCount,
  pendingProductCount,
  debts,
  locale,
  isExpanded,
  onToggleExpand,
  onRegisterPayment,
}: StoreGroupHeaderProps) {
  const t = useTranslations("orderListing");
  const tStores = useTranslations("stores");
  const canRegisterPayment = Boolean(onRegisterPayment) && debts.some((debt) => debt.debtMinor > 0);

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
          {debts.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {debts.map((debt) => {
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
                    {t("storeView.debtAmount", {
                      amount: formatAmountWithSymbol(debt.debtMinor, debt.currencyCode, locale),
                    })}
                  </span>
                );
              })}
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
        <ViewTransitionLink
          href={storeHref}
          viewTransitionEntity="store"
          className="inline-flex min-h-9 items-center gap-1 px-2 [font-size:var(--text-caption)] [color:var(--text-secondary)] hover:[color:var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
        >
          {t("storeView.viewStore")}
        </ViewTransitionLink>
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-controls={bodyId}
          aria-label={isExpanded ? t("card.collapse") : t("card.expand")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] [color:var(--text-secondary)] hover:[color:var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
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
  );
}
