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
