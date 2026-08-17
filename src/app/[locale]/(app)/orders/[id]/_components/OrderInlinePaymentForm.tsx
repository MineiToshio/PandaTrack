"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { CircleDollarSign, X } from "lucide-react";
import { cn } from "@/lib/styles";
import { formatAmountSymbolOnly, getCurrencyDecimals, MINOR_UNITS_PER_MAJOR } from "@/lib/currency";
import { resolveSplitStep } from "@/lib/orders/splitPaymentAmount";
import { sanitizeDecimalInput } from "@/lib/decimalInput";
import { parseDecimalToMinorUnits } from "@/lib/money/parseDecimalToMinorUnits";
import { formatDomainShortDate, toDomainDate, toLocalIsoDateString, utcDomainDateToLocal } from "@/lib/domainDate";
import {
  createBreakdownState,
  deriveBreakdown,
  hasBreakdownDraft,
  offersBreakdown,
  recomputeBreakdown,
  resolveBreakdownAnalyticsMode,
  type BreakdownAllocationInput,
  type BreakdownItem,
  type BreakdownPanelState,
} from "@/lib/orders/orderPaymentBreakdown";
import OrderPaymentBreakdownPanel, { useBreakdownContext } from "../../_components/share/OrderPaymentBreakdownPanel";

/** Which formula produced the lines being submitted. Analytics only. */
export type OrderPaymentSplitMode = ReturnType<typeof resolveBreakdownAnalyticsMode>;

/** What the form submits: an amount, the day it left the pocket, and who it names. */
export type OrderInlinePaymentSubmission = {
  amount: number;
  paymentDate: Date;
  /** Product lines only. The part that names no product is derived server-side as `amount - sum`. */
  allocations: BreakdownAllocationInput[];
  splitMode: OrderPaymentSplitMode;
  /**
   * Whether this form is staying mounted to read the verdict itself.
   *
   * It decides WHO reports a refusal, and there is exactly one rule: the form's own inline error is
   * authoritative, and the coordinator's toast fires only when the form is already gone. On mobile
   * this surface is a `<Modal>` and the toast paints BEHIND it, so a refusal routed to the toast
   * over a live sheet leaves a hanging sheet, a full draft inside it and nothing on screen saying
   * why.
   */
  awaitsVerdict: boolean;
};

/** What the coordinator answers with. `unanswered` is not a refusal: it is the absence of one. */
export type OrderInlinePaymentOutcome = {
  ok: boolean;
  error?: string;
  /**
   * The sentence to print, when saying it needs facts the form does not hold.
   *
   * One refusal is in that shape: `STORE_DEBT_EXCEEDED` names the STORE and what is still owed it
   * across every order, and neither figure exists in a form scoped to one order. The alternative
   * was dragging both through two intermediate surfaces as props, to be interpolated back into a
   * string only the coordinator can build correctly. Anything the form can say for itself, it says
   * for itself (`describeRefusal`), so this stays the exception rather than a second describer.
   */
  message?: string;
  /** The product the server named, so its row can carry the destructive rail. */
  orderItemId?: string;
  /** No verdict arrived at all (a dropped connection). Nothing was refused, so the CTA lives on. */
  unanswered?: boolean;
};

/**
 * The two percentage quick-picks, as percentages of the REMAINING balance.
 *
 * 50 is the universal mental anchor; 20 is where the collector's own history piles up (the 18-25%
 * band holds 29 of the 79 partial first payments). A third chip was measured and dropped: at 320px
 * every chip costs real width, and the 29-33% band is 8 cases.
 */
const PERCENT_QUICK_PICKS = [50, 20] as const;

/** Stable identity for the default, so the breakdown context memo does not rebuild every render. */
const EMPTY_ITEMS: BreakdownItem[] = [];

type QuickPick = "all" | (typeof PERCENT_QUICK_PICKS)[number];

