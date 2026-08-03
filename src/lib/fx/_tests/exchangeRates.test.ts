import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The module keeps a process-lifetime snapshot cache, so every test imports it fresh through
 * `vi.resetModules()` rather than through a reset hook the production code would only exist for.
 */
async function loadModule() {
  vi.resetModules();
  return import("../exchangeRates");
}

/** One provider response body, shaped exactly as `open.er-api.com` serves it. */
function successBody(base: string, rates: Record<string, number>, unixSeconds = Date.UTC(2026, 6, 29) / 1000) {
  return {
    result: "success",
    base_code: base,
    time_last_update_unix: unixSeconds,
    rates,
  };
}

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchTodayRate", () => {
  it("returns the rate for a supported pair", async () => {
    fetchMock.mockResolvedValue(okResponse(successBody("PEN", { USD: 0.293834, CLP: 276.140421 })));
    const { fetchTodayRate } = await loadModule();

    const result = await fetchTodayRate("PEN", "USD");

    expect(result).toEqual({ ok: true, rate: 0.293834, date: "2026-07-29" });
    expect(fetchMock).toHaveBeenCalledWith("https://open.er-api.com/v6/latest/PEN", expect.anything());
  });

  it("covers the LATAM currencies the previous ECB-backed provider did not serve", async () => {
    fetchMock.mockResolvedValue(okResponse(successBody("PEN", { CLP: 276.140421, COP: 942.363321, ARS: 440.703629 })));
    const { fetchTodayRate } = await loadModule();

    await expect(fetchTodayRate("PEN", "CLP")).resolves.toMatchObject({ ok: true, rate: 276.140421 });
    await expect(fetchTodayRate("PEN", "COP")).resolves.toMatchObject({ ok: true, rate: 942.363321 });
    await expect(fetchTodayRate("PEN", "ARS")).resolves.toMatchObject({ ok: true, rate: 440.703629 });
  });

  /**
   * Orientation lock. `Order.exchangeRate` means "how many base-currency units equal 1
   * order-currency unit" (`convertToBaseCurrencyMinor` multiplies the order amount by it), and the
   * callers ask for `fetchTodayRate(orderCurrency, baseCurrency)`. With EUR worth more than USD,
   * a EUR to USD rate above 1 is the only correct answer; returning the inverse would silently
   * shrink every converted dashboard total.
   *
   * Verified live on 2026-07-29 against both providers, which agree on this orientation:
   *   frankfurter.dev  base=EUR symbols=USD -> rates.USD = 1.138
   *   open.er-api.com  base=EUR            -> rates.USD = 1.138108
   */
  it("orients the rate as base-currency units per one order-currency unit", async () => {
    fetchMock.mockResolvedValue(okResponse(successBody("EUR", { USD: 1.138108 })));
    const { fetchTodayRate } = await loadModule();

    const result = await fetchTodayRate("EUR", "USD");

    expect(result).toEqual({ ok: true, rate: 1.138108, date: "2026-07-29" });
    // 100.00 EUR converted with this rate must come out above 100.00 USD, not below.
    const converted = result.ok ? Math.round(10_000 * result.rate) : 0;
    expect(converted).toBe(11_381);
  });

  it("returns an identity rate without calling the provider when both currencies match", async () => {
    const { fetchTodayRate } = await loadModule();

    const result = await fetchTodayRate("PEN", "PEN");

    expect(result).toMatchObject({ ok: true, rate: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports missing-pair when the base is served but the target currency is not in the table", async () => {
    fetchMock.mockResolvedValue(okResponse(successBody("PEN", { USD: 0.293834 })));
    const { fetchTodayRate } = await loadModule();

    await expect(fetchTodayRate("PEN", "ZZZ")).resolves.toEqual({ ok: false, reason: "missing-pair" });
  });

  it("reports invalid-response when the provider answers 200 with its own error result", async () => {
    fetchMock.mockResolvedValue(okResponse({ result: "error", "error-type": "unsupported-code" }));
    const { fetchTodayRate } = await loadModule();

    await expect(fetchTodayRate("XXX", "USD")).resolves.toEqual({ ok: false, reason: "invalid-response" });
  });

  it("reports timeout when the request is aborted", async () => {
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    fetchMock.mockRejectedValue(abortError);
    const { fetchTodayRate } = await loadModule();

    await expect(fetchTodayRate("PEN", "USD")).resolves.toEqual({ ok: false, reason: "timeout" });
  });

  it("reports network when the request never reaches the provider", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { fetchTodayRate } = await loadModule();

    await expect(fetchTodayRate("PEN", "USD")).resolves.toEqual({ ok: false, reason: "network" });
  });

  it("reports network on a non-2xx provider response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) } as unknown as Response);
    const { fetchTodayRate } = await loadModule();

    await expect(fetchTodayRate("PEN", "USD")).resolves.toEqual({ ok: false, reason: "network" });
  });

  it("serves a second pair on the same base from cache, without a second request", async () => {
    fetchMock.mockResolvedValue(okResponse(successBody("PEN", { USD: 0.293834, BRL: 1.503748 })));
    const { fetchTodayRate } = await loadModule();

    await fetchTodayRate("PEN", "USD");
    const second = await fetchTodayRate("PEN", "BRL");

    expect(second).toMatchObject({ ok: true, rate: 1.503748 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refetches once the cached snapshot has expired", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockResolvedValue(okResponse(successBody("PEN", { USD: 0.293834 })));
      const { fetchTodayRate } = await loadModule();

      await fetchTodayRate("PEN", "USD");
      vi.advanceTimersByTime(60 * 60 * 1000 + 1);
      await fetchTodayRate("PEN", "USD");

      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not cache a failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetchMock.mockResolvedValueOnce(okResponse(successBody("PEN", { USD: 0.293834 })));
    const { fetchTodayRate } = await loadModule();

    await expect(fetchTodayRate("PEN", "USD")).resolves.toEqual({ ok: false, reason: "network" });
    await expect(fetchTodayRate("PEN", "USD")).resolves.toMatchObject({ ok: true, rate: 0.293834 });
  });
});
