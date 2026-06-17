"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import { Modal } from "@/components/modules/Modal";
import { useToast } from "@/contexts/ToastContext";
import { formatAmount } from "@/lib/currency";
import { fetchTodayRate } from "@/lib/fx/frankfurter";
import { cn } from "@/lib/styles";
import { updateExchangeRatesAction } from "../_actions/orderFxActions";

export type FxPendingOrder = {
  id: string;
  humanReadableId: string;
  totalCost: number;
  currencyCode: string;
};

type FxReconciliationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  baseCurrencyCode: string | null;
  orders: FxPendingOrder[];
};

type GroupedRate = {
  pairKey: string;
  fromCurrency: string;
  toCurrency: string;
  orders: FxPendingOrder[];
  draftRate: string;
  todayLoading: boolean;
  todayError: string | null;
  expanded: boolean;
};

function buildInitialGroups(orders: FxPendingOrder[], baseCurrencyCode: string | null): GroupedRate[] {
  if (!baseCurrencyCode) return [];
  const byPair = new Map<string, GroupedRate>();
  for (const order of orders) {
    const pairKey = `${order.currencyCode}->${baseCurrencyCode}`;
    const existing = byPair.get(pairKey);
    if (existing) {
      existing.orders.push(order);
    } else {
      byPair.set(pairKey, {
        pairKey,
        fromCurrency: order.currencyCode,
        toCurrency: baseCurrencyCode,
        orders: [order],
        draftRate: "",
        todayLoading: false,
        todayError: null,
        expanded: false,
      });
    }
  }
  return Array.from(byPair.values());
}

