"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, CircleOff, Trash2, X } from "lucide-react";
import Chip from "@/components/core/Chip";
import Typography from "@/components/core/Typography";
import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import { Modal } from "@/components/modules/Modal";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { formatAmountSymbolOnly } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";
import {
  isOptimisticPaymentId,
  resolvePaymentCoverage,
  type StorePaymentCoverage,
} from "@/lib/orders/storePaymentPresentation";
import type { StorePaymentListRow } from "@/lib/data/orders/storePaymentQueries";
import { cn } from "@/lib/styles";

type StorePaymentRowProps = {
  payment: StorePaymentListRow;
  locale: string;
  onConfirmDelete: (paymentId: string) => Promise<{ ok: boolean; error?: string }>;
};

/**
 * One payment in "Pagos a esta tienda": date, what it covers, amount, delete — plus a breakdown
 * panel on the rare payment that names more than one thing.
 *
 * The coverage cell is the point of the row. Every payment in the collection today declares exactly
 * one target, so the collapsed row answers "what was this for?" outright and the toggle is not even
 * rendered; the panel exists for the multi-line payments the schema allows and nobody has made yet.
 * Anything deeper than that panel (editing or removing a single declaration) belongs to the order
 * detail, per BR-04-31.
 *
 * Layout is two lines on mobile and one on desktop, and the coverage cell is written out once per
 * breakpoint rather than reordered with CSS. That duplication is deliberate: the amount and the
 * delete control sit BEFORE the coverage on mobile and AFTER it on desktop, and the only ways to
 * get one DOM order to render both are `order`/`grid-area`, which is precisely the reading-order
 * mismatch WCAG 1.3.2 and 2.4.3 exist to prevent. Exactly one copy is ever in the accessibility
 * tree, because the other is `display: none`.
 *
 * The two controls stay together on line A at BOTH breakpoints, and that is a tap-target
 * constraint, not a layout preference. Sitting the toggle on line B put its `inset:-8px` hit area
 * within ~7px of the delete button's, and in an overlap the later element in the DOM takes the
 * whole contested band, so the delete button lost most of the 44px it is written to have. Side by
 * side, the clearance is an explicit `ml-3` rather than a number that depends on where a descender
 * happens to fall.
 */
