/**
 * Money is stored uniformly as integer minor units scaled ×100 for EVERY currency, so the
 * internal FX arithmetic stays consistent and no stored data ever needs migrating. Presentation,
 * input, and validation, however, honour each currency's real ISO 4217 exponent: zero-decimal
 * currencies (CLP, JPY, KRW in this catalog) have no subunit, so they render without decimals,
 * reject a decimal separator on input, and must resolve to a whole major amount (a multiple of
 * `MINOR_UNITS_PER_MAJOR`) once scaled.
 */
export const MINOR_UNITS_PER_MAJOR = 100;

const DEFAULT_CURRENCY_DECIMALS = 2;

// ISO 4217 exponent-0 codes present in the app catalog (src/lib/catalog/collectorCountries.ts).
// Any code not listed here is treated as the 2-decimal default.
const ZERO_DECIMAL_CURRENCY_CODES = new Set(["CLP", "JPY", "KRW"]);

/**
 * Number of fraction digits a currency shows and accepts, per its ISO 4217 exponent.
 * Returns 0 for zero-decimal currencies (CLP, JPY, KRW) and 2 for everything else.
 */
export function getCurrencyDecimals(currencyCode: string): number {
  return ZERO_DECIMAL_CURRENCY_CODES.has(currencyCode) ? 0 : DEFAULT_CURRENCY_DECIMALS;
}

export function isZeroDecimalCurrency(currencyCode: string): boolean {
  return ZERO_DECIMAL_CURRENCY_CODES.has(currencyCode);
}

/**
 * Formats a ×100 minor-units integer as the bare decimal string a form input expects,
 * honouring the currency exponent (0 fraction digits for CLP/JPY/KRW, 2 otherwise) — no code,
 * no symbol, no thousands separator. Used to prefill/round the order total, item unit price and
 * delivery cost fields. A currency-blind `.toFixed(2)` here would emit a "43000.00" that the
 * currency-aware validator and parser reject for a zero-decimal currency, so the field must be
 * seeded with the exponent-correct string that round-trips cleanly on submit.
 */
export function formatCentsForInput(minorUnits: number, currencyCode: string): string {
  return (minorUnits / MINOR_UNITS_PER_MAJOR).toFixed(getCurrencyDecimals(currencyCode));
}

/**
 * True when a ×100 minor-units amount represents a whole major amount. Zero-decimal currencies
 * must satisfy this because they have no subunit to occupy the fractional ×100 space.
 */
export function isWholeMajorAmount(minorUnits: number): boolean {
  return minorUnits % MINOR_UNITS_PER_MAJOR === 0;
}

/**
 * Formats a minor-unit integer as a decimal followed by the ISO currency code.
 * Example: formatAmount(4300000, "CLP") → "43000 CLP"
 *          formatAmount(88850, "USD") → "888.50 USD"
 *
 * Pattern: {amount} {code} — value first, identifier after.
 * Canonical number layout, locale-INDEPENDENT: comma thousand separators + period decimal
 * (`1,240.00`). Fraction digits follow the currency exponent (2 for most, 0 for CLP/JPY/KRW, so
 * `43,000 CLP` has no decimals). A single canonical layout keeps collectors from getting tripped up
 * reading `$1.240,00` vs `$1,240.00`. See docs/design/visual-foundations.md — "Number and currency
 * formatting".
 */
export function formatAmount(minorUnits: number, currencyCode: string): string {
  const decimals = getCurrencyDecimals(currencyCode);
  try {
    const formatted = new Intl.NumberFormat("en", {
      style: "decimal",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true,
    }).format(minorUnits / MINOR_UNITS_PER_MAJOR);
    return `${formatted} ${currencyCode}`;
  } catch {
    return `${(minorUnits / MINOR_UNITS_PER_MAJOR).toFixed(decimals)} ${currencyCode}`;
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
 * `$` after the value — we override that). Number layout is locale-INDEPENDENT: comma thousand
 * separators + period decimal (`S/ 51,248.00`), with fraction digits per the currency exponent
 * (0 for CLP/JPY/KRW, 2 otherwise). Form inputs use `formatCentsForInput` instead — those stay
 * ungrouped so the value round-trips through the parser.
 *
 * For places that should show the code explicitly (orders list price, hero sub line, etc.)
 * use `formatAmountWithSymbol` — that variant always appends the ISO code.
 */
export function formatAmountSymbolOnly(minorUnits: number, currencyCode: string, locale = "en"): string {
  const decimals = getCurrencyDecimals(currencyCode);
  const value = minorUnits / MINOR_UNITS_PER_MAJOR;
  try {
    const formattedNumber = new Intl.NumberFormat("en", {
      style: "decimal",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true,
    }).format(value);
    const symbol = getCurrencyNarrowSymbol(currencyCode, locale);
    // Insert a space when the symbol is multi-character text (e.g. "S/", "R$", "Bs") so it
    // reads as a unit; single-glyph symbols ($, €, ¥) sit flush against the value per
    // typographic norms.
    const needsSpace = symbol.length > 1;
    return `${symbol}${needsSpace ? " " : ""}${formattedNumber}`;
  } catch {
    return value.toFixed(decimals);
  }
}

/**
 * At/above this MAJOR amount a headline value is abbreviated (`234.3K`, `1.2M`) instead of shown
 * in full. Below it, the exact 2-decimal value is kept. The threshold guarantees the abbreviated
 * form never exceeds a bounded width (mantissa < 1000 + a single suffix letter), so it always fits
 * a constrained container such as a donut center. The full value is surfaced on hover.
 */
const COMPACT_ABBREVIATION_THRESHOLD = 1000;

/**
 * Compact variant of `formatAmountSymbolOnly` for space-constrained headlines (e.g. a donut
 * center): `S/ 234.3K`, `$ 1.2M`. Values below `COMPACT_ABBREVIATION_THRESHOLD` keep their exact
 * exponent-correct decimals (`S/ 888.50`); at/above it they abbreviate with a K/M/B/T suffix and at
 * most one decimal. The suffix letters are locale-independent (English compact) so the layout stays
 * canonical; the currency symbol is resolved per locale. Pair with the full `formatAmountSymbolOnly`
 * value as a hover `title`.
 */
export function formatAmountSymbolOnlyCompact(minorUnits: number, currencyCode: string, locale = "en"): string {
  const value = minorUnits / MINOR_UNITS_PER_MAJOR;
  try {
    const symbol = getCurrencyNarrowSymbol(currencyCode, locale);
    const needsSpace = symbol.length > 1;
    return `${symbol}${needsSpace ? " " : ""}${formatCompactMajor(value, getCurrencyDecimals(currencyCode))}`;
  } catch {
    return value.toFixed(getCurrencyDecimals(currencyCode));
  }
}

/**
 * Formats a major-unit number for a constrained headline: full grouped decimals below the
 * abbreviation threshold, K/M/B/T compact notation at/above it. Locale-independent (English) so the
 * digit grouping and suffix letters stay canonical across the app.
 */
export function formatCompactMajor(value: number, decimals: number): string {
  if (Math.abs(value) < COMPACT_ABBREVIATION_THRESHOLD) {
    return new Intl.NumberFormat("en", {
      style: "decimal",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true,
    }).format(value);
  }
  return new Intl.NumberFormat("en", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
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
