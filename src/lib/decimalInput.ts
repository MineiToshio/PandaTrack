import { getCurrencyDecimals } from "@/lib/currency";

const DEFAULT_DECIMAL_PLACES = 2;

/**
 * Strips any character that is not a digit or period, keeps only the first period,
 * and limits the fractional part to the currency's exponent. Safe to call on every keystroke.
 *
 * When `currencyCode` is a zero-decimal currency the separator is dropped along with any
 * fractional digits already typed (truncating at the first dot), so "43000.50" becomes "43000"
 * instead of concatenating into a wrong "4300050". Omitting `currencyCode` keeps the historic
 * 2-decimal behavior (used by non-currency fields such as the FX rate).
 */
export function sanitizeDecimalInput(value: string, currencyCode?: string): string {
  const decimals = currencyCode ? getCurrencyDecimals(currencyCode) : DEFAULT_DECIMAL_PLACES;
  let v = value.replace(/[^\d.]/g, "");
  const dotIndex = v.indexOf(".");
  if (dotIndex === -1) {
    return v;
  }
  if (decimals <= 0) {
    return v.slice(0, dotIndex);
  }
  v = v.slice(0, dotIndex + 1) + v.slice(dotIndex + 1).replace(/\./g, "");
  const maxLength = dotIndex + 1 + decimals;
  if (v.length > maxLength) {
    v = v.slice(0, maxLength);
  }
  return v;
}

/**
 * Returns true when value is a well-formed positive decimal within the currency's exponent
 * (e.g. "25", "25.5", "25.99" for 2-decimal currencies; only "25" for zero-decimal ones). Use on
 * form submit, not on every keystroke (a trailing dot like "25." is rejected here but is valid
 * while the user is still typing). Omitting `currencyCode` keeps the historic 2-decimal behavior.
 */
export function isValidPositiveDecimal(value: string, currencyCode?: string): boolean {
  const decimals = currencyCode ? getCurrencyDecimals(currencyCode) : DEFAULT_DECIMAL_PLACES;
  const pattern = decimals <= 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);
  return pattern.test(value) && parseFloat(value) > 0;
}