export default function StorePaymentRow({ payment, locale, onConfirmDelete }: StorePaymentRowProps) {
  const tStores = useTranslations("stores");
  const panelId = `${useId()}-breakdown`;
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountLabel = formatAmountSymbolOnly(payment.amount, payment.currencyCode, locale);
  const dateLabel = formatDomainDate(payment.paymentDate, locale, { dateStyle: "medium" });
  const unassignedMinor = payment.amount - payment.allocatedTotal;
  const hasUnassigned = unassignedMinor > 0;
  const coverage = resolvePaymentCoverage(payment);
  // With one declaration the collapsed row already says everything the panel would.
  const hasBreakdown = payment.allocations.length >= 2;

  async function handleConfirm() {
    setIsPending(true);
    setError(null);
    const result = await onConfirmDelete(payment.id);
    setIsPending(false);
    if (result.ok) {
      setModalOpen(false);
    } else {
      setError(tStores("redesign.detail.payments.errorDelete"));
    }
  }

  // A row the client added and the server has not answered for yet has no id to delete by. Left
  // clickable, a fast collector could remove it mid-flight and get an error toast for a payment
  // that was in fact recorded, plus a transient duplicate (the temp row's rollback landing next to
  // the real row that just arrived). The figures did converge on their own; what did not was what
  // the user was told. Disabled rather than hidden so the row's controls do not reflow, and it is
  // a sub-second state.
  const isAwaitingServerId = isOptimisticPaymentId(payment.id);

  const deleteButton = (
    <button
      type="button"
      onClick={() => setModalOpen(true)}
      disabled={isAwaitingServerId}
      aria-label={tStores("redesign.detail.payments.deleteAria", { amount: amountLabel, date: dateLabel })}
      // Tap target ≥44×44 on mobile via the `::before` pseudo (same mechanism as `IconButton`):
      // padding inside a fixed `size-*` box never grows the box itself, only the negative margin
      // trick used to fake it. `inset:-8px` on a 28px (`size-7`) box reaches the 44px minimum;
      // `md:before:inset-0` drops the extra hit area on desktop, where the row packs controls
      // tightly and mouse precision does not need it.
      className="text-text-muted hover:text-text-title focus-visible:ring-ring focus-visible:ring-offset-background relative grid size-7 shrink-0 cursor-pointer place-items-center rounded-md transition-colors before:absolute before:[inset:-8px] before:content-[''] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-default disabled:opacity-40 md:before:inset-0"
    >
      <X className="size-[13px]" aria-hidden />
    </button>
  );

  const breakdownToggle = hasBreakdown ? (
    <button
      type="button"
      aria-expanded={isBreakdownOpen}
      aria-controls={panelId}
      onClick={() => setIsBreakdownOpen((prev) => !prev)}
      aria-label={tStores("redesign.detail.payments.breakdownToggleAria", { amount: amountLabel, date: dateLabel })}
      // Only on the click that OPENS it. The delegate fires on every click of an element carrying
      // the attribute, so leaving it on unconditionally counted each collapse as another open and
      // doubled the figure for anyone who closed the panel again.
      data-ph-event={isBreakdownOpen ? undefined : POSTHOG_EVENTS.STORE.PAYMENT_BREAKDOWN_OPENED}
      // Same tap-target mechanism as `deleteButton` above, plus `ml-3`: two controls expanded by
      // `inset:-8px` need 16px between their boxes or their pseudo-elements overlap, and in an
      // overlap the one LATER in the DOM takes the whole contested band. The row's own `gap-2` is
      // 8px, so this adds the missing clearance (8 + 12 = 20px). Dropped on desktop, where
      // `md:before:inset-0` removes the expansion and the tighter `md:gap-3` is what the row wants.
      className="text-text-muted hover:text-text-title focus-visible:ring-ring focus-visible:ring-offset-background relative ml-3 grid size-7 shrink-0 cursor-pointer place-items-center rounded-md transition-colors before:absolute before:[inset:-8px] before:content-[''] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:ml-0 md:before:inset-0"
    >
      <ChevronDown className={cn("size-[14px] transition-transform", isBreakdownOpen && "rotate-180")} aria-hidden />
    </button>
  ) : null;

  return (
    <>
      {/* `tabIndex={-1}` is not for keyboard users: it makes the row a programmatic focus target so
          "Ver los N pagos" can move focus to the first revealed row instead of stranding it. */}
      <li
        tabIndex={-1}
        className="flex flex-col py-2 [border-bottom:1px_solid_var(--border)] last:border-b-0 focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:-2px]"
      >
        {/* Line A on mobile, the whole row on desktop. */}
        <div className="flex items-baseline gap-2 md:gap-3">
          <span className="text-text-muted shrink-0 font-mono text-[12px] tabular-nums md:w-[92px]">{dateLabel}</span>
          <div className="hidden min-w-0 flex-1 md:block">
            <CoverageCell
              coverage={coverage}
              locale={locale}
              unassignedMinor={hasUnassigned ? unassignedMinor : null}
              currencyCode={payment.currencyCode}
            />
          </div>
          <span className="text-text-title ml-auto shrink-0 text-[14px] font-semibold tabular-nums md:ml-0">
            {amountLabel}
          </span>
          {deleteButton}
          {breakdownToggle}
        </div>

        {/* Line B on mobile only: the coverage the desktop row carries inline. */}
        <div className="mt-1 md:hidden">
          <CoverageCell
            coverage={coverage}
            locale={locale}
            unassignedMinor={hasUnassigned ? unassignedMinor : null}
            currencyCode={payment.currencyCode}
          />
        </div>

        {payment.note && (
          <p className="text-text-muted mt-0.5 text-[11px] leading-snug">
            {tStores("redesign.detail.payments.noteLabel", { note: payment.note })}
          </p>
        )}

        {hasBreakdown && isBreakdownOpen && (
          <div
            id={panelId}
            role="group"
            aria-label={tStores("redesign.detail.payments.breakdownHeading")}
            className="mt-1.5 md:pl-[104px]"
          >
            <p className="[font-family:var(--font-mono)] text-[11px] tracking-wide [color:var(--text-muted)] uppercase">
              {tStores("redesign.detail.payments.breakdownHeading")}
            </p>
            {payment.allocations.map((allocation, index) => (
              <div
                key={`${allocation.orderId}-${allocation.orderItemId ?? "order"}-${index}`}
                className="flex flex-wrap items-baseline justify-between gap-x-2 py-1 text-[12px] [color:var(--text-secondary)]"
              >
                <span className="min-w-0">
                  <OrderReferenceLink
                    locale={locale}
                    orderId={allocation.orderId}
                    humanReadableId={allocation.orderHumanReadableId}
                  />
                  <span aria-hidden> · </span>
                  {allocation.orderItemName ?? tStores("redesign.detail.payments.coverageWholeOrder")}
                  {allocation.orderCancelled && <CancelledMarker />}
                </span>
                <span className="tabular-nums">
                  {allocation.settlesTarget && allocation.amountMinor === 0
                    ? tStores("redesign.detail.payments.coverageSettled")
                    : formatAmountSymbolOnly(allocation.amountMinor, payment.currencyCode, locale)}
                </span>
              </div>
            ))}
            {hasUnassigned && (
              <div className="text-warning flex items-baseline justify-between gap-x-2 py-1 text-[12px]">
                <span>{tStores("redesign.detail.payments.breakdownUnassigned")}</span>
                <span className="tabular-nums">
                  {formatAmountSymbolOnly(unassignedMinor, payment.currencyCode, locale)}
                </span>
              </div>
            )}
          </div>
        )}
      </li>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={tStores("redesign.detail.payments.deleteModalTitle")}
        subtitle={
          payment.claimingOrdersCount > 0
            ? tStores("redesign.detail.payments.deleteModalDescriptionWithAllocations", {
                amount: amountLabel,
                date: dateLabel,
                // The copy counts PEDIDOS ("su asignación con {count} pedidos"), so the figure is
                // distinct orders and not allocation lines: a payment broken down across two
                // products of one order carries three lines and touches one order.
                count: payment.claimingOrdersCount,
              })
            : tStores("redesign.detail.payments.deleteModalDescription", { amount: amountLabel, date: dateLabel })
        }
        icon={<Trash2 size={20} aria-hidden="true" />}
        tone="destructive"
        role="alertdialog"
        dismissible={false}
        primaryAction={{
          label: isPending ? "…" : tStores("redesign.detail.payments.deleteConfirm"),
          onClick: handleConfirm,
          variant: "destructive",
          loading: isPending,
          disabled: isPending,
        }}
        secondaryAction={{
          label: tStores("redesign.detail.payments.deleteCancel"),
          onClick: () => setModalOpen(false),
          disabled: isPending,
        }}
      >
        {error && (
          <Typography size="sm" className="text-destructive" role="alert">
            {error}
          </Typography>
        )}
      </Modal>
    </>
  );
}

