import { getCurrencyDecimals } from "@/lib/currency";

const DEFAULT_DECIMAL_PLACES = 2;

// FX rates are NOT monetary amounts, so they don't follow a currency exponent: a small-value
// pair (e.g. CLP→USD ≈ 0.00108) needs several significant fraction digits to be typeable and
// precise. 6 matches the server-side exchange-rate precision cap, so a rate accepted by the
// input round-trips through validation without being silently truncated.
const RATE_DECIMAL_PLACES = 6;

function sanitizeToDecimals(value: string, decimals: number): string {
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

function isWellFormedToDecimals(value: string, decimals: number): boolean {
  const pattern = decimals <= 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);
  return pattern.test(value);
}

/**
 * Strips any character that is not a digit or period, keeps only the first period,
 * and limits the fractional part to the currency's exponent. Safe to call on every keystroke.
 *
 * When `currencyCode` is a zero-decimal currency the separator is dropped along with any
 * fractional digits already typed (truncating at the first dot), so "43000.50" becomes "43000"
 * instead of concatenating into a wrong "4300050". Omitting `currencyCode` keeps the historic
 * 2-decimal behavior.
 */
export function sanitizeDecimalInput(value: string, currencyCode?: string): string {
  const decimals = currencyCode ? getCurrencyDecimals(currencyCode) : DEFAULT_DECIMAL_PLACES;
  return sanitizeToDecimals(value, decimals);
}

/**
 * Keystroke sanitizer for FX rate inputs. Allows up to 6 fraction digits because rates are not
 * amounts — the 2-decimal `sanitizeDecimalInput` would make a rate like "0.00108" untypeable by
 * truncating it to "0.00".
 */
export function sanitizeRateInput(value: string): string {
  return sanitizeToDecimals(value, RATE_DECIMAL_PLACES);
}

/**
 * Returns true when value is a well-formed positive decimal within the currency's exponent
 * (e.g. "25", "25.5", "25.99" for 2-decimal currencies; only "25" for zero-decimal ones). Use on
 * form submit, not on every keystroke (a trailing dot like "25." is rejected here but is valid
 * while the user is still typing). Omitting `currencyCode` keeps the historic 2-decimal behavior.
 */
export function isValidPositiveDecimal(value: string, currencyCode?: string): boolean {
  const decimals = currencyCode ? getCurrencyDecimals(currencyCode) : DEFAULT_DECIMAL_PLACES;
  return isWellFormedToDecimals(value, decimals) && parseFloat(value) > 0;
}

/**
 * Like {@link isValidPositiveDecimal} but also accepts zero — for fields where a 0 amount is
 * legitimate (e.g. a free delivery's cost). Stays currency-aware so a zero-decimal currency
 * rejects any fractional input on submit.
 */
export function isValidNonNegativeDecimal(value: string, currencyCode?: string): boolean {
  const decimals = currencyCode ? getCurrencyDecimals(currencyCode) : DEFAULT_DECIMAL_PLACES;
  return isWellFormedToDecimals(value, decimals) && parseFloat(value) >= 0;
}

/** Validator for FX rate inputs — accepts a positive decimal with up to 6 fraction digits. */
export function isValidRate(value: string): boolean {
  return isWellFormedToDecimals(value, RATE_DECIMAL_PLACES) && parseFloat(value) > 0;
}
