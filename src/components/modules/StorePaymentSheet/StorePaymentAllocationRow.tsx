"use client";

import { useTranslations } from "next-intl";
import { formatAmountWithSymbol } from "@/lib/currency";
import { cn } from "@/lib/styles";
import MoneyAmountInput from "@/components/core/MoneyAmountInput";
import type { AllocationLine } from "./buildAllocationLines";
import { splitOnMatch } from "./matchHighlight";

/**
 * Why the fill button has nothing left to write.
 *
 * `unavailable` is the defensive one: the panel could not find this line's order or its draft, which
 * happens for the render between a refetch landing and the draft being rebuilt from it. It exists
 * because the fallback used to be `payment`, so a momentarily orphaned row told the collector "you
 * have already assigned the whole payment" over a payment they had not touched.
 */
export type FillDisabledReason = "noAmount" | "payment" | "order" | "unavailable";

const FILL_DISABLED_KEY: Record<FillDisabledReason, string> = {
  noAmount: "allocations.fillDisabledNoAmount",
  payment: "allocations.fillDisabledPayment",
  order: "allocations.fillDisabledOrder",
  unavailable: "allocations.fillDisabledUnavailable",
};

/** Id of one line's own message node. Shared with the panel, which points a whole order's lines at
    the one line that carries an order-level message. */
export function lineMessageId(lineKey: string): string {
  return `store-payment-line-${lineKey}-message`;
}

/** Id of the node that says why one line's fill button cannot write. Its own node, because the
    reason is a property of the CONTROL and outlives whatever message the row is showing. */
function fillReasonId(lineKey: string, placement: "mobile" | "desktop"): string {
  return `store-payment-line-${lineKey}-fill-reason-${placement}`;
}

export type StorePaymentAllocationRowProps = {
  line: AllocationLine;
  /** The product's name, or the localized "Resto del pedido" label. */
  label: string;
  currencyCode: string;
  locale: string;
  /** Raw text of this line's amount field. */
  value: string;
  /**
   * The order's own remaining balance, on the FIRST rendered row of its block and `null` on every
   * other row of it. The one money figure a row prints, and it is deliberately not derived from the
   * payment: the M balances printed by an M-order list add up to exactly what those M orders can
   * still take, instead of replicating one order's room once per product (ADR 0027).
   *
   * They do NOT add up to the store's debt, and the sheet must not be written as if they did: this
   * figure is declared money (`totalCost - Order.allocatedAmountMinor`) while the debt is paid money
   * (`totalCost - payments`), and this very sheet is what lets the two diverge, by accepting a
   * payment with part of it left unassigned.
   */
  orderBalanceMinor: number | null;
  /** The largest amount the fill button may write right now. 0 makes it inert. */
  fillableMinor: number;
  fillDisabledReason: FillDisabledReason;
  /** Message rendered under the row (a line-level rule, the server's own refusal, or an order-level
      statement such as "this order has no balance left"). */
  message: string | null;
  /** Tone of `message`. A blocked line is destructive; a statement of fact is not. */
  messageTone?: "error" | "neutral";
  /** Where to point `aria-describedby` when this row is invalid under an ORDER-level rule whose
      text is written on another row of the same block. Ignored when the row has its own message. */
  groupMessageId?: string;
  /** Server refusals are announced; client-side rules are already reachable through the field. */
  isServerRejection: boolean;
  isInvalid: boolean;
  /** Whether THIS payment's draft declares the product covered. Adds to `line.paidDeclared`. */
  declaredInDraft: boolean;
  onToggleDeclared: (line: AllocationLine) => void;
  /** Current filter text, highlighted inside the name and the order reference. */
  query: string;
  onChange: (line: AllocationLine, raw: string) => void;
  onFill: (line: AllocationLine) => void;
};

