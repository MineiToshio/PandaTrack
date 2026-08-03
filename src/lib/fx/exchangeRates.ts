/**
 * Daily reference exchange rates, fetched from the browser for the "today" prefill helpers.
 *
 * Provider: the ExchangeRate-API open endpoint (https://open.er-api.com). No key, no registration,
 * `access-control-allow-origin: *`, refreshed once a day and served with `max-age=3600`. It covers
 * 166 currencies, including the LATAM set this product is built around (PEN, CLP, COP, ARS, MXN,
 * BRL). The previous provider served ECB reference rates, which cover 29 currencies and none of
 * those four, so the helper silently answered "pair not found" for the currencies most collectors
 * here actually buy in.
 *
 * The module is named for what it does rather than for the vendor: the callers depend on the
 * result contract, not on who serves it, and the last swap should be the last one that touches
 * three call sites.
 *
 * The provider's terms allow caching and commercial use, forbid redistribution, and require
 * attribution wherever a fetched rate is shown. The orders subtree renders that attribution next to
 * every prefilled rate (`FxRateAttribution`).
 */
const EXCHANGE_RATES_BASE_URL = "https://open.er-api.com/v6/latest";
const FETCH_TIMEOUT_MS = 5000;

/**
 * How long one base currency's snapshot is reused. Aligned with the provider's own `max-age=3600`
 * and with the fact that the rates only move once a day: without it, every keystroke-adjacent
 * interaction on a form would be its own request.
 */
const SNAPSHOT_TTL_MS = 60 * 60 * 1000;

/**
 * The result of asking for one pair's rate.
 *
 * `rate` is oriented as "how many units of `to` equal 1 unit of `from`", which is the orientation
 * `Order.exchangeRate` is stored in and the one `convertToBaseCurrencyMinor` multiplies by. Getting
 * this backwards would corrupt every base-currency dashboard total in silence, so it is pinned by
 * a test rather than left to the provider's documentation.
 */
export type TodayRateResult =
  | { ok: true; rate: number; date: string }
  | { ok: false; reason: "network" | "missing-pair" | "invalid-response" | "timeout" };

/** One base currency's full rate table as served by the provider, plus the day it is dated. */
type RateSnapshot = { date: string; rates: Record<string, number> };

type SnapshotFetch = { ok: true; snapshot: RateSnapshot } | { ok: false; reason: TodayRateFailureReason };

type TodayRateFailureReason = Extract<TodayRateResult, { ok: false }>["reason"];

/**
 * Successful snapshots only. A failure is never cached: a provider hiccup must not lock the helper
 * out for an hour when the user's obvious next move is to press the button again.
 */
const snapshotCache = new Map<string, { snapshot: RateSnapshot; expiresAt: number }>();

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The provider dates its table with a unix timestamp; the callers want a calendar day. */
function resolveSnapshotDate(timeLastUpdateUnix: unknown): string {
  if (typeof timeLastUpdateUnix !== "number" || !Number.isFinite(timeLastUpdateUnix)) {
    return todayIsoDate();
  }
  return new Date(timeLastUpdateUnix * 1000).toISOString().slice(0, 10);
}

function readCachedSnapshot(base: string): RateSnapshot | null {
  const entry = snapshotCache.get(base);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    snapshotCache.delete(base);
    return null;
  }
  return entry.snapshot;
}

function pickRate(snapshot: RateSnapshot, to: string): TodayRateResult {
  const rate = snapshot.rates[to];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return { ok: false, reason: "missing-pair" };
  }
  return { ok: true, rate, date: snapshot.date };
}

async function fetchSnapshot(base: string): Promise<SnapshotFetch> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${EXCHANGE_RATES_BASE_URL}/${encodeURIComponent(base)}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, reason: "network" };

    const payload = (await response.json()) as {
      result?: unknown;
      time_last_update_unix?: unknown;
      rates?: unknown;
    };

    // The provider answers 200 with `result: "error"` for anything it refuses, an unknown base
    // code included, so the body is the only place the outcome is actually reported.
    if (payload.result !== "success" || typeof payload.rates !== "object" || payload.rates === null) {
      return { ok: false, reason: "invalid-response" };
    }

    return {
      ok: true,
      snapshot: {
        date: resolveSnapshotDate(payload.time_last_update_unix),
        rates: payload.rates as Record<string, number>,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return { ok: false, reason: "timeout" };
    // `fetch` rejects with a TypeError when the request never reached a server (offline, DNS,
    // blocked). Anything else here is a body that did not parse.
    if (error instanceof TypeError) return { ok: false, reason: "network" };
    return { ok: false, reason: "invalid-response" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Latest published rate for one currency pair, as "how many `to` units equal 1 `from` unit".
 *
 * Never throws: every failure is reported as a reason the caller can turn into copy, because the
 * helper is a convenience next to an input the user can always fill in by hand.
 */
export async function fetchTodayRate(from: string, to: string): Promise<TodayRateResult> {
  if (from === to) return { ok: true, rate: 1, date: todayIsoDate() };

  const cached = readCachedSnapshot(from);
  if (cached) return pickRate(cached, to);

  const fetched = await fetchSnapshot(from);
  if (!fetched.ok) return { ok: false, reason: fetched.reason };

  snapshotCache.set(from, { snapshot: fetched.snapshot, expiresAt: Date.now() + SNAPSHOT_TTL_MS });
  return pickRate(fetched.snapshot, to);
}
