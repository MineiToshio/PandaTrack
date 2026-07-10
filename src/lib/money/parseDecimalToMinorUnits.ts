import { getCurrencyDecimals, MINOR_UNITS_PER_MAJOR } from "@/lib/currency";

/**
 * Strict decimal string parser that converts a monetary amount to integer minor units (cents).
 *
 * Only a plain, non-negative decimal within the currency's exponent is accepted: thousands
 * separators, signs, exponent (`1e3`) and hex (`0x10`) notation, multiple dots, and
 * trailing/leading dots are all rejected. For zero-decimal currencies (CLP, JPY, KRW) a decimal
 * separator is rejected outright, since they have no subunit. Invalid or empty input returns
 * `null` so callers reject the amount instead of silently truncating a malformed value
 * (which the previous `parseFloat`-based parsing did — e.g. `parseFloat("1,000") === 1`).
 *
 * Storage stays uniform ×100 regardless of exponent, so a valid whole-unit amount for a
 * zero-decimal currency always lands on a multiple of `MINOR_UNITS_PER_MAJOR`.
 */
const TWO_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;
const ZERO_DECIMAL_PATTERN = /^\d+$/;

export function parseDecimalToMinorUnits(value: string | null, currencyCode?: string): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  const pattern = currencyCode && getCurrencyDecimals(currencyCode) === 0 ? ZERO_DECIMAL_PATTERN : TWO_DECIMAL_PATTERN;
  if (trimmed === "" || !pattern.test(trimmed)) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;

  return Math.round(parsed * MINOR_UNITS_PER_MAJOR);
}
