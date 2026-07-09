import { formatAmountSymbolOnly } from "@/lib/currency";

/**
 * Formats a base-currency minor amount for a dashboard figure. The dashboard states the base
 * currency once in the page heading, so figures use the symbol-only layout. Falls back to a plain
 * decimal when the collector has not configured a base currency yet.
 */
export function formatDashboardMoney(minor: number, currencyCode: string | null, locale: string): string {
  if (!currencyCode) {
    return (minor / 100).toFixed(2);
  }
  return formatAmountSymbolOnly(minor, currencyCode, locale);
}
