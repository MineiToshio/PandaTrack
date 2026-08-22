"use client";

import { formatAmountWithSymbol } from "@/lib/currency";

/**
 * Client-persistent record of a settlement (or consumption-only) money transaction that failed
 * after its delivery transaction already committed (`WO-08`, `FR-08-42`). The arrival itself is
 * never at risk — it is already `DELIVERED` — but the money write needs a `Retry`, and that control
 * has to survive a route change (WO-08 UX Notes: "must not be lost on a route change"). A plain
 * component `useState` cannot do that; `localStorage` is what makes the affordance outlive
 * navigation and even a tab close.
 *
 * Keyed by `deliveryId` alone: ownership of the delivery is re-verified server-side on every
 * `Retry` (`retrySettlementAction` re-reads the delivery scoped to the session's own `userId`), so a
 * stray entry left by a different account on a shared browser can surface a stale "Retry" affordance
 * at worst, never a cross-account write — the server refuses anything it does not own before it
 * reads or writes a single row.
 *
 * Holds ENOUGH to re-invoke the retry action, never the closed-order set or `deliveredItemIds`
 * themselves: `retrySettlementAction` re-derives both fresh from the delivery's own current items on
 * every attempt, exactly as `Retry`'s contract requires (never trust a client-held figure).
 */
export type PendingSettlementIntent = {
  orderId: string;
  /** Only meaningful for an order whose fresh resolution lands on the "manual" branch again. */
  manualAmountMinor?: number;
  /** Analytics-only label from the preview the collector saw; never decides what gets written. */
  branchHint?: "full" | "partial_computed" | "manual" | "not_settled";
};

export type PendingSettlementEntry = {
  deliveryId: string;
  /** The "Ya pagué el resto" checkbox state at submit time. */
  settleRemainder: boolean;
  /** `yyyy-mm-dd`, the settlement date the collector confirmed (or the arrival date it defaulted to). */
  settlementDate: string;
  settlementIntents: PendingSettlementIntent[];
  /** ISO instant, informational only (surfaced nowhere yet, kept for future debugging/telemetry). */
  createdAt: string;
};

export const PENDING_SETTLEMENT_STORAGE_KEY_PREFIX = "pandatrack:pendingSettlement:";

/**
 * How long a pending entry is trusted before a read discards it outright (MAJOR F9, 2026-08-20
 * review). A `Retry` affordance this stale is not a live money problem any more, it is clutter: the
 * collector has long since moved on (reconciled by hand at the store, written the order off, or the
 * delivery itself was long since reopened and re-closed through a different path), and re-attempting
 * a money transaction against a delivery this old carries more risk of surprising the collector than
 * of ever resolving a genuinely still-pending write.
 */
const PENDING_SETTLEMENT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function storageKey(deliveryId: string): string {
  return `${PENDING_SETTLEMENT_STORAGE_KEY_PREFIX}${deliveryId}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isExpired(entry: PendingSettlementEntry): boolean {
  const createdAt = Date.parse(entry.createdAt);
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt > PENDING_SETTLEMENT_TTL_MS;
}

/**
 * The pending entry for one delivery, or `null` when there is nothing to retry (storage is
 * unavailable, or the entry aged past its TTL — in which case this also sweeps it off storage, so a
 * later listing of raw keys never has to re-apply the same check).
 */
export function readPendingSettlement(deliveryId: string): PendingSettlementEntry | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(deliveryId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSettlementEntry;
    if (!parsed || typeof parsed !== "object" || parsed.deliveryId !== deliveryId) return null;
    if (isExpired(parsed)) {
      window.localStorage.removeItem(storageKey(deliveryId));
      return null;
    }
    return parsed;
  } catch {
    // Corrupt entry or storage unavailable (SSR, private mode, quota): treat as nothing pending
    // rather than throwing — a lost Retry affordance is recoverable (the collector can re-run the
    // arrival's money step from the delivery detail once), a crash is not.
    return null;
  }
}

/** Persists a pending entry, overwriting any previous one for the same delivery. */
export function writePendingSettlement(entry: PendingSettlementEntry): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(storageKey(entry.deliveryId), JSON.stringify(entry));
  } catch {
    // Ignore storage errors (quota, private mode): the collector still sees the arrival-only toast;
    // they simply lose the persistent Retry affordance across navigation for this one attempt.
  }
}

/** Clears the pending entry once its money transaction has succeeded or is confirmed moot. */
export function clearPendingSettlement(deliveryId: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(storageKey(deliveryId));
  } catch {
    // Ignore storage errors.
  }
}

/**
 * Clears every pending-settlement entry on this device, for every delivery (MAJOR F9, 2026-08-20
 * review). Called on sign-out, exactly like the share stash it sits alongside there: a shared
 * device's next signed-in collector must not see, let alone be offered a `Retry` for, a money
 * transaction that belongs to whoever signed out. Keyed by delivery id, so there is no single key to
 * remove — every key carrying this store's own prefix is enumerated and dropped instead.
 */
export function clearAllPendingSettlements(): void {
  if (!isBrowser()) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(PENDING_SETTLEMENT_STORAGE_KEY_PREFIX)) keysToRemove.push(key);
    }
    for (const key of keysToRemove) window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors: a device that cannot enumerate its own storage here is one where
    // sign-out itself has bigger problems than a leftover Retry affordance.
  }
}

/** Minimal shape shared by every settlement money outcome the client renders a toast for. */
export type SettlementOutcomeLike = { status: string; settledAmountMinor: number | null; currencyCode: string };

/**
 * Total settled amount, grouped by currency and formatted, joined for one toast sentence
 * ("Llegada anotada y {amount} registrados como pago"). `null` when nothing settled, so the caller
 * falls back to the arrival-only copy. Shared by `useQuickArrival` and `StoreGroupedView`'s own
 * batch handler so the two settlement confirmations never phrase the same fact differently.
 */
export function formatSettledTotals(outcomes: SettlementOutcomeLike[], locale: string): string | null {
  const byCurrency = new Map<string, number>();
  for (const outcome of outcomes) {
    if (outcome.status !== "settled" || !outcome.settledAmountMinor) continue;
    byCurrency.set(outcome.currencyCode, (byCurrency.get(outcome.currencyCode) ?? 0) + outcome.settledAmountMinor);
  }
  if (byCurrency.size === 0) return null;
  return [...byCurrency.entries()]
    .map(([currency, minor]) => formatAmountWithSymbol(minor, currency, locale))
    .join(" + ");
}
