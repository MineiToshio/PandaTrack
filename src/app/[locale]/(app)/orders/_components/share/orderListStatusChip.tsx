import { AlertTriangle, Ban, CheckCircle, Clock, PackageCheck, Truck } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
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

const TONE_CLASSES: Record<OrderListChipTone, string> = {
  neutral:
    "[color:var(--text-secondary)] [background:color-mix(in_oklch,var(--text-primary)_8%,transparent)] [border-color:color-mix(in_oklch,var(--text-primary)_18%,transparent)]",
  info: "[color:var(--info)] [background:color-mix(in_oklch,var(--info)_12%,transparent)] [border-color:color-mix(in_oklch,var(--info)_28%,transparent)]",
  success:
    "[color:var(--success)] [background:color-mix(in_oklch,var(--success)_12%,transparent)] [border-color:color-mix(in_oklch,var(--success)_28%,transparent)]",
  warning:
    "[color:var(--warning)] [background:color-mix(in_oklch,var(--warning)_12%,transparent)] [border-color:color-mix(in_oklch,var(--warning)_30%,transparent)]",
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
    return {
      toneKey: "warning",
      icon: AlertTriangle,
      labelKey: overdueDays && overdueDays > 0 ? "card.overdueDays" : "card.overdue",
      labelVars: overdueDays && overdueDays > 0 ? { days: overdueDays } : undefined,
    };
  }
  if (status === "IN_TRANSIT" || status === "PARTIALLY_IN_TRANSIT" || status === "PARTIALLY_DELIVERED") {
    return { toneKey: "info", icon: Truck, labelKey: `status.${status}` };
  }
  if (status === "OPEN" && paymentPercentage >= 100 && !hasUnpaidBalance) {
    return { toneKey: "success", icon: CheckCircle, labelKey: "payment.paid" };
  }
  return { toneKey: "neutral", icon: Clock, labelKey: "status.OPEN" };
}

export function describeOverdueDays(expectedDeliveryTo: Date | null, today: Date): number {
  if (!expectedDeliveryTo) return 0;
  const diff = today.getTime() - expectedDeliveryTo.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86_400_000);
}
