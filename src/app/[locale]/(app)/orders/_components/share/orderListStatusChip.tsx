import { AlertTriangle, Ban, CheckCircle, Clock, PackageCheck, Truck } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { OVERDUE_MONTHS_THRESHOLD_DAYS } from "@/lib/arrivalWindow";
import type { OrderStatus } from "../../../../../../../generated/prisma/client";

export type OrderListChipTone = "neutral" | "info" | "success" | "warning";

export type OrderListChipDescriptor = {
  toneKey: OrderListChipTone;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Translation key under `orderListing.status` or `orderListing.card`. */
  labelKey: string;
  /** Optional ICU vars (only set for overdue). */
  labelVars?: Record<string, string | number>;
};

/**
 * The LABEL takes `--{status}-chip-text`; only the fill and the border take the raw status token.
 * That is the system rule (`docs/design/visual-foundations.md` § Status color as text), and this
 * list was the place still deviating from it: the raw token is calibrated as a FILL, so on its own
 * 12% wash it read 2.23:1 (warning), 3.33:1 (info) and 3.14:1 (success) in the light theme, against
 * 7.62 / 7.00 / 6.13 with the alias. `Chip` and `StatusChip` were already on the alias, so the same
 * delay read 8.42:1 on the "Por tienda" line and 2.23:1 on the chip one toggle away. Dark is
 * unaffected by construction: `globals.css` collapses each alias to its base token there.
 */
const TONE_CLASSES: Record<OrderListChipTone, string> = {
  neutral:
    "[color:var(--text-secondary)] [background:color-mix(in_oklch,var(--text-primary)_8%,transparent)] [border-color:color-mix(in_oklch,var(--text-primary)_18%,transparent)]",
  info: "[color:var(--info-chip-text)] [background:color-mix(in_oklch,var(--info)_12%,transparent)] [border-color:color-mix(in_oklch,var(--info)_28%,transparent)]",
  success:
    "[color:var(--success-chip-text)] [background:color-mix(in_oklch,var(--success)_12%,transparent)] [border-color:color-mix(in_oklch,var(--success)_28%,transparent)]",
  warning:
    "[color:var(--warning-chip-text)] [background:color-mix(in_oklch,var(--warning)_12%,transparent)] [border-color:color-mix(in_oklch,var(--warning)_30%,transparent)]",
};

export function getOrderListChipToneClassName(tone: OrderListChipTone): string {
  return TONE_CLASSES[tone];
}

/**
 * Maps the derived order state to a chip descriptor following the Orders list design (`docs/design/components.md` status chips).
 * Overdue is computed externally to keep this helper pure and SSR-safe.
 */
export function describeOrderListChip(input: {
  status: OrderStatus;
  paymentPercentage: number;
  hasUnpaidBalance: boolean;
  isOverdue: boolean;
  overdueDays?: number;
}): OrderListChipDescriptor {
  const { status, paymentPercentage, hasUnpaidBalance, isOverdue, overdueDays } = input;

  if (status === "CANCELLED") {
    return { toneKey: "neutral", icon: Ban, labelKey: "status.CANCELLED" };
  }
  if (status === "COMPLETED") {
    return { toneKey: "success", icon: PackageCheck, labelKey: "status.COMPLETED" };
  }
  if (isOverdue) {
    return { toneKey: "warning", icon: AlertTriangle, ...describeOverdueLabel(overdueDays ?? 0) };
  }
  if (status === "IN_TRANSIT" || status === "PARTIALLY_IN_TRANSIT" || status === "PARTIALLY_DELIVERED") {
    return { toneKey: "info", icon: Truck, labelKey: `status.${status}` };
  }
  if (status === "OPEN" && paymentPercentage >= 100 && !hasUnpaidBalance) {
    return { toneKey: "success", icon: CheckCircle, labelKey: "payment.paid" };
  }
  return { toneKey: "neutral", icon: Clock, labelKey: "status.OPEN" };
}

/**
 * Secondary chip for an order that is finished but still owes money (`FR-05-35`).
 *
 * The primary chip above is status-driven, so a delivered order reads as a green "Completado" and
 * nothing else — which is exactly how a set of completed orders carrying real debt stayed invisible.
 * This does not resurrect what ADR 0025 retired: there is no percentage and no per-row progress bar
 * here, only the binary "money is still owed on this one", the same fact and the same
 * warning-toned treatment the order detail hero already shows (`orders.detail.hero.chipUnpaid`).
 *
 * Scoped to `COMPLETED` on purpose. An active order with a balance is the ordinary state of almost
 * every order, so flagging those would paint the whole list amber and the signal would stop meaning
 * anything. Cancelled orders carry no debt at all (ADR 0025: store debt sums non-cancelled orders),
 * so they never get the chip either. Rendered *beside* the status chip, never replacing it — the
 * secondary-chip rule in `docs/design/interface-patterns.md` §8.
 */
export function describeOrderListBalanceChip(input: {
  status: OrderStatus;
  hasUnpaidBalance: boolean;
}): OrderListChipDescriptor | null {
  if (input.status !== "COMPLETED" || !input.hasUnpaidBalance) return null;
  return { toneKey: "warning", icon: AlertTriangle, labelKey: "card.outstandingBalance" };
}

export type OverdueLabelBucket = "overdue" | "overdueDays" | "overdueMonths";

/**
 * Which unit a delay is stated in, and with what number. The single definition of that arithmetic,
 * so the same order cannot read "Atrasado 228d" in one view and "Atrasado 7 meses" in another.
 *
 * Past `OVERDUE_MONTHS_THRESHOLD_DAYS` the magnitude is what matters and the exact day count stops
 * being readable, so it switches UNIT rather than gaining a second colour: the gradation of a delay
 * belongs in the words, not in a tone that would then disagree with the same order's chip on every
 * other surface.
 */
function resolveOverdueBucket(overdueDays: number): {
  bucket: OverdueLabelBucket;
  labelVars?: Record<string, number>;
} {
  if (overdueDays <= 0) return { bucket: "overdue" };
  if (overdueDays >= OVERDUE_MONTHS_THRESHOLD_DAYS) {
    return { bucket: "overdueMonths", labelVars: { months: Math.floor(overdueDays / 30) } };
  }
  return { bucket: "overdueDays", labelVars: { days: overdueDays } };
}

/** The delay as a CHIP label (`orderListing.card.*`): compact, because a pill pays for every pixel. */
export function describeOverdueLabel(overdueDays: number): {
  labelKey: string;
  labelVars?: Record<string, number>;
} {
  const { bucket, labelVars } = resolveOverdueBucket(overdueDays);
  return { labelKey: `card.${bucket}`, ...(labelVars ? { labelVars } : {}) };
}

/**
 * The same delay as the "Por tienda" row's LINE of text (`orderListing.storeView.arrival.*`).
 *
 * Two namespaces, one bucket, and the split is deliberate. The arithmetic is shared because a delay
 * must not change size between surfaces; the wording is not, because a chip and a sentence have
 * different economies. "Atrasado 47d" is right inside a pill that competes for a 150px column and
 * wrong on a line that reads as prose, where the abbreviation buys nothing and looks like a typo.
 * The order detail's own overdue banner already spells it out for the same reason.
 */
export function describeArrivalOverdueLabel(overdueDays: number): {
  labelKey: string;
  labelVars?: Record<string, number>;
} {
  const { bucket, labelVars } = resolveOverdueBucket(overdueDays);
  return { labelKey: `storeView.arrival.${bucket}`, ...(labelVars ? { labelVars } : {}) };
}
