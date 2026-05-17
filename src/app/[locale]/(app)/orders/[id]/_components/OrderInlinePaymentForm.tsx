"use client";

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { CircleDollarSign, X } from "lucide-react";
import { cn } from "@/lib/styles";
import { formatAmountSymbolOnly } from "@/lib/currency";
import { sanitizeDecimalInput } from "@/lib/decimalInput";

type OrderInlinePaymentFormProps = {
  currencyCode: string;
  remainingAmount: number;
  orderDate: Date;
  locale: string;
  onCancel: () => void;
  onSubmit: (amount: number, paymentDate: Date) => Promise<{ ok: boolean; error?: string }>;
};

function parseDecimalToMinorUnits(value: string): number | null {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

function minorUnitsToInputString(minor: number): string {
  return (minor / 100).toFixed(2);
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map((part) => Number(part));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Inline "Nuevo pago" panel rendered inside the Pagos aside card.
 *
 * Mirrors demo CSS `.pay-inline-panel` exactly (line 1510 of demo-screens.html):
 *   - Negative side margins (`-18px` mobile / `-22px` ≥768px) so the panel BLEEDS to
 *     the edges of the parent `.card.elevated` and the `border-top` spans 100% width
 *   - Distinct background `var(--surface)` (the card uses `--surface-elevated`) so the
 *     panel reads as a layered surface, not the same plane as the totals above it
 *   - `border-radius: 0 0 15px 15px` so the bottom corners hug the card's rounded shell
 *
 * Children layout matches demo `#s7-order-detail-pay-modal .pay-inline-panel` (no
 * currency select — the order's currency is fixed per Sergio's spec).
 */
export default function OrderInlinePaymentForm({
  currencyCode,
  remainingAmount,
  orderDate,
  locale,
  onCancel,
  onSubmit,
}: OrderInlinePaymentFormProps) {
  const t = useTranslations("orders");
  const today = new Date();
  const amountRef = useRef<HTMLInputElement>(null);
  const [amountStr, setAmountStr] = useState("");
  const [paymentDateStr, setPaymentDateStr] = useState<string>(() => toIsoDate(today));
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    amountRef.current?.focus();
  }, []);

  const paymentDate = parseIsoDate(paymentDateStr);
  const parsedAmount = parseDecimalToMinorUnits(amountStr);
  const amountExceedsBalance = parsedAmount !== null && parsedAmount > remainingAmount;
  const dateBeforeOrder =
    paymentDate !== null && paymentDate < new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
  const dateFuture = paymentDate !== null && paymentDate > today;

  const canSubmit =
    parsedAmount !== null &&
    parsedAmount > 0 &&
    !amountExceedsBalance &&
    paymentDate !== null &&
    !dateBeforeOrder &&
    !dateFuture;

  const halfMinor = Math.max(1, Math.floor(remainingAmount / 2));
  const remainingLabel = formatAmountSymbolOnly(remainingAmount, currencyCode, locale);
  const halfLabel = formatAmountSymbolOnly(halfMinor, currencyCode, locale);

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSubmit || parsedAmount === null || paymentDate === null) return;
    setIsPending(true);
    setError(null);
    const result = await onSubmit(parsedAmount, paymentDate);
    setIsPending(false);
    if (!result.ok) {
      if (result.error === "EXCEEDS_BALANCE") {
        setError(t("detail.payments.amountExceedsBalance", { remaining: remainingLabel }));
      } else if (result.error === "DATE_BEFORE_ORDER") {
        setError(t("detail.payments.dateBeforeOrder"));
      } else {
        setError(t("detail.payments.errorAdd"));
      }
    }
  }

  // Demo `.input`: padding 10px 12px · border-strong · radius 8px · 14px · bg surface-elevated · focus accent ring
  const inputClass =
    "w-full rounded-lg px-3 py-2.5 text-[14px] [color:var(--text-primary)] outline-none transition-[border-color,box-shadow]" +
    " [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]" +
    " focus:[border-color:var(--accent)] focus:[box-shadow:0_0_0_3px_color-mix(in_oklch,var(--accent)_18%,transparent)]" +
    " placeholder:[color:var(--text-muted)]";

  // Demo `.field-label`: 13px text-secondary mb 6px (NOT mb 4px / 12px as I had)
  const labelClass = "mb-1.5 block text-[13px] [color:var(--text-secondary)]";

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
          className={cn(
            "grid size-6 place-items-center rounded-md",
            "[color:var(--text-muted)] hover:[color:var(--text-primary)]",
            "transition-colors hover:[background:color-mix(in_oklch,var(--text-primary)_6%,transparent)]",
          )}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      {/* Monto — full-width (currency select intentionally omitted; order currency is fixed). */}
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
          onChange={(e) => setAmountStr(sanitizeDecimalInput(e.target.value))}
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

      {/* Quick-picks `.filter-pill` (demo overrides class to font 11px / padding 3px 9px for the form). */}
      {remainingAmount > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAmountStr(minorUnitsToInputString(remainingAmount))}
            disabled={isPending}
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              "[color:var(--text-secondary)] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]",
              "transition-colors hover:[background:color-mix(in_oklch,var(--text-primary)_6%,var(--surface-elevated))]",
            )}
          >
            {t("detail.payments.quickPickRemaining", { amount: remainingLabel })}
          </button>
          <button
            type="button"
            onClick={() => setAmountStr(minorUnitsToInputString(halfMinor))}
            disabled={isPending}
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              "[color:var(--text-secondary)] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]",
              "transition-colors hover:[background:color-mix(in_oklch,var(--text-primary)_6%,var(--surface-elevated))]",
            )}
          >
            {t("detail.payments.quickPickHalf", { amount: halfLabel })}
          </button>
        </div>
      )}

      <div className="mb-2.5">
        <label htmlFor="pif-date" className={labelClass}>
          {t("detail.payments.dateLabel")}
        </label>
        <input
          id="pif-date"
          type="date"
          aria-label={t("detail.payments.dateLabel")}
          value={paymentDateStr}
          max={toIsoDate(today)}
          onChange={(e) => setPaymentDateStr(e.target.value)}
          disabled={isPending}
          className={cn(inputClass, "tabular-nums", dateBeforeOrder && "[border-color:var(--destructive)]")}
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
      </div>

      {error && (
        <p role="alert" className="text-destructive mb-2 text-[12px]">
          {error}
        </p>
      )}

      {/* Submit — `.btn.accent.full`: min-height 40px, padding 10px 16px, radius 8px */}
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
        {isPending ? t("detail.payments.submittingPayment") : t("detail.payments.submitPayment")}
      </button>
    </form>
  );
}