function OrderReferenceLink({
  locale,
  orderId,
  humanReadableId,
}: {
  locale: string;
  orderId: string;
  humanReadableId: string;
}) {
  return (
    <ViewTransitionLink
      href={`/${locale}${ROUTES.orders}/${orderId}`}
      viewTransitionEntity="order"
      className="[color:var(--accent)] underline-offset-2 hover:underline"
    >
      {humanReadableId}
    </ViewTransitionLink>
  );
}

/**
 * The one thing the collapsed row must never omit: this money is declared against an order that was
 * cancelled, so it is sunk. Word plus icon, never colour alone (ADR 0006), and the same "Perdido"
 * vocabulary the order detail and the dashboard already use for the same money.
 */
function CancelledMarker() {
  const tStores = useTranslations("stores");
  return (
    <Chip
      variant="warning"
      size="sm"
      icon={<CircleOff size={11} aria-hidden="true" />}
      className="ml-1.5 shrink-0 align-middle"
    >
      {tStores("redesign.detail.payments.cancelledMarker")}
    </Chip>
  );
}

type CoverageCellProps = {
  coverage: StorePaymentCoverage;
  locale: string;
  /** Money on this payment nobody has declared yet, or null when it is fully declared. */
  unassignedMinor: number | null;
  currencyCode: string;
};

/** What the payment covers, in one truncating line. */
function CoverageCell({ coverage, locale, unassignedMinor, currencyCode }: CoverageCellProps) {
  const tStores = useTranslations("stores");

  const unassignedChip =
    unassignedMinor != null ? (
      <Chip variant="warning" size="sm" className="ml-1.5 shrink-0 align-middle">
        {tStores("redesign.detail.payments.unassignedBadge", {
          amount: formatAmountSymbolOnly(unassignedMinor, currencyCode, locale),
        })}
      </Chip>
    ) : null;

  if (coverage.kind === "unassigned") {
    return <span className="text-[12px] md:text-[13px]">{unassignedChip}</span>;
  }

  if (coverage.kind === "manyOrders") {
    return (
      <span className="flex min-w-0 items-baseline text-[12px] [color:var(--text-secondary)] md:text-[13px]">
        <span className="truncate">
          {tStores("redesign.detail.payments.coverageManyOrders", { count: coverage.count })}
        </span>
        {/* The collapsed row cannot name the order here, so the sunk-money marker is the ONLY thing
            telling the collector part of this payment died with a cancelled order. It is the one
            shape where omitting it leaves no other signal on the row. */}
        {coverage.anyCancelled && <CancelledMarker />}
        {unassignedChip}
      </span>
    );
  }

  const target =
    coverage.kind === "item"
      ? coverage.itemName
      : coverage.kind === "manyItems"
        ? tStores("redesign.detail.payments.coverageManyProducts", { count: coverage.count })
        : tStores("redesign.detail.payments.coverageWholeOrder");
  const settledSuffix =
    (coverage.kind === "item" || coverage.kind === "order") && coverage.settled
      ? ` · ${tStores("redesign.detail.payments.coverageSettled")}`
      : "";

  // Only the naming text truncates. The chips sit outside it and never shrink: they carry the two
  // facts the row cannot afford to lose (this money is sunk / this money is undeclared), and inside
  // the truncating span a long enough product name clips them away entirely. "ORD-20250721-01 ·
  // Kagurabachi Especial" already measures ~295px against 309px of usable mobile width.
  return (
    <span
      className="flex min-w-0 items-baseline text-[12px] [color:var(--text-secondary)] md:text-[13px]"
      title={`${coverage.orderHumanReadableId} · ${target}${settledSuffix}`}
    >
      <span className="truncate">
        <OrderReferenceLink
          locale={locale}
          orderId={coverage.orderId}
          humanReadableId={coverage.orderHumanReadableId}
        />
        <span aria-hidden> · </span>
        {target}
        {settledSuffix}
      </span>
      {coverage.orderCancelled && <CancelledMarker />}
      {unassignedChip}
    </span>
  );
}
