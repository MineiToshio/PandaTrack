/**
 * Strict decimal string parser that converts a monetary amount to integer minor units (cents).
 *
 * Only a plain, non-negative decimal with at most two fraction digits is accepted:
 * thousands separators, signs, exponent (`1e3`) and hex (`0x10`) notation, multiple
 * dots, and trailing/leading dots are all rejected. Invalid or empty input returns
 * `null` so callers reject the amount instead of silently truncating a malformed value
 * (which the previous `parseFloat`-based parsing did — e.g. `parseFloat("1,000") === 1`).
 */
const STRICT_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;
const MINOR_UNITS_PER_MAJOR = 100;

export function parseDecimalToMinorUnits(value: string | null): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed === "" || !STRICT_DECIMAL_PATTERN.test(trimmed)) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;

  return Math.round(parsed * MINOR_UNITS_PER_MAJOR);
}
