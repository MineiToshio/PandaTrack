"use client";

import { ChevronDown, Store as StoreIcon, Truck, User as UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import StoreAvatar from "@/components/core/StoreAvatar";
import { formatAmountSymbolOnly, formatAmountWithSymbol } from "@/lib/currency";
import { cn } from "@/lib/styles";
import type { PendingProductsByStoreGroup } from "@/lib/data/orders/pendingProductsByStoreQueries";

type StoreGroupHeaderProps = {
  store: PendingProductsByStoreGroup["store"];
  pendingProductCount: number;
  /** Pending products of this group whose arrival window has already passed (`countOverdueProducts`). */
  overdueProductCount: number;
  debts: PendingProductsByStoreGroup["debts"];
  locale: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  /** Rendered inside the header from `md` up; below that the body carries the same cluster. */
  desktopActions?: React.ReactNode;
};

/** One currency's figure as this header states it: what it is, and which word names it. */
type DebtFigure = {
  currencyCode: string;
  amountMinor: number;
  kind: "debt" | "credit" | "none";
};

/**
 * Turns the group's raw per-currency debts into the figures the header prints, in order.
 *
 * Credit stays on the LIFETIME `debtMinor` (`FR-05-63`): being "in credit" is a fact about the
 * store's whole history. A positive figure reads `openOrderDebtMinor` instead (`ADR 0033`), so a
 * store whose only balance sits on a fully delivered order shows nothing rather than a stale
 * "Debes". A currency at zero is dropped: six of the collector's ten stores are at zero, and a
 * header that spends a line saying so is a header offering work that does not exist. When EVERY
 * currency is zero the first one is kept, muted, so the row still states its own figure instead of
 * going silently blank.
 */
export function resolveDebtFigures(debts: PendingProductsByStoreGroup["debts"]): DebtFigure[] {
  const figures: DebtFigure[] = debts.map((debt) =>
    debt.debtMinor < 0
      ? { currencyCode: debt.currencyCode, amountMinor: Math.abs(debt.debtMinor), kind: "credit" as const }
      : { currencyCode: debt.currencyCode, amountMinor: debt.openOrderDebtMinor, kind: "debt" as const },
  );
  const meaningful = figures.filter((figure) => figure.amountMinor > 0);
  if (meaningful.length > 0) return meaningful;
  const first = figures[0];
  return first ? [{ ...first, amountMinor: first.amountMinor, kind: "none" }] : [];
}

/**
 * Collapsible header of one store group in the Orders "Por tienda" view.
 *
 * The WHOLE row is the expand control (`FR-05-70`). It used to be a chevron button sharing the row
 * with "Registrar pago" and "Ver tienda"; those moved into the body, which leaves nothing else here
 * to click and makes the biggest target on the screen do the most common thing. The chevron stays
 * as the affordance, at 24px, and carries no handler of its own.
 *
 * The row answers three questions and nothing else: which store, how much is pending, and is
 * anything late. Everything it used to say and no longer does was measured out rather than
 * dropped on taste:
 *
 * - **The seller type as a word.** "Comercio" appeared on nine of the collector's ten rows. Only
 *   the deviation is marked now, as an icon with its label for screen readers, which is the same
 *   rule the list's own state chips already follow (`interface-patterns.md` §8).
 * - **"Pendiente en pedidos abiertos {amount}".** Forty-four characters that wrapped to two lines at
 *   375px and buried the only part anyone reads. The figure is the figure, right-aligned in its own
 *   column so a phone can compare ten stores by running down one edge, with the word underneath it.
 * - **The open-order count.** "16 pedidos abiertos · 20 productos pendientes" needs 159px against
 *   the 128 this block gets once the money has its column. It moved into the body, where the row is
 *   full-width and the count is next to the products it counts.
 */
export default function StoreGroupHeader({
  store,
  pendingProductCount,
  overdueProductCount,
  debts,
  locale,
  isExpanded,
  onToggleExpand,
  desktopActions,
}: StoreGroupHeaderProps) {
  const t = useTranslations("orderListing");
  const tStores = useTranslations("stores");

  const isPerson = store.sellerType === "PERSON";
  const isProxy = store.sellerType === "PROXY";
  const TypeIcon = isPerson ? UserIcon : isProxy ? Truck : StoreIcon;
  const sellerTypeLabel = isPerson
    ? tStores("create.sellerTypePerson")
    : isProxy
      ? tStores("create.sellerTypeProxy")
      : tStores("create.sellerTypeRetailer");
  const bodyId = `store-group-body-${store.id}`;

  const figures = resolveDebtFigures(debts);
  // The code ("PEN", "USD") only earns its 29px when the symbol alone is ambiguous, which is exactly
  // when this store holds more than one currency. In a single-currency group "S/" already IS PEN.
  const showCurrencyCode = figures.length > 1;
  const money = (amountMinor: number, currencyCode: string) =>
    showCurrencyCode
      ? formatAmountWithSymbol(amountMinor, currencyCode, locale)
      : formatAmountSymbolOnly(amountMinor, currencyCode, locale);

  const primary = figures[0];
  const secondary = figures.slice(1);
  const summaryLabel =
    overdueProductCount > 0
      ? t("storeView.overdueSummary", { overdue: overdueProductCount, total: pendingProductCount })
      : t("storeView.productSummary", { products: pendingProductCount });

  return (
    // `relative` is load-bearing: it is what the disclosure's `::after` overlay resolves `inset-0`
    // against, and therefore what makes the whole padded row the target instead of just the text.
    <div className="relative flex items-center gap-3 p-4 md:gap-4 md:p-5">
      {/*
        The APG disclosure shape: a heading that wraps the button, so the list of stores has a real
        heading structure and each group's control announces the store it opens. The heading level
        is 3 because the page owns h1 and the list section owns h2.
      */}
      <h3 className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-controls={bodyId}
          // The whole row is the target, padding and chevron included, bought with an `::after`
          // overlay at `inset-0` of the `relative` row above. Without it the button's box stops at
          // the identity block, and the card's own padding and its chevron are dead pixels: press
          // the chevron, which is the thing that LOOKS like the control, and nothing happens.
          //
          // Same shape `OrderCard` already uses for "the card is one big link": the overlay owns
          // every pixel, the content is inert, and the controls that must survive it opt back in
          // (`pointer-events-auto` / a later positioned sibling). `text-left` because a button
          // centers its content by default and this one holds a whole identity block.
          //
          // The focus ring is drawn on the OVERLAY, not on the button's own box, so what the
          // keyboard shows matches what the pointer can actually hit.
          className="flex w-full min-w-0 items-center gap-3 text-left after:absolute after:inset-0 after:rounded-[var(--radius-2xl)] after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:[outline-color:var(--focus-ring)] md:gap-4"
        >
          {/* 32, not a bespoke 36: `StoreAvatarSize` is a closed set (24/32/40/56) and the playbook
            forbids tuning a canonical component's geometry in a consumer. It also happens to be the
            better number here, since every pixel it gives back goes to the store name, which needs
            121 of the 132 this leaves it. */}
          {store.logoUrl ? (
            <StoreAvatar store={{ name: store.name, logo: { src: store.logoUrl, aspect: "square" } }} size={32} />
          ) : (
            <StoreAvatar store={{ name: store.name }} size={32} isPerson={isPerson} />
          )}

          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 truncate [font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
                {store.name}
              </span>
              {/* Only a seller type that deviates from "Comercio" is marked, and it is marked with a
                shape rather than with a colour, so the signal survives for a reader who cannot tell
                the two apart (`ADR 0006`). */}
              {(isPerson || isProxy) && (
                <span className="inline-flex shrink-0 [color:var(--text-muted)]">
                  <TypeIcon size={12} aria-hidden />
                  <span className="sr-only">{sellerTypeLabel}</span>
                </span>
              )}
            </span>
            <span
              className={cn(
                "block truncate [font-size:var(--text-caption)]",
                overdueProductCount > 0 ? "[color:var(--warning-chip-text)]" : "[color:var(--text-secondary)]",
              )}
            >
              {summaryLabel}
            </span>
          </span>

          {primary && (
            <span className="shrink-0 text-right">
              <span
                className={cn(
                  "block [font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] whitespace-nowrap tabular-nums",
                  primary.kind === "credit"
                    ? "[color:var(--success-chip-text)]"
                    : primary.kind === "none"
                      ? "[font-weight:var(--font-weight-medium)] [color:var(--text-muted)]"
                      : "[color:var(--text-primary)]",
                )}
              >
                {money(primary.amountMinor, primary.currencyCode)}
              </span>
              {secondary.map((figure) => (
                <span
                  key={figure.currencyCode}
                  className="block [font-size:var(--text-caption)] whitespace-nowrap [color:var(--text-secondary)] tabular-nums"
                >
                  {money(figure.amountMinor, figure.currencyCode)}
                </span>
              ))}
              <span className="block [font-size:11px] [line-height:14px] whitespace-nowrap [color:var(--text-muted)]">
                {primary.kind === "credit"
                  ? t("storeView.creditLabel")
                  : primary.kind === "none"
                    ? t("storeView.noDebtLabel")
                    : t("storeView.pendingLabel")}
              </span>
            </span>
          )}
        </button>
      </h3>

      {/* Desktop keeps its actions on this row, where there has always been width for them. Below
          `md` the same cluster renders once inside the body instead (`StoreGroupedView`), never
          both: two mount points at one breakpoint each is the pattern this file already used for
          the "Sin desglosar" trigger. */}
      {/* `relative` puts this cluster above the disclosure overlay: both are positioned with
          `z-index: auto`, so tree order decides and this comes later. Without it the overlay would
          swallow "Registrar pago" and "Ver tienda" on desktop. */}
      {desktopActions && (
        <div className="relative hidden shrink-0 items-center gap-2 md:flex">{desktopActions}</div>
      )}

      <span
        aria-hidden
        // Decoration, and `pointer-events-none` is what makes it behave like decoration: it is the
        // thing that looks most like the control, so a press has to fall through to the overlay
        // underneath rather than landing on an inert span.
        className="pointer-events-none grid size-6 shrink-0 place-items-center [color:var(--text-muted)]"
      >
        <ChevronDown
          width={16}
          height={16}
          className={cn("transition-transform duration-200", isExpanded && "rotate-180")}
        />
      </span>
    </div>
  );
}
