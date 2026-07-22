import { formatAmountSymbolOnly, formatAmountSymbolOnlyCompact, formatCompactMajor } from "@/lib/currency";

/**
 * Formats a base-currency minor amount for a dashboard figure. The dashboard states the base
 * currency once in the page heading, so figures use the symbol-only layout. Falls back to a plain
 * decimal when the collector has not configured a base currency yet.
 */
export function formatDashboardMoney(minor: number, currencyCode: string | null, locale: string): string {
  if (!currencyCode) {
    return (minor / 100).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return formatAmountSymbolOnly(minor, currencyCode, locale);
}

/**
 * Abbreviated variant of {@link formatDashboardMoney} for space-constrained headlines such as a
 * donut center (`S/ 234.3K` instead of `S/ 234,272.59`). Pair it with the full
 * {@link formatDashboardMoney} value as a hover `title` so the exact amount stays reachable.
 */
export function formatDashboardMoneyCompact(minor: number, currencyCode: string | null, locale: string): string {
  if (!currencyCode) {
    return formatCompactMajor(minor / 100, 2);
  }
  return formatAmountSymbolOnlyCompact(minor, currencyCode, locale);
}