type OrderInlinePaymentFormProps = {
  currencyCode: string;
  remainingAmount: number;
  orderDate: Date;
  locale: string;
  /**
   * Amount the form opens with, in minor units. Set by a caller whose own label already named a
   * figure ("Registrar {amount}"): landing on an empty field with the submit greyed out would make
   * that label a promise the panel does not keep. Omitted everywhere else, because a prefilled
   * amount nobody asked for is an amount the collector has to notice and clear.
   */
  initialAmountMinor?: number;
  /**
   * Whether the amount field takes focus on mount. True in the desktop inline panel, where focusing
   * an input costs nothing; false in the mobile sheet, where it raises the keyboard over the very
   * quick-picks that make this a one-tap flow. The field stays one tap away either way.
   */
  autoFocus?: boolean;
  /**
   * The order's products, for the breakdown panel. Empty (or a single product) means no panel: with
   * one product `addOrderPayment` already names it, and with none there is nothing to split.
   */
  items?: BreakdownItem[];
  /** The order's own total. The denominator of the by-price percentage. */
  orderTotalCostMinor?: number;
  /** Money already on this order naming no product. Named by the panel, never split. */
  undetailedPaidMinor?: number;
  onCancel: () => void;
  /**
   * Hands the submission to the coordinator, which owns the optimistic patch and the rollback.
   *
   * The form awaits it ONLY when the breakdown carries a draft (`submission.awaitsVerdict`). With
   * the breakdown folded or empty this stays Optimistic Confirmation: the caller dismisses in the
   * same tick and the coordinator's toast is what reports a refusal, because there is nothing on
   * screen left to lose. With a draft there is: `handleAddPayment` rolls back `payments`, NOT the
   * draft, so dismissing on a refusal destroys up to six hand-typed lines with no way back.
   */
  onSubmit: (submission: OrderInlinePaymentSubmission) => Promise<OrderInlinePaymentOutcome>;
  /** Dismisses the form. Called in the same tick on the optimistic path, and on `ok` otherwise. */
  onSubmitted: () => void;
};

function minorUnitsToInputString(minor: number, currencyCode: string): string {
  return (minor / MINOR_UNITS_PER_MAJOR).toFixed(getCurrencyDecimals(currencyCode));
}

/**
 * A percentage of the remaining balance, rounded to the currency's own smallest representable
 * amount: the cent for a two-decimal currency, the whole major unit for a zero-decimal one (money
 * is stored ×100 for every currency, so a yen is 100 minor units). Never zero and never more than
 * the balance itself, so a chip can only ever write an amount the form would accept.
 */
function percentOfRemaining(remainingAmount: number, percent: number, currencyCode: string): number {
  const step = resolveSplitStep(currencyCode);
  const rounded = Math.round((remainingAmount * percent) / 100 / step) * step;
  return Math.min(remainingAmount, Math.max(step, rounded));
}

/** Local-midnight `Date` for a `yyyy-mm-dd` input value, to compare against the other local
    boundaries in this form. Never submitted as-is: see `handleSubmit`. */
function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map((part) => Number(part));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Inline "Nuevo pago" panel rendered inside the Pagos aside card.
 *
 * The form speaks about ONE thing: money. An amount, the day, and a button that says what is about
 * to happen. The date collapses to a line while it still reads "today" (which is the value 626 of
 * 626 recorded payments were fine with) and the coverage question is gone entirely: marking a
 * product paid is a claim about a product, and it lives on the product's own row.
 *
 * Visual contract: see the Orders prototype at `docs/product/prd-02-collector-app/frd-05-order-payment-shipment/prototype/order-payment-shipment.html`.
 * The `.pay-inline-panel` treatment:
 *   - Negative side margins (`-18px` mobile / `-22px` ≥768px) so the panel BLEEDS to
 *     the edges of the parent `.card.elevated` and the `border-top` spans 100% width
 *   - Distinct background `var(--surface)` (the card uses `--surface-elevated`) so the
 *     panel reads as a layered surface, not the same plane as the totals above it
 *   - `border-radius: 0 0 15px 15px` so the bottom corners hug the card's rounded shell
 *
 * Children layout follows the same panel (no currency select — the order's currency is
 * fixed per spec).
 */
