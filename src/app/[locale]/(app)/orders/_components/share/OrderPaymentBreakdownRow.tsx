"use client";

import { useTranslations } from "next-intl";
import Checkbox from "@/components/core/Checkbox";
import MoneyAmountInput from "@/components/core/MoneyAmountInput";
import { formatAmountSymbolOnly } from "@/lib/currency";
import { cn } from "@/lib/styles";
import type { BreakdownLine, BreakdownLineState } from "@/lib/orders/orderPaymentBreakdown";

/**
 * The row's ids are namespaced by the PANEL's `instanceId`, not by the item alone.
 *
 * The item key is the product's position on the review screen, so two payment rows of the same
 * draft carry the very same set of item keys: without the panel's own namespace every fact node,
 * every message node and every fill reason would exist twice, and each `aria-describedby` would
 * resolve to whichever copy the document rendered first.
 */

/** Id of the node holding this row's static product facts. Wired to both of the row's controls. */
export function breakdownFactId(instanceId: string, itemId: string): string {
  return `${instanceId}-breakdown-${itemId}-fact`;
}

/** Id of the node saying why this row is empty, blocked or refused. Only rendered when it has one. */
export function breakdownMessageId(instanceId: string, itemId: string): string {
  return `${instanceId}-breakdown-${itemId}-message`;
}

/** Id of the node saying why this row's fill control cannot write. Only rendered when it cannot. */
export function breakdownFillReasonId(instanceId: string, itemId: string): string {
  return `${instanceId}-breakdown-${itemId}-fill-reason`;
}

export type OrderPaymentBreakdownRowProps = {
  /** The owning panel's id namespace, so several panels on one screen never share a node. */
  instanceId: string;
  line: BreakdownLine;
  state: BreakdownLineState;
  /** Whether this payment covers the product. Never derived: it is the collector's own statement. */
  selected: boolean;
  /** The collector typed into this line, so no recalculation may touch it again. */
  pinned: boolean;
  /** Exactly what the field shows. Raw text while it is being typed into. */
  value: string;
  /** The largest amount the "Máx." button may write right now, via `computeFillableMinor`. */
  fillableMinor: number;
  /** The server named this line in a refusal, so it carries the same destructive rail as `overBase`. */
  isRefused: boolean;
  currencyCode: string;
  locale: string;
  /** The submission is in flight: the whole panel is inert (E12). */
  disabled: boolean;
  onToggle: (itemId: string, selected: boolean) => void;
  onChange: (itemId: string, raw: string) => void;
  onBlurLine: (itemId: string) => void;
  onFill: (itemId: string) => void;
};

/**
 * One product of the order inside the payment breakdown.
 *
 * The row prints NO figure derived from the payment. That is the invariant the whole panel is built
 * around (I-1b): the amounts a list shows have to PARTITION the payment, never replicate it, and a
 * per-row ceiling replicates it — with an empty draft every row's ceiling is the whole payment, so
 * six rows advertise six times the money that exists. What a row does print is a static fact about
 * the PRODUCT (its price, what earlier payments already put on it, or that it has no price), true
 * with or without a payment in progress and unchanged by touching another row.
 *
 * The fill control is therefore a WORD ("Máx.") and not a figure. Its accessible name carries the
 * live amount, which is exactly what pressing it writes (I-1), and an `aria-label` is read when the
 * control takes focus rather than announced on its own, so it does not compete with the panel's
 * debounced live region. Same split the payment form's percentage quick-picks already use.
 *
 * A settled product (its price is already covered) is not offered at all: no checkbox, no field,
 * just the chip. A ticked box that can only ever produce a zero-amount line the server refuses is
 * the anti-pattern that omission prevents.
 */
