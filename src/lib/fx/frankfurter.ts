/**
 * Frankfurter public FX API (https://frankfurter.dev). No key, no auth.
 * Used client-side from the FxReconciliationModal "Hoy" button.
 */
const FRANKFURTER_BASE_URL = "https://api.frankfurter.dev/v1/latest";
const FETCH_TIMEOUT_MS = 5000;

export type FrankfurterRateResult =
  | { ok: true; rate: number; date: string }
  | { ok: false; reason: "network" | "missing-pair" | "invalid-response" | "timeout" };

export async function fetchTodayRate(from: string, to: string): Promise<FrankfurterRateResult> {
  if (from === to) return { ok: true, rate: 1, date: new Date().toISOString().slice(0, 10) };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const url = `${FRANKFURTER_BASE_URL}?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`;

  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return { ok: false, reason: "network" };
    const payload = (await response.json()) as { date?: string; rates?: Record<string, number> };
    const rate = payload.rates?.[to];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      return { ok: false, reason: "missing-pair" };
    }
    return { ok: true, rate, date: payload.date ?? new Date().toISOString().slice(0, 10) };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { ok: false, reason: "timeout" };
    return { ok: false, reason: "invalid-response" };
  } finally {
    clearTimeout(timeout);
  }
}