function parseRate(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export default function FxReconciliationModal({
  isOpen,
  onClose,
  baseCurrencyCode,
  orders,
}: FxReconciliationModalProps) {
  const t = useTranslations("orderListing");
  const router = useRouter();
  const { addToast } = useToast();
  const [groups, setGroups] = useState<GroupedRate[]>(() => buildInitialGroups(orders, baseCurrencyCode));
  const [isPending, startTransition] = useTransition();

  // Reset internal draft state when the pending order set or base currency changes.
  // Render-time prop→state sync via fingerprint (canonical React 18+ pattern).
  const ordersFingerprint = useMemo(
    () => `${baseCurrencyCode ?? ""}|${orders.map((o) => `${o.id}:${o.currencyCode}`).join("|")}`,
    [orders, baseCurrencyCode],
  );
  const [syncedFingerprint, setSyncedFingerprint] = useState(ordersFingerprint);
  if (ordersFingerprint !== syncedFingerprint) {
    setSyncedFingerprint(ordersFingerprint);
    setGroups(buildInitialGroups(orders, baseCurrencyCode));
  }

  const updateGroup = (pairKey: string, patch: Partial<GroupedRate>) => {
    setGroups((prev) => prev.map((g) => (g.pairKey === pairKey ? { ...g, ...patch } : g)));
  };

  const handleTodayClick = (group: GroupedRate) => {
    updateGroup(group.pairKey, { todayLoading: true, todayError: null });
    fetchTodayRate(group.fromCurrency, group.toCurrency).then((result) => {
      if (result.ok) {
        updateGroup(group.pairKey, {
          draftRate: result.rate.toFixed(6),
          todayLoading: false,
          todayError: null,
        });
      } else {
        updateGroup(group.pairKey, {
          todayLoading: false,
          todayError: t("fx.modal.todayError"),
        });
      }
    });
  };

  const updatesToApply = useMemo(() => {
    const updates: Array<{ orderId: string; exchangeRate: number }> = [];
    for (const group of groups) {
      const rate = parseRate(group.draftRate);
      if (rate == null) continue;
      for (const order of group.orders) {
        updates.push({ orderId: order.id, exchangeRate: rate });
      }
    }
    return updates;
  }, [groups]);

  const handleApply = () => {
    if (updatesToApply.length === 0) return;
    startTransition(async () => {
      const result = await updateExchangeRatesAction({ updates: updatesToApply });
      if (result.success) {
        addToast(t("fx.modal.successToast"), { variant: "success" });
        onClose();
        router.refresh();
      } else {
        addToast(t("fx.modal.errorToast"), { variant: "error" });
      }
    });
  };

  if (!baseCurrencyCode) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("fx.modal.title")}
      subtitle={t("fx.modal.subtitle", { count: orders.length })}
      size="lg"
      role="dialog"
      primaryAction={{
        label: t("fx.modal.applyCta", { count: updatesToApply.length }),
        onClick: handleApply,
        disabled: updatesToApply.length === 0 || isPending,
        loading: isPending,
      }}
      secondaryAction={{
        label: t("fx.modal.cancel"),
        onClick: onClose,
        disabled: isPending,
      }}
    >
      <p className="mb-4 [font-size:var(--text-body)] [color:var(--text-secondary)]">{t("fx.modal.instruction")}</p>
      <ul className="flex flex-col gap-3" role="list">
        {groups.map((group) => {
          const hasValidRate = parseRate(group.draftRate) != null;
          return (
            <li
              key={group.pairKey}
              className="flex flex-col gap-3 rounded-[var(--radius-lg)] p-3 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="[font-size:var(--text-eyebrow)] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase">
                    {group.fromCurrency} → {group.toCurrency}
                  </p>
                  <p className="[font-size:var(--text-body)] [color:var(--text-primary)]">
                    {t("fx.modal.groupCount", { count: group.orders.length })}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-0.5 text-[12px] [border:1px_solid]",
                    hasValidRate
                      ? "[border-color:color-mix(in_oklch,var(--success)_28%,transparent)] [color:var(--success)] [background:color-mix(in_oklch,var(--success)_12%,transparent)]"
                      : "[border-color:color-mix(in_oklch,var(--warning)_28%,transparent)] [color:var(--warning)] [background:color-mix(in_oklch,var(--warning)_12%,transparent)]",
                  )}
                >
                  {hasValidRate ? t("fx.modal.statusReady") : t("fx.modal.statusPending")}
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">
                    {t("fx.modal.rateLabel", { from: group.fromCurrency, to: group.toCurrency })}
                  </span>
                  <Input
                    inputMode="decimal"
                    value={group.draftRate}
                    onChange={(event) => updateGroup(group.pairKey, { draftRate: event.target.value })}
                    placeholder={t("fx.modal.ratePlaceholder")}
                  />
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTodayClick(group)}
                  disabled={group.todayLoading}
                  style={{
                    color: "var(--accent)",
                    background: "color-mix(in oklch, var(--accent) 12%, transparent)",
                    borderColor: "color-mix(in oklch, var(--accent) 28%, transparent)",
                  }}
                  className="self-start sm:self-end"
                >
                  {group.todayLoading ? t("fx.modal.todayLoading") : t("fx.modal.todayButton")}
                </Button>
              </div>
              {group.todayError && (
                <p className="[font-size:var(--text-caption)] [color:var(--destructive)]">{group.todayError}</p>
              )}

              <button
                type="button"
                onClick={() => updateGroup(group.pairKey, { expanded: !group.expanded })}
                aria-expanded={group.expanded}
                className="inline-flex items-center gap-1 self-start [font-size:var(--text-caption)] [color:var(--text-secondary)] hover:[color:var(--text-primary)]"
              >
                <ChevronDown
                  width={12}
                  height={12}
                  aria-hidden
                  className={cn("transition-transform duration-200", group.expanded && "rotate-180")}
                />
                {t("fx.modal.affectedToggle", { count: group.orders.length })}
              </button>
              {group.expanded && (
                <ul
                  className="flex flex-col gap-1 pl-4 [font-size:var(--text-caption)] [color:var(--text-secondary)]"
                  role="list"
                >
                  {group.orders.map((order) => (
                    <li key={order.id} className="flex items-center justify-between gap-2">
                      <span className="truncate tabular-nums">{order.humanReadableId}</span>
                      <span className="tabular-nums">{formatAmount(order.totalCost, order.currencyCode)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
