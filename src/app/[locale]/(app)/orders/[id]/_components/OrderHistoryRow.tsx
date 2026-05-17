"use client";

import { useTranslations } from "next-intl";
import {
  Ban,
  CircleDollarSign,
  Clock,
  MinusCircle,
  NotebookPen,
  Package,
  Pencil,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type HistoryEntry = {
  id: string;
  eventType: string;
  metadata: unknown;
  createdAt: Date;
};

type OrderHistoryRowProps = {
  entry: HistoryEntry;
  locale: string;
};

/**
 * Maps every known `OrderHistoryEventType` to a Lucide icon. Mirrors the demo
 * `#s7-order-detail-active` history list where each event has a small accent-cool circle
 * with a glyph that matches the action (plus-circle for created, truck for delivery, etc).
 * Unknown event types fall back to a neutral clock icon.
 */
const EVENT_ICON: Record<string, LucideIcon> = {
  ORDER_CREATED: PlusCircle,
  ORDER_EDITED: Pencil,
  ORDER_CANCELLED: Ban,
  ORDER_REACTIVATED: RotateCcw,
  STATUS_CHANGED: RefreshCw,
  PAYMENT_ADDED: CircleDollarSign,
  PAYMENT_DELETED: MinusCircle,
  NOTE_UPDATED: NotebookPen,
  DELIVERY_CREATED: Truck,
  ITEM_DELIVERED: Package,
};

function formatEventLabel(t: ReturnType<typeof useTranslations>, entry: HistoryEntry): string {
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
  const key = `detail.history.events.${entry.eventType}` as const;

  if ((entry.eventType === "PAYMENT_ADDED" || entry.eventType === "PAYMENT_DELETED") && meta.amount != null) {
    const currency = typeof meta.currencyCode === "string" ? meta.currencyCode : "";
    const amount = `${currency} ${((meta.amount as number) / 100).toFixed(2)}`.trim();
    return t(key as Parameters<typeof t>[0], { amount });
  }
  if (t.has(key as Parameters<typeof t>[0])) {
    return t(key as Parameters<typeof t>[0]);
  }
  return entry.eventType.replaceAll("_", " ").toLowerCase();
}

/**
 * Single history activity row. Demo `.activity-item` layout:
 *   - 32×32 rounded-full icon · surface-elevated bg · accent-cool border + color
 *   - text 13.5px · small block muted 12px mt-2 (date)
 *   - gap 12px between icon and text
 *   - vertical padding 10px (subtle), aligned to top
 */
export default function OrderHistoryRow({ entry, locale }: OrderHistoryRowProps) {
  const t = useTranslations("orders");
  const Icon = EVENT_ICON[entry.eventType] ?? Clock;
  const dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(entry.createdAt),
  );

  return (
    <li className="flex items-start gap-3 py-2.5">
      <div
        className="grid size-8 shrink-0 place-items-center rounded-full [background:var(--surface-elevated)]"
        style={{
          color: "var(--accent-cool)",
          border: "1px solid color-mix(in oklch, var(--accent-cool) 32%, var(--border))",
        }}
      >
        <Icon className="size-[14px]" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-text-body text-[13.5px] leading-snug">{formatEventLabel(t, entry)}</div>
        <div className="text-text-muted mt-0.5 text-[12px] leading-snug">{dateLabel}</div>
      </div>
    </li>
  );
}
