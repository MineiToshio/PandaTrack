/**
 * Formats a minor-unit integer as a locale-aware decimal followed by the ISO currency code.
 * Example: formatAmount(4300000, "CLP", "es") → "43.000 CLP"
 *          formatAmount(88850, "USD", "en") → "888.50 USD"
 *
 * Pattern: {amount} {code} — value first, identifier after.
 * This is the canonical monetary display format for PandaTrack.
 */
export function formatAmount(minorUnits: number, currencyCode: string, locale: string | undefined): string {
  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(minorUnits / 100);
    return `${formatted} ${currencyCode}`;
  } catch {
    return `${(minorUnits / 100).toFixed(2)} ${currencyCode}`;
  }
}
