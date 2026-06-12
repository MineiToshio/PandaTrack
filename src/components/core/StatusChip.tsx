import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle,
  CircleDashed,
  Clock,
  Package,
  PackageCheck,
  PackageOpen,
  Truck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/styles";
import type { CSSProperties, ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChipVariant = "success" | "warning" | "destructive" | "info" | "accent" | "neutral";
export type ChipSize = "sm" | "md";

type StatusChipBase = {
  size?: ChipSize;
  /** Custom SR announcement for dynamic chips (e.g. overdue days, % paid). */
  ariaLabel?: string;
};

export type StatusChipProps =
  | (StatusChipBase & {
      kind: "orderStatus";
      value: "OPEN" | "PARTIALLY_IN_TRANSIT" | "IN_TRANSIT" | "PARTIALLY_DELIVERED" | "COMPLETED" | "CANCELLED";
    })
  | (StatusChipBase & {
      kind: "deliveryStatus";
      value: "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
      /** When IN_TRANSIT and overdueDays >= 1, chip mutates to warning + overdue copy. */
      overdueDays?: number;
    })
  | (StatusChipBase & {
      kind: "itemDeliveryState";
      value: "NONE" | "ARRIVED_AT_STORE" | "IN_TRANSIT" | "DELIVERED";
    })
  | (StatusChipBase & {
      kind: "derived";
      value: "paid" | "partial" | "unpaid" | "overdue";
      /** Days overdue — used when value is `overdue`. */
      days?: number;
      /** Percentage paid 0–100 — used when value is `partial`. */
      pct?: number;
    })
  | (StatusChipBase & {
      kind: "info";
      /** ADR 0006 — required. TS rejects chip without icon. */
      icon: ReactNode;
      /** ADR 0006 — required. */
      label: string;
    })
  | (StatusChipBase & {
      kind: "success" | "warning" | "destructive" | "accent" | "neutral";
      icon?: ReactNode;
      label: string;
    });

// ─── Internal types ───────────────────────────────────────────────────────────

type ResolvedChip = {
  variant: ChipVariant;
  icon: ReactNode;
  label: string;
};

// ─── Variant style recipes ────────────────────────────────────────────────────

function getVariantStyle(variant: ChipVariant): CSSProperties {
  switch (variant) {
    case "success":
      return {
        background: "color-mix(in oklch, var(--success) 14%, var(--background))",
        border: "1px solid color-mix(in oklch, var(--success) 28%, var(--background))",
        color: "var(--success-chip-text)",
      };
    case "warning":
      return {
        background: "color-mix(in oklch, var(--warning) 14%, var(--background))",
        border: "1px solid color-mix(in oklch, var(--warning) 28%, var(--background))",
        color: "var(--warning-chip-text)",
      };
    case "destructive":
      return {
        background: "color-mix(in oklch, var(--destructive) 14%, var(--background))",
        border: "1px solid color-mix(in oklch, var(--destructive) 28%, var(--background))",
        color: "var(--destructive-chip-text)",
      };
    case "info":
      return {
        background: "color-mix(in oklch, var(--info) 14%, var(--background))",
        border: "1px solid color-mix(in oklch, var(--info) 28%, var(--background))",
        color: "var(--info-chip-text)",
      };
    case "accent":
      return {
        background: "color-mix(in oklch, var(--accent) 14%, var(--background))",
        border: "1px solid color-mix(in oklch, var(--accent) 28%, var(--background))",
        color: "var(--text-primary)",
      };
    case "neutral":
      return {
        background: "var(--surface-elevated)",
        border: "1px solid var(--border-strong)",
        color: "var(--text-secondary)",
      };
  }
}

// Icon color overrides for variants that differ from `currentColor`
function getIconStyle(variant: ChipVariant): CSSProperties | undefined {
  if (variant === "accent") return { color: "var(--accent)" };
  if (variant === "neutral") return { color: "var(--text-muted)" };
  return undefined;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Status pill for domain states and derived labels. Discriminated union on `kind`.
 * `kind="info"` enforces icon+label by TypeScript (ADR 0006).
 * Enum kinds (orderStatus, deliveryStatus, etc.) derive variant/icon/copy internally.
 */
export default function StatusChip(props: StatusChipProps) {
  const { size = "md", ariaLabel } = props;
  const t = useTranslations("components.statusChip");

  let resolved: ResolvedChip;

  if (props.kind === "orderStatus") {
    const statusMap: Record<typeof props.value, ResolvedChip> = {
      OPEN: { variant: "neutral", icon: <Clock size={14} aria-hidden="true" />, label: t("orderStatus.OPEN") },
      PARTIALLY_IN_TRANSIT: {
        variant: "info",
        icon: <Package size={14} aria-hidden="true" />,
        label: t("orderStatus.PARTIALLY_IN_TRANSIT"),
      },
      IN_TRANSIT: {
        variant: "info",
        icon: <Package size={14} aria-hidden="true" />,
        label: t("orderStatus.IN_TRANSIT"),
      },
      PARTIALLY_DELIVERED: {
        variant: "success",
        icon: <PackageOpen size={14} aria-hidden="true" />,
        label: t("orderStatus.PARTIALLY_DELIVERED"),
      },
      COMPLETED: {
        variant: "success",
        icon: <CheckCircle size={14} aria-hidden="true" />,
        label: t("orderStatus.COMPLETED"),
      },
      CANCELLED: { variant: "neutral", icon: <Ban size={14} aria-hidden="true" />, label: t("orderStatus.CANCELLED") },
    };
    resolved = statusMap[props.value];
  } else if (props.kind === "deliveryStatus") {
    if (props.value === "IN_TRANSIT" && props.overdueDays != null && props.overdueDays >= 1) {
      // ADR 0002: delivery overdue chip uses `alert-circle`, not the order-level `alert-triangle`.
      resolved = {
        variant: "warning",
        icon: <AlertCircle size={14} aria-hidden="true" />,
        label: t("deliveryStatus.overdue", { days: props.overdueDays }),
      };
    } else {
      const statusMap: Record<"IN_TRANSIT" | "DELIVERED" | "CANCELLED", ResolvedChip> = {
        IN_TRANSIT: {
          variant: "info",
          icon: <Truck size={14} aria-hidden="true" />,
          label: t("deliveryStatus.IN_TRANSIT"),
        },
        DELIVERED: {
          variant: "success",
          icon: <CheckCircle size={14} aria-hidden="true" />,
          label: t("deliveryStatus.DELIVERED"),
        },
        CANCELLED: {
          variant: "neutral",
          icon: <Ban size={14} aria-hidden="true" />,
          label: t("deliveryStatus.CANCELLED"),
        },
      };
      resolved = statusMap[props.value];
    }
  } else if (props.kind === "itemDeliveryState") {
    const stateMap: Record<typeof props.value, ResolvedChip> = {
      NONE: { variant: "neutral", icon: <Clock size={14} aria-hidden="true" />, label: t("itemDeliveryState.NONE") },
      ARRIVED_AT_STORE: {
        variant: "success",
        icon: <CheckCircle size={14} aria-hidden="true" />,
        label: t("itemDeliveryState.ARRIVED_AT_STORE"),
      },
      IN_TRANSIT: {
        variant: "info",
        icon: <Truck size={14} aria-hidden="true" />,
        label: t("itemDeliveryState.IN_TRANSIT"),
      },
      DELIVERED: {
        variant: "success",
        icon: <PackageCheck size={14} aria-hidden="true" />,
        label: t("itemDeliveryState.DELIVERED"),
      },
    };
    resolved = stateMap[props.value];
  } else if (props.kind === "derived") {
    const { value, pct, days } = props;
    // Guard edge cases per spec
    if (value === "partial") {
      if (pct === 0) {
        resolved = { variant: "neutral", icon: <Clock size={14} aria-hidden="true" />, label: t("derived.unpaid") };
      } else if (pct === 100) {
        resolved = { variant: "success", icon: <CheckCircle size={14} aria-hidden="true" />, label: t("derived.paid") };
      } else {
        resolved = {
          variant: "accent",
          icon: <CircleDashed size={14} aria-hidden="true" />,
          label: t("derived.partial", { pct: Math.round(pct ?? 0) }),
        };
      }
    } else if (value === "paid") {
      resolved = { variant: "success", icon: <CheckCircle size={14} aria-hidden="true" />, label: t("derived.paid") };
    } else if (value === "unpaid") {
      resolved = { variant: "neutral", icon: <Clock size={14} aria-hidden="true" />, label: t("derived.unpaid") };
    } else {
      // overdue
      resolved = {
        variant: "warning",
        icon: <AlertTriangle size={14} aria-hidden="true" />,
        label: t("derived.overdue", { days: days ?? 0 }),
      };
    }
  } else if (props.kind === "info") {
    resolved = { variant: "info", icon: props.icon, label: props.label };
  } else {
    // Ad-hoc variant kinds: success | warning | destructive | accent | neutral
    const { kind, icon, label } = props as StatusChipBase & {
      kind: ChipVariant;
      icon?: ReactNode;
      label: string;
    };
    resolved = { variant: kind, icon: icon ?? null, label };
  }

  const { variant, icon, label } = resolved;
  const variantStyle = getVariantStyle(variant);
  const iconStyle = getIconStyle(variant);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-[var(--space-1_5)] whitespace-nowrap",
        "rounded-[var(--radius-pill)]",
        "[font-family:var(--font-sans)] [font-weight:var(--font-weight-medium)]",
        size === "md" && "[font-size:var(--text-caption)] [line-height:var(--text-caption--line-height)]",
        size === "md" && "px-[var(--space-3)] py-[var(--space-1)]",
        size === "sm" && "[font-size:var(--text-mono)] [letter-spacing:var(--text-mono--letter-spacing)]",
        size === "sm" && "px-[var(--space-2)] py-[var(--space-0_5)]",
      )}
      style={variantStyle}
      aria-label={ariaLabel}
    >
      {icon && (
        <span className="flex flex-shrink-0 items-center" style={iconStyle} aria-hidden="true">
          {icon}
        </span>
      )}
      {label}
    </span>
  );
}
