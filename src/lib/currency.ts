/**
 * Formats a minor-unit integer as a decimal followed by the ISO currency code.
 * Example: formatAmount(4300000, "CLP") → "43,000 CLP"
 *          formatAmount(88850, "USD") → "888.50 USD"
 *
 * Pattern: {amount} {code} — value first, identifier after.
 * Always uses period (.) as the decimal separator regardless of UI locale.
 * See docs/design/visual-foundations.md — "Number and currency formatting".
 */
export function formatAmount(minorUnits: number, currencyCode: string): string {
  try {
    const formatted = new Intl.NumberFormat("en", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(minorUnits / 100);
    return `${formatted} ${currencyCode}`;
  } catch {
    return `${(minorUnits / 100).toFixed(2)} ${currencyCode}`;
  }
}

/**
 * Currencies whose narrow symbol is `$` and therefore need the ISO suffix to disambiguate
 * (e.g. USD vs ARS vs CLP vs MXN). Other dollar-using currencies can be added here when
 * collectors start logging orders in them.
 */
const AMBIGUOUS_DOLLAR_CODES = new Set(["USD", "ARS", "CLP", "MXN", "COP", "AUD", "CAD", "NZD", "HKD", "SGD"]);

/**
 * Currency-symbol variant of `formatAmount` used by the redesigned orders list (S7-B). The
 * standalone decimal+code format (`formatAmount`) is kept for legacy detail views and forms
 * where the ISO code is the dominant identifier.
 *
 * Pattern: `{narrow symbol}{value}` for unambiguous symbols; `{narrow symbol}{value} {ISO}`
 * for $-using currencies so collectors can tell USD apart from ARS / CLP / MXN at a glance.
 * Mirrors `#s7-orders-list-default` ("$1,240.00 USD", "€320,00", "¥24,500").
 */
export function formatAmountWithSymbol(minorUnits: number, currencyCode: string, locale = "en"): string {
  const value = minorUnits / 100;
  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
    return AMBIGUOUS_DOLLAR_CODES.has(currencyCode) ? `${formatted} ${currencyCode}` : formatted;
  } catch {
    return `${value.toFixed(2)} ${currencyCode}`;
  }
}
