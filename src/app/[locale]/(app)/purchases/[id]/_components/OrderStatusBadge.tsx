import { useTranslations } from "next-intl";
import { cn } from "@/lib/styles";
import type { OrderStatus } from "../../../../../../../generated/prisma/client";

type OrderStatusBadgeProps = {
  status: OrderStatus;
  className?: string;
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  OPEN: "bg-info/20 text-info border-info/40",
  IN_TRANSIT: "bg-primary/20 text-primary border-primary/40",
  PARTIALLY_IN_TRANSIT: "bg-primary/15 text-primary border-primary/35",
  PARTIALLY_DELIVERED: "bg-highlight/20 text-highlight border-highlight/40",
  COMPLETED: "bg-success/20 text-success border-success/40",
  CANCELLED: "bg-muted/60 text-muted-foreground border-border",
};

export default function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const t = useTranslations("orders");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
        STATUS_STYLES[status],
        className,
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden />
      {t(`detail.status.${status}`)}
    </span>
  );
}