export default function OrderPaymentBreakdownRow({
  instanceId,
  line,
  state,
  selected,
  pinned,
  value,
  fillableMinor,
  isRefused,
  currencyCode,
  locale,
  disabled,
  onToggle,
  onChange,
  onBlurLine,
  onFill,
}: OrderPaymentBreakdownRowProps) {
  const t = useTranslations("orders.payments.breakdown");
  const factId = breakdownFactId(instanceId, line.itemId);
  const messageId = breakdownMessageId(instanceId, line.itemId);
  const fillReasonId = breakdownFillReasonId(instanceId, line.itemId);
  /** Nothing left of the payment for this line, so pressing it could only write a zero. */
  const cannotFill = fillableMinor <= 0;

  const isSettled = state === "settled";
  const isInvalid = state === "overBase" || isRefused;
  // Two empty-row reasons that must never share copy: one asks for a price (or the other mode), the
  // other says the payment simply ran out. They send the collector to different places.
  const message =
    state === "overBase"
      ? t("lineOverBase")
      : state === "needsPrice"
        ? t("lineNeedsPrice")
        : state === "noRoom"
          ? t("lineNoRoom")
          : null;

  const priceLabel =
    line.basePagableMinor === null
      ? t("noPrice")
      : line.allocatedMinor > 0
        ? t("priceAllocated", {
            price: formatAmountSymbolOnly(line.basePagableMinor, currencyCode, locale),
            allocated: formatAmountSymbolOnly(line.allocatedMinor, currencyCode, locale),
          })
        : t("price", { amount: formatAmountSymbolOnly(line.basePagableMinor, currencyCode, locale) });

  const facts = [priceLabel];
  if (pinned) facts.push(t("pinned"));
  if (line.paidDeclared) facts.push(t("marked"));

  return (
    <li
      data-item-id={line.itemId}
      className={cn(
        "border-l-2 pr-0.5 pl-2",
        isInvalid ? "[border-left-color:var(--destructive)]" : "[border-left-color:transparent]",
      )}
    >
      <div className="grid min-h-[64px] grid-cols-[auto_1fr_auto_92px] items-center gap-2 md:min-h-[52px]">
        {isSettled ? (
          // The box is not rendered disabled, it is not rendered at all: a control that can only
          // ever refuse is one more thing to reach with the keyboard and read out loud.
          <span aria-hidden className="inline-block w-4" />
        ) : (
          <Checkbox
            size="sm"
            checked={selected}
            disabled={disabled}
            onChange={(next) => onToggle(line.itemId, next)}
            ariaLabel={t("selectAria", { name: line.name })}
            ariaDescribedById={factId}
            // 44px of touch target bought by RESIZING the box, not by an outward pseudo-element:
            // the neighbour below is another checkbox, so an expanded hit area would overlap it
            // (PLAYBOOK §4).
            className="min-h-11 md:min-h-0"
          />
        )}

        <div className="min-w-0">
          <p
            title={line.name}
            className={cn(
              "line-clamp-2 text-[13px] leading-[18px]",
              isSettled ? "[color:var(--text-muted)]" : "[color:var(--text-primary)]",
            )}
          >
            {line.name}
          </p>
          {/* The static facts. Mutually exclusive with the "Saldado" chip: a covered product has no
              price left to state. */}
          {!isSettled && (
            <p id={factId} className="text-[11px] leading-4 [color:var(--text-muted)] tabular-nums">
              {facts.join(" · ")}
            </p>
          )}
        </div>

        {isSettled ? (
          <span className="col-span-2 justify-self-end rounded-full px-2 py-0.5 text-[11px] [color:var(--success-chip-text)] [background:color-mix(in_oklch,var(--success)_10%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--success)_22%,transparent)]">
            {t("settled")}
          </span>
        ) : (
          <>
            {/* `aria-disabled`, never `disabled`, when there is nothing left to write: the reason
                is the only thing the collector needs here, and `disabled` is what makes it
                unreachable (out of the tab order, name never read, no pointer events for a
                tooltip). Same treatment and same precedent as the sheet's fill shortcut
                (`StorePaymentAllocationRow`, `docs/design/interface-patterns.md` §14). The real
                `disabled` stays for the in-flight case, where the whole panel is inert (E12). */}
            <button
              type="button"
              onClick={cannotFill ? undefined : () => onFill(line.itemId)}
              disabled={disabled}
              aria-disabled={cannotFill || undefined}
              aria-describedby={cannotFill ? fillReasonId : undefined}
              aria-label={t("fillAria", {
                amount: formatAmountSymbolOnly(fillableMinor, currencyCode, locale),
                name: line.name,
              })}
              className={cn(
                "inline-flex items-center justify-center rounded-md px-2 py-1 text-[11px]",
                // Same 44px floor and the same reason as the checkbox: the label is a word, so the
                // box has to carry the target that a longer string would have given it for free.
                "min-h-11 md:min-h-0",
                "[border:1px_solid_var(--border)]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
                "disabled:cursor-not-allowed disabled:opacity-50",
                cannotFill
                  ? "cursor-default [color:var(--text-muted)]"
                  : "[color:var(--text-secondary)] transition-colors hover:[color:var(--accent)] hover:[background:color-mix(in_oklch,var(--accent)_10%,transparent)]",
              )}
            >
              {t("fillLabel")}
              {cannotFill && (
                <span id={fillReasonId} className="sr-only">
                  {t("fillNothingLeft")}
                </span>
              )}
            </button>

            <MoneyAmountInput
              value={value}
              onChange={(raw) => onChange(line.itemId, raw)}
              onBlur={() => onBlurLine(line.itemId)}
              error={isInvalid}
              disabled={disabled}
              ariaLabel={t("amountAria", { name: line.name })}
              // The static facts always, the message only when there is one: the field's own
              // description is the product it belongs to, and the reason it is blocked is extra.
              describedById={message ? `${factId} ${messageId}` : factId}
            />
          </>
        )}
      </div>

      {message && (
        <p
          id={messageId}
          // Nothing here is announced, and that is not an omission. A server refusal IS announced,
          // by the form's own `role="alert"` paragraph, which carries the sentence the server sent;
          // repeating it from the row would say it twice, which is precisely what this rule was
          // written to avoid. What a row can say by itself is a client-side rule, already reachable
          // from the field it describes through `aria-describedby`. (The `role="alert"` that used to
          // sit here fired for neither case it was meant for: a refused row is `assignable`, so it
          // has no message at all — until the collector types an over-base amount into it, at which
          // point it announced the client-side rule this comment forbids announcing.)
          className={cn("pb-1 text-[11px] leading-4", isInvalid ? "text-destructive" : "[color:var(--text-muted)]")}
        >
          {message}
        </p>
      )}
    </li>
  );
}
