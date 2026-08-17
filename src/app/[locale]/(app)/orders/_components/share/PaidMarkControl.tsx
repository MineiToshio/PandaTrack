"use client";

import { Circle, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/styles";
import { useOrderItemPaidDeclaration, type PaidDeclarationFailure } from "./useOrderItemPaidDeclaration";

export type PaidMarkControlProps = {
  orderId: string;
  itemId: string;
  /** The product's own name, so 29 identical controls in one store are told apart by a screen reader. */
  itemName: string;
  initialDeclared: boolean;
  /**
   * True when arithmetic already proves nothing is owed on this product. It outranks the mark, so
   * the control states the proven fact instead of the claim.
   */
  proven: boolean;
  /**
   * `offersPaidMark` for this product (`src/lib/orders/productPaymentState.ts`): whether a mark can
   * be ADDED here at all. False on any product with a price base, with money declared against it, or
   * on a cancelled order. Never gates an EXISTING mark: see the render decision below.
   */
  offersMark: boolean;
  /**
   * Whether a mark that sits UNDER a proven state is still shown and still removable. The order
   * detail says yes, because it is the audit surface and a mark put there by mistake has to be
   * reversible; the list says no, because there the proven fact is the whole answer.
   */
  showMarkWhenProven?: boolean;
  /** The order is cancelled: read-only, with the reason on hover. */
  locked?: boolean;
  size?: "sm" | "md";
  onError: (failure: PaidDeclarationFailure) => void;
};

const CHIP_BASE = "inline-flex w-fit items-center gap-1 rounded-[var(--radius-pill)] px-2 py-0.5 whitespace-nowrap";

const SUCCESS_TONE =
  "[color:var(--success-chip-text)] [background:color-mix(in_oklch,var(--success)_10%,transparent)] " +
  "[border:1px_solid_color-mix(in_oklch,var(--success)_22%,transparent)]";

const GHOST_TONE =
  "[color:var(--text-secondary)] [border:1px_solid_var(--border)] " +
  "hover:[color:var(--accent)] hover:[background:color-mix(in_oklch,var(--accent)_10%,transparent)]";

/**
 * The "this product is paid" control, shared by the orders list's store view and the order detail.
 *
 * It is a claim, not a figure. Pressing it moves no money: the store's debt, the dashboard and the
 * payment reminders are all derived from allocations and never read this. What it changes is what
 * the collector is told they still have to think about.
 *
 * `<button aria-pressed>` rather than `role="switch"` or `<Switch>`: the repo's precedent for a
 * per-item state inside a dense list is the togglable chip (`OrderItemStateChip`,
 * `OrderItemStatePill`), and the design system reserves `<Switch>` for form options. A state that
 * nothing can change is a `<span>` and stays out of the tab order.
 */
export default function PaidMarkControl({
  orderId,
  itemId,
  itemName,
  initialDeclared,
  proven,
  offersMark,
  showMarkWhenProven = false,
  locked = false,
  size = "md",
  onError,
}: PaidMarkControlProps) {
  const t = useTranslations("orderListing.storeView.paidMark");
  const tOrders = useTranslations("orders");
  const { declared, isPending, toggle } = useOrderItemPaidDeclaration({
    orderId,
    itemId,
    initialDeclared,
    onError,
  });

  const fontSize = size === "sm" ? "[font-size:11px]" : "[font-size:var(--text-caption)]";

  // Arithmetic beats a claim, so a proven product says "Saldado" whatever the collector marked. The
  // detail is the exception, and it is the one that keeps the mark reversible: while the order sits
  // at zero balance the claim would otherwise be impossible to take back, and it would reappear the
  // day the order's total went up.
  const showsMark = declared && (!proven || showMarkWhenProven);
  // A cancelled order can never OFFER the mark, whatever the caller computed: enforced here so the
  // branches below can rely on it rather than on every call site remembering.
  const canOffer = offersMark && !locked;
  // There has to be something to DO before this is a button: a mark to take back, or one that can be
  // added. Without `canOffer` in here, a priced product on a fully paid order rendered an
  // interactive "Marcar {name} como pagado" over the visible word "Saldado" — a label that does not
  // contain its own visible text (WCAG 2.5.3) offering the second source of truth this rule exists
  // to remove, and writing `paidDeclaredAt` when pressed. `initialDeclared` for the same reason the
  // render gate below carries it: unmarking a priced product makes it un-offerable again, and
  // swapping the button for a static chip under the finger that just pressed it would make the
  // action irreversible within the session.
  const canAct = declared || initialDeclared || canOffer;
  const isInteractive = !locked && canAct && (!proven || showMarkWhenProven);

  // Nothing to show and nothing to offer: render NOTHING, not a disabled chip. A control that cannot
  // act is a tab stop with no action behind it, and a "Marcar pagado" affordance on a product whose
  // exact price is known is the second source of truth this whole rule exists to remove. A product
  // that can do nothing here but IS proven still speaks: it states the fact, as a `<span>`.
  if (!canAct && !proven) return null;

  if (!isInteractive) {
    // Reaching here means `locked` or `proven`, and the gate above means declared or proven either
    // way (a locked product offers nothing), so this branch always states a settled fact. A
    // cancelled order freezes the control, not the truth it reports.
    return (
      <span
        className={cn(CHIP_BASE, fontSize, SUCCESS_TONE)}
        title={locked ? tOrders("detail.items.paidMark.lockedCancelled") : undefined}
      >
        <CircleCheck size={12} aria-hidden />
        {proven ? t("proven") : t("marked")}
      </span>
    );
  }

  // "Saldado · marcado" states both halves at once: the fact, and who is claiming it. That is
  // exactly the string a proven-and-marked product needs too, so there is no fourth label.
  const label = showsMark ? t("marked") : proven ? t("proven") : t("mark");
  const accessibleName = declared ? t("unmarkAria", { name: itemName }) : t("markAria", { name: itemName });

  return (
    <button
      type="button"
      aria-pressed={declared}
      aria-label={accessibleName}
      title={showsMark ? t("markedHint") : accessibleName}
      disabled={isPending}
      onClick={(event) => {
        // Several of the surfaces that host this control are one big link.
        event.preventDefault();
        event.stopPropagation();
        toggle();
      }}
      className={cn(
        CHIP_BASE,
        fontSize,
        showsMark || proven ? SUCCESS_TONE : GHOST_TONE,
        "cursor-pointer transition-opacity hover:opacity-80",
        "focus-visible:[box-shadow:0_0_0_2px_var(--focus-ring)] focus-visible:outline-none",
        // A 44px tap target bought with a transparent overlay rather than with padding, so the
        // chip keeps the density every row it sits in was designed around.
        "relative after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-['']",
        isPending && "opacity-60",
      )}
    >
      {showsMark || proven ? <CircleCheck size={12} aria-hidden /> : <Circle size={12} aria-hidden />}
      {label}
    </button>
  );
}
