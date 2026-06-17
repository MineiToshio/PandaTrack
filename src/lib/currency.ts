/**
 * Formats a minor-unit integer as a decimal followed by the ISO currency code.
 * Example: formatAmount(4300000, "CLP") → "43000.00 CLP"
 *          formatAmount(88850, "USD") → "888.50 USD"
 *
 * Pattern: {amount} {code} — value first, identifier after.
 * Always uses period (.) as the decimal separator, NO thousand separator, and
 * ALWAYS 2 decimals — regardless of UI locale. Sergio prefers a single canonical
 * number layout so collectors don't get tripped up reading `$1.240,00` vs
 * `$1,240.00` vs `$1240`.
 * See docs/design/visual-foundations.md — "Number and currency formatting".
 */
export function formatAmount(minorUnits: number, currencyCode: string): string {
  try {
    const formatted = new Intl.NumberFormat("en", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false,
    }).format(minorUnits / 100);
    return `${formatted} ${currencyCode}`;
  } catch {
    return `${(minorUnits / 100).toFixed(2)} ${currencyCode}`;
  }
}

/**
 * Currency symbol overrides for codes whose `Intl.NumberFormat` narrow symbol resolves to
 * the ISO code itself on at least one runtime. Today PEN is the only one that's broken in
 * the Node 22 ICU + most browser ICUs (returns `"PEN"` instead of `"S/"`); the rest are
 * defensive entries for currencies that older Safari / Firefox ICU versions have been
 * known to mis-resolve. Without this fallback users would see `"PEN 95.00"` instead of
 * `"S/ 95.00"` in the hero, which is a regression from collector intuition.
 */
const CURRENCY_SYMBOL_FALLBACK: Record<string, string> = {
  PEN: "S/",
  // Defensive — these have returned ISO codes in older ICU versions:
  ARS: "$",
  CLP: "$",
  COP: "$",
  MXN: "$",
  UYU: "$U",
  BOB: "Bs",
  PYG: "₲",
  VES: "Bs.S",
  CRC: "₡",
  GTQ: "Q",
  HNL: "L",
  NIO: "C$",
  DOP: "RD$",
  PHP: "₱",
  TWD: "NT$",
  IDR: "Rp",
  MYR: "RM",
};

/**
 * Returns the localized narrow currency symbol (e.g. "$" for USD/ARS, "€" for EUR, "S/" for PEN,
 * "¥" for JPY). Falls back to `CURRENCY_SYMBOL_FALLBACK` when `Intl.NumberFormat` resolves the
 * narrow symbol to the ISO code itself (PEN is the canonical case). As a last resort returns
 * the ISO code so we never crash, but the canonical layout `{symbol}{value} {CODE}` would
 * collapse to `{code} {value} {CODE}` which is ugly — keep the fallback map maintained.
 */
function getCurrencyNarrowSymbol(currencyCode: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    const intlSymbol = parts.find((p) => p.type === "currency")?.value ?? currencyCode;
    if (intlSymbol === currencyCode && CURRENCY_SYMBOL_FALLBACK[currencyCode]) {
      return CURRENCY_SYMBOL_FALLBACK[currencyCode];
    }
    return intlSymbol;
  } catch {
    return CURRENCY_SYMBOL_FALLBACK[currencyCode] ?? currencyCode;
  }
}

/**
 * Returns `{symbol}{value}` without the ISO code suffix (e.g. "$496.00", "€320.00",
 * "S/ 6765.00"). Used for the hero "saldo pendiente" big number where the ISO code lives
 * separately in the eyebrow line (`TU PEDIDO · PEN`), so repeating the code on the value
 * would be redundant.
 *
 * Symbol is ALWAYS prefixed regardless of locale conventions (Spanish locale normally puts
 * `$` after the value — we override that). Number layout is locale-INDEPENDENT: always `.`
 * decimal, no thousand separator, always 2 decimals.
 *
 * For places that should show the code explicitly (orders list price, hero sub line, etc.)
 * use `formatAmountWithSymbol` — that variant always appends the ISO code.
 */
export function formatAmountSymbolOnly(minorUnits: number, currencyCode: string, locale = "en"): string {
  const value = minorUnits / 100;
  try {
    const formattedNumber = new Intl.NumberFormat("en", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false,
    }).format(value);
    const symbol = getCurrencyNarrowSymbol(currencyCode, locale);
    // Insert a space when the symbol is multi-character text (e.g. "S/", "R$", "Bs") so it
    // reads as a unit; single-glyph symbols ($, €, ¥) sit flush against the value per
    // typographic norms.
    const needsSpace = symbol.length > 1;
    return `${symbol}${needsSpace ? " " : ""}${formattedNumber}`;
  } catch {
    return value.toFixed(2);
  }
}

/**
 * Returns `{symbol}{value} {CODE}` — the canonical "full" layout used in places where the
 * currency context isn't visible nearby (orders list price column, hero sub line, totals
 * etc.). The ISO code is ALWAYS appended regardless of how universally recognized the
 * symbol is, so `$185.00 ARS` reads exactly the same way as `€320.00 EUR` and `S/ 95.00 PEN`.
 * This intentional verbosity is what Sergio wants — consistent disambiguation across all
 * currencies, not a heuristic that hides the code for "well-known" ones.
 */
export function formatAmountWithSymbol(minorUnits: number, currencyCode: string, locale = "en"): string {
  return `${formatAmountSymbolOnly(minorUnits, currencyCode, locale)} ${currencyCode}`;
}