function Highlighted({ text, query }: { text: string; query: string }) {
  const parts = splitOnMatch(text, query);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, index) =>
        part.isMatch ? (
          <span key={index} className="rounded-[3px] [background:color-mix(in_oklch,var(--accent)_18%,transparent)]">
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/**
 * One payable line of the allocation panel: a product of an order, or that order's "Resto del
 * pedido". Every row is self-describing — its own name on line 1 and its order's reference on line
 * 2, or in the block header above it on the row that opens a block — so the flat list needs no
 * per-order container and a filter match on a reference is visible rather than unexplained. The
 * reference is printed once per row either way: in the header when the row has one, in the metadata
 * line when it does not.
 *
 * The shortcut cell is a control, not a label: on an assignable line it is a fill button that writes
 * the largest legal amount into the field beside it (the same quick-pick gesture
 * `OrderInlinePaymentForm` already uses). It shows a WORD ("Máx.") and no figure; the figure lives
 * in its accessible name ("Asignar S/ 45.00 a …"), which is recomputed live and is exactly what
 * pressing it writes. Printing a figure here was the defect ADR 0027 reverses: the visible number
 * was the line's own static base and the button wrote the live ceiling, so ORD-20260305-01 offered
 * "Falta S/ 59,90" and "Falta S/ 185,00" on an order that owed S/ 45,00. Showing the live ceiling
 * instead fixes each line and breaks the list, because with an empty draft every line of an order
 * shows that order's whole room, so N lines advertise N times the space that exists. A settled or
 * unpriced line renders a chip or the paid-mark toggle instead of the fill button.
 *
 * The one money figure a row prints is `orderBalanceMinor`, on a line of its OWN above the first row
 * of each order block: a per-order fact, stated once, so the M figures an M-order list prints add up
 * to what those M orders can still take rather than replicating one order's room per product. It
 * gets its own line because sharing the product's metadata line put it beside the shortcut cell,
 * which on mobile folds onto that same line: "ORD-… · Falta S/ 410,00 · [Máx.]" reads as two
 * statements about the same control while they describe an order and a product.
 *
 * A settled line's amount FIELD is read-only only while it is empty. Settling is derived from data
 * the server owns, so a row can turn settled with money already typed into it; the field has to
 * stay editable for exactly as long as it takes to empty it, or the fill button's undo ("clear the
 * field") is a promise the row cannot keep.
 *
 * The mobile and desktop placements of that cell are two nodes, one of which is `display: none` at
 * any given width, so exactly one is ever focusable.
 */
export default function StorePaymentAllocationRow({
  line,
  label,
  currencyCode,
  locale,
  value,
  orderBalanceMinor,
  fillableMinor,
  fillDisabledReason,
  message,
  messageTone = "error",
  groupMessageId,
  isServerRejection,
  isInvalid,
  declaredInDraft,
  query,
  onChange,
  onFill,
  onToggleDeclared,
}: StorePaymentAllocationRowProps) {
  const t = useTranslations("orders.detail.storePayment");
  const messageId = lineMessageId(line.key);
  const describedById = message ? messageId : groupMessageId;
  const isFillDisabled = fillableMinor === 0;
  // Unchanged on purpose: `declared` must NEVER reach this comparison. It is what makes the amount
  // field read-only, and a marked product that cannot receive money pushes that money into "Resto
  // del pedido", which names no product at all. The mark would then manufacture exactly the
  // undetailed money it exists to reduce (B2).
  const isSettled = line.state === "settled";
  const isDeclared = line.paidDeclared || declaredInDraft;
  // No price on record, so the line has no ceiling of its own. Read from the line rather than from
  // a figure the panel computes: a display figure passed down here is what ADR 0027 removed.
  const isUnpriced = line.lineCeilingMinor === null;
  /** This row opens its order's block, so it carries the block's own header line. */
  const hasBlockHeader = orderBalanceMinor !== null;

  // The cell is rendered TWICE (a mobile placement folded onto the metadata line and a desktop
  // column), one of which is `display: none` at any width. Anything inside it that carries an `id`
  // therefore needs the placement in that id, or the row ships two nodes with the same one and
  // `aria-describedby` resolves to whichever came first — possibly the hidden copy.
  const renderShortcut = (placement: "mobile" | "desktop") =>
    isSettled ? (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 [font-size:var(--text-caption)] [color:var(--success-chip-text)] [background:color-mix(in_oklch,var(--success)_10%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--success)_22%,transparent)]">
        {t("allocations.settledLabel")}
      </span>
    ) : isUnpriced ? (
      // No price on record, so there is no number to offer. Declaring it covered is the best answer
      // available here, and it is the ONLY line where the sheet offers the mark: wherever the amount
      // IS known, using the number is strictly more informative than a claim.
      <button
        type="button"
        aria-pressed={isDeclared}
        aria-label={t("allocations.markPaidAria", { name: label })}
        onClick={() => onToggleDeclared(line)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 [font-size:var(--text-caption)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
          // A 44px tap target under `md`, where this cell folds onto the reference line and the
          // amount input sits less than 2N away: the BOX is resized rather than expanded with a
          // pseudo-element, which would overlap that input (PLAYBOOK §4).
          "min-h-11 md:min-h-0",
          isDeclared
            ? "[color:var(--success-chip-text)] [background:color-mix(in_oklch,var(--success)_10%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--success)_22%,transparent)]"
            : "[color:var(--text-secondary)] [border:1px_solid_var(--border)] hover:[color:var(--accent)] hover:[background:color-mix(in_oklch,var(--accent)_10%,transparent)]",
        )}
      >
        {isDeclared ? t("allocations.declaredMarker") : t("allocations.markPaid")}
      </button>
    ) : (
      // `aria-disabled`, never `disabled`. The reason this control cannot write is the only thing the
      // collector needs here, and `disabled` is what made every one of those reasons unreachable: it
      // drops the button out of the tab order (no keyboard route, its name is never read), and the
      // `pointer-events-none` that came with it killed the `title` tooltip on desktop too — on touch
      // there was never a hover to begin with. Inert-but-focusable keeps the control announceable,
      // and the reason travels with it in `aria-describedby` rather than in an attribute nothing
      // surfaces. The visible half of the same answer is the panel's business: it states the
      // payment-level reason once above the list and the order-level one once per block.
      <button
        type="button"
        onClick={isFillDisabled ? undefined : () => onFill(line)}
        aria-disabled={isFillDisabled || undefined}
        aria-describedby={isFillDisabled ? fillReasonId(line.key, placement) : undefined}
        aria-label={t("allocations.fillAria", {
          amount: formatAmountWithSymbol(fillableMinor, currencyCode, locale),
          name: label,
        })}
        className={cn(
          "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1",
          "[font-size:var(--text-caption)]",
          // Same 44px floor, and the same reason, as the paid-mark toggle above: under `md` this cell
          // folds onto the reference line, and the label is now a word instead of an amount, so the
          // box has to carry the tap target that the longer text used to give it for free.
          "min-h-11 md:min-h-0",
          "[border:1px_solid_var(--border)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
          isFillDisabled
            ? "cursor-default [color:var(--text-muted)]"
            : "[color:var(--text-secondary)] hover:[color:var(--accent)] hover:[background:color-mix(in_oklch,var(--accent)_10%,transparent)]",
        )}
      >
        {t("allocations.fillMax")}
        {isFillDisabled && (
          <span id={fillReasonId(line.key, placement)} className="sr-only">
            {t(FILL_DISABLED_KEY[fillDisabledReason] as never)}
          </span>
        )}
      </button>
    );

  return (
    <li
      data-line-key={line.key}
      className={cn(
        "border-l-2 px-3 py-1.5",
        isInvalid ? "[border-left-color:var(--destructive)]" : "[border-left-color:transparent]",
      )}
    >
      {/* The order's own balance, on a line of its own that opens the block, with the reference it
          belongs to. This is the figure the collector was missing: without it the panel showed
          per-product numbers that summed far above what the order could take, and nothing said so.
          It is a statement about the ORDER, so it may not share a line with a statement about a
          product: while it sat in the metadata line below, the mobile shortcut cell folded onto that
          same line and the row read "ORD-… · Falta S/ 410,00 · [Máx.]", where "Máx." writes a
          different number entirely. */}
      {hasBlockHeader && (
        <p className="flex items-center gap-1 pb-0.5 [font-size:11px] [line-height:16px] [color:var(--text-secondary)] tabular-nums">
          <span className="truncate">
            <Highlighted text={line.humanReadableId} query={query} />
          </span>
          <span className="shrink-0">
            ·{" "}
            {t("allocations.orderBalance", {
              amount: formatAmountWithSymbol(orderBalanceMinor, currencyCode, locale),
            })}
          </span>
        </p>
      )}

      <div className="grid min-h-[64px] grid-cols-[1fr_96px] items-center gap-3 md:min-h-[52px] md:grid-cols-[1fr_120px_140px]">
        <div className="min-w-0">
          <p
            title={label}
            className={cn(
              "line-clamp-2 [font-size:13px] [line-height:18px] md:truncate",
              isSettled ? "[color:var(--text-muted)]" : "[color:var(--text-primary)]",
            )}
          >
            <Highlighted text={label} query={query} />
          </p>
          {/* `min-h-4` holds the line's box open on the block's first row, where the reference has
              moved up into the header and the desktop placement leaves this line with nothing to
              render: without it that one row's text block is 16px shorter than its neighbours'. */}
          <p className="flex min-h-4 items-center gap-1 [font-size:11px] [line-height:16px] [color:var(--text-muted)] tabular-nums">
            {/* The reference, on every row that is not the one the header already names. Repeating
                it there would print the same string twice, 16px apart. */}
            {!hasBlockHeader && (
              <span className="truncate">
                <Highlighted text={line.humanReadableId} query={query} />
              </span>
            )}
            {/* The mark as a consultable STATE, on the line the collector is reading while they
                pay. Real text, not a colour, so it survives into the row's accessible name. */}
            {isDeclared && !isUnpriced && (
              <span className="shrink-0 [color:var(--success-chip-text)]">
                {!hasBlockHeader && "· "}
                {t("allocations.declaredMarker")}
              </span>
            )}
            {/* Mobile: the shortcut cell folds onto this line. The separator is only printed when
                something precedes it. */}
            {(!hasBlockHeader || (isDeclared && !isUnpriced)) && (
              <span aria-hidden className="md:hidden">
                ·
              </span>
            )}
            <span className="md:hidden">{renderShortcut("mobile")}</span>
          </p>
        </div>

        {/* Desktop: the shortcut cell gets its own column. */}
        <div className="hidden md:flex md:items-center md:justify-end">{renderShortcut("desktop")}</div>

        <MoneyAmountInput
          value={value}
          onChange={(raw) => onChange(line, raw)}
          error={isInvalid}
          // A settled line takes no NEW money, but one that already holds some has to be
          // emptiable. A row can turn settled UNDER a live draft, and the everyday way there is
          // the fill button: press "Falta" (which writes exactly the line's remaining base),
          // submit, get no answer, and the refetch lands with that product's own allocations grown
          // to its base while the amount is still typed into its field. The list never drops the
          // row for it, so the dropped-lines notice cannot help — the key is still renderable.
          // Locking the field outright left the amount trapped inside an over-base error with no
          // way out but "Limpiar" (which costs every other line) or closing the sheet.
          //
          // The lock is `readOnly`, not `disabled`: it snaps shut on the keystroke that empties the
          // field, with the caret still inside it, and a `disabled` field drops that focus onto
          // `<body>` — from where the next `Tab` leaves the modal (see `MoneyAmountInput`).
          readOnly={isSettled && value.trim() === ""}
          // The primitive now wires whatever it is handed, so the "only while invalid" policy is
          // stated here, where it belongs: this row's message node is the reason the line is
          // BLOCKED, and pointing a healthy field at it would read the block out on every visit.
          describedById={isInvalid ? describedById : undefined}
          ariaLabel={
            line.isRest
              ? t("allocations.restAmountAria", { order: line.humanReadableId })
              : t("allocations.amountAria", { name: label })
          }
        />
      </div>

      {message && (
        <p
          id={messageId}
          role={isServerRejection ? "alert" : undefined}
          className={cn(
            "pb-1 [font-size:11.5px]",
            messageTone === "neutral" ? "[color:var(--text-muted)]" : "[color:var(--destructive-chip-text)]",
          )}
        >
          {message}
        </p>
      )}
    </li>
  );
}