export default function OrderInlinePaymentForm({
  currencyCode,
  remainingAmount,
  orderDate,
  locale,
  initialAmountMinor,
  autoFocus = true,
  items = EMPTY_ITEMS,
  orderTotalCostMinor = 0,
  undetailedPaidMinor = 0,
  onCancel,
  onSubmit,
  onSubmitted,
}: OrderInlinePaymentFormProps) {
  const t = useTranslations("orders");
  const today = new Date();
  const amountRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  // Initial state, not an effect: the panel is mounted fresh by whoever opens it, so the amount it
  // opens with is part of its birth. `> 0` because a zero prefill is an empty field said twice.
  const prefillMinor = initialAmountMinor !== undefined && initialAmountMinor > 0 ? initialAmountMinor : null;
  const [amountStr, setAmountStr] = useState(() =>
    prefillMinor === null ? "" : minorUnitsToInputString(prefillMinor, currencyCode),
  );
  const [selectedQuickPick, setSelectedQuickPick] = useState<QuickPick | null>(() =>
    // A prefill of exactly the balance is the "Todo" chip's own value, so the chip says so rather
    // than sitting unpressed beside a field it already describes.
    prefillMinor === remainingAmount ? "all" : null,
  );
  const [paymentDateStr, setPaymentDateStr] = useState<string>(() => toLocalIsoDateString(today));
  const [hasTouchedDate, setHasTouchedDate] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [breakdown, setBreakdown] = useState<BreakdownPanelState>(() => createBreakdownState(items));
  /**
   * The server's own verdict, rendered here and nowhere else.
   *
   * `blocksResend` is the half that is easy to miss: a refusal that names no line is a verdict about
   * the AMOUNT or the DATE, so resending an otherwise unchanged submission can only earn the same
   * refusal, and editing a breakdown line must not re-arm the button either. A refusal that DOES
   * name a line leaves the button live, because fixing that line is the way out.
   */
  const [submitError, setSubmitError] = useState<{
    message: string;
    orderItemId: string | null;
    blocksResend: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    if (autoFocus) amountRef.current?.focus();
  }, [autoFocus]);

  const paymentDate = parseIsoDate(paymentDateStr);
  const parsedAmount = parseDecimalToMinorUnits(amountStr, currencyCode);
  const amountExceedsBalance = parsedAmount !== null && parsedAmount > remainingAmount;
  // `orderDate` is a UTC-midnight domain date; convert to local-midnight on the same
  // calendar day so the boundary lines up with `paymentDate` (already local-midnight from
  // the picker) in every timezone — local getters here would shift the day in the Americas.
  const dateBeforeOrder = paymentDate !== null && paymentDate < utcDomainDateToLocal(orderDate);
  const dateFuture = paymentDate !== null && paymentDate > today;
  const dateHasError = dateBeforeOrder || dateFuture;

  // Derived, not stored: a date the form is REFUSING has to be reachable, so an error unfolds the
  // disclosure on its own. That fires on mount too, because nothing stops an order from carrying a
  // future `orderDate`, which makes today's default invalid before anything is touched.
  const isDateExpanded = hasTouchedDate || dateHasError;

  // The disclosure exists to reach the field, so opening it always hands over the focus. One place
  // for both doors into it: the collector pressing "Cambiar", and a refusal forcing it open. The
  // field does not exist while folded, so this cannot be done in the click handler.
  useEffect(() => {
    if (isDateExpanded) dateRef.current?.focus();
  }, [isDateExpanded]);

  // The breakdown's arithmetic, computed ONCE and read by both the panel that renders it and the
  // button that submits it, so the CTA can never disagree with the foot it sits under.
  const showsBreakdown = offersBreakdown(items);
  const breakdownCtx = useBreakdownContext({
    items,
    paymentAmountMinor: parsedAmount ?? 0,
    orderRemainingBalanceMinor: remainingAmount,
    orderTotalCostMinor,
    currencyCode,
  });
  const breakdownDerived = useMemo(
    () => deriveBreakdown(breakdown, breakdownCtx, currencyCode),
    [breakdown, breakdownCtx, currencyCode],
  );

  const canSubmit =
    parsedAmount !== null &&
    parsedAmount > 0 &&
    !amountExceedsBalance &&
    paymentDate !== null &&
    !dateBeforeOrder &&
    !dateFuture &&
    !(showsBreakdown && breakdownDerived.blocked) &&
    !(submitError?.blocksResend ?? false);

  const remainingLabel = formatAmountSymbolOnly(remainingAmount, currencyCode, locale);

  /**
   * A new amount re-runs the split over everything the collector has not pinned, and re-arms a CTA
   * a line-less refusal had shut: that verdict was about this figure, and this figure just moved.
   */
  function applyAmount(minor: number | null, nextAmountStr: string) {
    setAmountStr(nextAmountStr);
    setSubmitError(null);
    setBreakdown((prev) => recomputeBreakdown(prev, { ...breakdownCtx, paymentAmountMinor: minor ?? 0 }));
  }

  function handleQuickPick(pick: QuickPick) {
    const minor = pick === "all" ? remainingAmount : percentOfRemaining(remainingAmount, pick, currencyCode);
    applyAmount(minor, minorUnitsToInputString(minor, currencyCode));
    setSelectedQuickPick(pick);
  }

  function handleAmountChange(value: string) {
    const sanitized = sanitizeDecimalInput(value, currencyCode);
    applyAmount(parseDecimalToMinorUnits(sanitized, currencyCode), sanitized);
    // Typing is the collector overriding the chip, so the chip stops claiming to describe the field.
    setSelectedQuickPick(null);
  }

  function handleExpandDate() {
    setHasTouchedDate(true);
  }

  function handleDateChange(value: string) {
    setPaymentDateStr(value);
    // Once the collector has used the field it stays open for the life of this form: re-folding it
    // the instant they set it back to today would hide their own edit under their hand.
    setHasTouchedDate(true);
    // The other input a line-less refusal can be about, so moving it re-arms the CTA too.
    setSubmitError(null);
  }

  /** Turns a refusal code into the sentence the collector reads, inside this form. */
  function describeRefusal(error: string | undefined): string {
    switch (error) {
      case "EXCEEDS_ITEM_BASE":
        return t("detail.payments.errorItemBase");
      case "ALLOCATION_AMOUNT_INVALID":
        return t("detail.payments.errorAllocationZero");
      case "ITEM_ORDER_MISMATCH":
        return t("detail.payments.errorItemMismatch");
      case "EXCEEDS_BALANCE":
      case "ALLOCATION_SUM_EXCEEDS_PAYMENT":
        return t("detail.payments.amountExceedsBalance", { remaining: remainingLabel });
      case "DATE_BEFORE_ORDER":
        return t("detail.payments.dateBeforeOrder");
      default:
        return t("detail.payments.errorAdd");
    }
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSubmit || parsedAmount === null || paymentDate === null) return;
    const awaitsVerdict = showsBreakdown && hasBreakdownDraft(breakdown);
    const submission: OrderInlinePaymentSubmission = {
      amount: parsedAmount,
      // `paymentDate` is LOCAL midnight (the picker's own shape, needed by the comparisons above).
      // A `Date` crosses the Server Action boundary as its exact instant, so submitting it raw
      // would store the collector's day at 05:00Z instead of 00:00Z. `toDomainDate` pins the same
      // calendar day to UTC midnight, which is what every other domain date sits on.
      paymentDate: toDomainDate(paymentDate),
      // The FOLD is not part of the declaration. Folding the panel hides the lines, it does not
      // withdraw them, and the trigger keeps reading them back ("Desglose · 2 de 2 · S/ 45,00")
      // while it is folded, exactly as §6.2 asks it to. Dropping them here made that summary a
      // claim the payload contradicted: the money went in undesglosado and the screen said it had
      // not. Whether a draft exists is `hasBreakdownDraft`'s question, and it does not ask either.
      allocations: showsBreakdown ? breakdownDerived.allocations : [],
      splitMode: showsBreakdown ? resolveBreakdownAnalyticsMode(breakdown) : "none",
      awaitsVerdict,
    };

    setIsPending(true);
    setSubmitError(null);

    if (!awaitsVerdict) {
      // Optimistic confirmation, unchanged: the caller dismisses in this same tick, so the pending
      // state is only there to stop a second press recording the payment twice, and the refusal is
      // the coordinator's toast to report because this form is already gone.
      void onSubmit(submission);
      onSubmitted();
      return;
    }

    const result = await onSubmit(submission);
    if (result.ok) {
      onSubmitted();
      return;
    }
    // The draft survives the refusal in full: rolling it back is what would cost the collector six
    // hand-typed lines, and the coordinator only ever rolls back the payments list.
    setIsPending(false);
    setSubmitError({
      message: result.unanswered
        ? t("detail.payments.errorUnanswered")
        : // The coordinator's sentence wins where it has one, which is the single case its data is
          // needed for. Everything else the form names itself, including the three refusals only a
          // breakdown can reach.
          (result.message ?? describeRefusal(result.error)),
      orderItemId: result.orderItemId ?? null,
      // Nothing was refused when nothing answered, so the identical resend is exactly the right
      // next move and the CTA stays live for it.
      blocksResend: !result.unanswered && result.orderItemId === undefined,
    });
  }

  // Demo `.input`: padding 10px 12px · border-strong · radius 8px · 14px · bg surface-elevated · focus accent ring
  const inputClass =
    "w-full rounded-lg px-3 py-2.5 text-[14px] [color:var(--text-primary)] outline-none transition-[border-color,box-shadow]" +
    " [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]" +
    " focus:[border-color:var(--accent)] focus:[box-shadow:0_0_0_3px_color-mix(in_oklch,var(--accent)_18%,transparent)]" +
    " placeholder:[color:var(--text-muted)]";

  // Demo `.field-label`: 13px text-secondary mb 6px (NOT mb 4px / 12px as I had)
  const labelClass = "mb-1.5 block text-[13px] [color:var(--text-secondary)]";

  const chipClass = (isSelected: boolean) =>
    cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
      isSelected
        ? "[color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_12%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--accent)_35%,transparent)]"
        : "[color:var(--text-secondary)] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)] hover:[background:color-mix(in_oklab,var(--text-primary)_6%,var(--surface-elevated))]",
    );

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      // Negative side+bottom margins BLEED the panel through the card padding so the top
      // border-line spans 100% of the card width. Tailwind requires the leading-hyphen form
      // for negative arbitrary margins (`-mx-[18px]`, not `mx-[-18px]`).
      className={cn(
        "-mx-[18px] mt-[14px] -mb-[18px] rounded-b-[15px] p-[14px_18px_18px]",
        "sm:-mx-[22px] sm:-mb-[22px] sm:p-[14px_22px_22px]",
        "[background:var(--surface)] [border-top:1px_solid_var(--border)]",
      )}
    >
      {/* Header — eyebrow + X close. Demo HTML uses inline style override on the form-panel
          eyebrow (`font-size:11px; font-weight:700; letter-spacing:0.06em`), NOT the default
          `.eyebrow` mono/500/0.08em. Match that override here for pixel parity. */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-text-muted text-[11px] font-bold tracking-[0.06em] uppercase">
          {t("detail.payments.newPaymentHeading")}
        </span>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("detail.payments.closeFormAria")}
          // Tap target ≥44×44 on mobile via the `::before` pseudo (same mechanism as `IconButton`):
          // padding inside a fixed `size-*` box is consumed by the box and never grows it, so the
          // hit area has to be expanded outward. `inset:-10px` on a 24px (`size-6`) box reaches 44.
          // Nothing interactive is within 10px: the eyebrow to its left is a `<span>` pushed away by
          // `justify-between`, and the first field label below sits behind the header's `mb-3`
          // (12px). `md:before:inset-0` drops the extra area on desktop.
          className={cn(
            "relative grid size-6 place-items-center rounded-md",
            "before:absolute before:[inset:-10px] before:content-[''] md:before:inset-0",
            "[color:var(--text-muted)] hover:[color:var(--text-primary)]",
            "transition-colors hover:[background:color-mix(in_oklch,var(--text-primary)_6%,transparent)]",
          )}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      {/* Monto — full-width (currency select intentionally omitted; order currency is fixed).
          The only element in the panel with typographic weight: one focal point. */}
      <div className="mb-1.5">
        <label htmlFor="pif-amount" className={labelClass}>
          {t("detail.payments.amountLabel")}
        </label>
        <input
          ref={amountRef}
          id="pif-amount"
          type="text"
          inputMode="decimal"
          aria-label={t("detail.payments.amountLabel")}
          aria-invalid={amountExceedsBalance}
          value={amountStr}
          onChange={(e) => handleAmountChange(e.target.value)}
          disabled={isPending}
          placeholder={t("detail.payments.amountPlaceholder")}
          className={cn(
            inputClass,
            "text-[15px] font-semibold tabular-nums",
            amountExceedsBalance && "[border-color:var(--destructive)]",
          )}
        />
        {amountExceedsBalance && (
          <p role="alert" className="text-destructive mt-1 text-[12px]">
            {t("detail.payments.amountExceedsBalance", { remaining: remainingLabel })}
          </p>
        )}
      </div>

      {/* Quick-picks `.filter-pill` (demo overrides class to font 11px / padding 3px 9px for the
          form). "Todo" leads because 536 of 626 recorded payments covered the whole balance; the
          percentage chips show the PERCENTAGE and not the amount, because three amounts do not fit
          at 320px and the percentage is the intention. The amount reaches a screen reader through
          the label and the field in the same frame. */}
      {remainingAmount > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleQuickPick("all")}
            disabled={isPending}
            aria-pressed={selectedQuickPick === "all"}
            aria-label={t("detail.payments.quickPickAllAria", { amount: remainingLabel })}
            className={chipClass(selectedQuickPick === "all")}
          >
            {t("detail.payments.quickPickAll", { amount: remainingLabel })}
          </button>
          {PERCENT_QUICK_PICKS.map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => handleQuickPick(percent)}
              disabled={isPending}
              aria-pressed={selectedQuickPick === percent}
              aria-label={t("detail.payments.quickPickPercentAria", {
                pct: percent,
                amount: formatAmountSymbolOnly(
                  percentOfRemaining(remainingAmount, percent, currencyCode),
                  currencyCode,
                  locale,
                ),
              })}
              className={chipClass(selectedQuickPick === percent)}
            >
              {t("detail.payments.quickPickPercent", { pct: percent })}
            </button>
          ))}
        </div>
      )}

      {/* Fecha — collapsed to a line while it still says today, which is the answer almost every
          time. Once unfolded it stays unfolded for the life of this form: re-folding a field the
          collector just used would hide their own edit. */}
      <div className="mb-2.5" id="pif-date-region">
        {isDateExpanded ? (
          <>
            <label htmlFor="pif-date" className={labelClass}>
              {t("detail.payments.dateLabel")}
            </label>
            <input
              ref={dateRef}
              id="pif-date"
              type="date"
              aria-label={t("detail.payments.dateLabel")}
              value={paymentDateStr}
              max={toLocalIsoDateString(today)}
              onChange={(e) => handleDateChange(e.target.value)}
              disabled={isPending}
              className={cn(inputClass, "tabular-nums", dateHasError && "[border-color:var(--destructive)]")}
            />
            {dateBeforeOrder && (
              <p role="alert" className="text-destructive mt-1 text-[12px]">
                {t("detail.payments.dateBeforeOrder")}
              </p>
            )}
            {dateFuture && (
              <p role="alert" className="text-destructive mt-1 text-[12px]">
                {t("detail.payments.dateFuture")}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="[color:var(--text-secondary)]">
              {t("detail.payments.dateToday", { date: formatDomainShortDate(toDomainDate(today), locale) })}
            </span>
            <span className="text-text-muted" aria-hidden>
              ·
            </span>
            <button
              type="button"
              onClick={handleExpandDate}
              disabled={isPending}
              aria-expanded={false}
              aria-controls="pif-date-region"
              aria-label={t("detail.payments.dateChangeAria")}
              // A 44px tap target bought with a transparent overlay rather than with padding, so the
              // line keeps the density of the panel around it.
              className={cn(
                "relative [color:var(--accent)] underline-offset-2 hover:underline",
                "after:absolute after:inset-x-0 after:-inset-y-3 after:content-['']",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
              )}
            >
              {t("detail.payments.dateChange")}
            </button>
          </div>
        )}
      </div>

      {/* Desglose — after the date because the amount has to exist before splitting it means
          anything, and before the error + submit because it is part of what the button sends. */}
      {showsBreakdown && (
        <OrderPaymentBreakdownPanel
          // One panel per form here, so the namespace is a constant. The review screen mounts one
          // per payment row and passes a per-row id; see the panel's own note.
          instanceId="order-payment"
          // A payment on an existing order is always weighed against that whole order.
          percentBasis="order"
          state={breakdown}
          onStateChange={setBreakdown}
          ctx={breakdownCtx}
          derived={breakdownDerived}
          undetailedPaidMinor={undetailedPaidMinor}
          currencyCode={currencyCode}
          locale={locale}
          disabled={isPending}
          refusedItemId={submitError?.orderItemId ?? null}
        />
      )}

      {/* The server's verdict, inside the form and never only in a toast: on mobile this surface is
          a `<Modal>` and the toast paints behind it. */}
      {submitError && (
        <p role="alert" className="text-destructive mb-2 text-[12px]">
          {submitError.message}
        </p>
      )}

      {/* Submit — `.btn.accent.full`: min-height 40px, padding 10px 16px, radius 8px. The label
          names the outcome ("Registrar S/ 410,00"), not the operation. */}
      <button
        type="submit"
        disabled={!canSubmit || isPending}
        className={cn(
          "inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5",
          "text-[14px] leading-none font-medium",
          "[background:color-mix(in_oklch,var(--accent)_10%,transparent)]",
          "[color:var(--accent)]",
          "[border:1px_solid_color-mix(in_oklch,var(--accent)_28%,transparent)]",
          "transition-colors hover:[background:color-mix(in_oklch,var(--accent)_16%,transparent)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <CircleDollarSign className="size-4 shrink-0" aria-hidden />
        {isPending
          ? t("detail.payments.submittingPayment")
          : parsedAmount !== null && parsedAmount > 0
            ? t("detail.payments.submitPaymentAmount", {
                amount: formatAmountSymbolOnly(parsedAmount, currencyCode, locale),
              })
            : t("detail.payments.submitPayment")}
      </button>
    </form>
  );
}
