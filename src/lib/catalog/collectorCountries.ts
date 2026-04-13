/**
 * Collector-market country codes seeded in the database (`country` table).
 * Keep in sync with `prisma/seed.ts` usage; primary currency mapping supports user base-currency validation (FRD-07).
 */

export const COUNTRY_CODES = [
  "AR",
  "BR",
  "CA",
  "CL",
  "CN",
  "CO",
  "DE",
  "ES",
  "FR",
  "GB",
  "IT",
  "JP",
  "KR",
  "MX",
  "PE",
  "PT",
  "US",
] as const;

export type CollectorCountryCode = (typeof COUNTRY_CODES)[number];

/**
 * Regional-indicator flag emoji per seeded collector country (ISO 3166-1 alpha-2).
 * Keep keys aligned with `COUNTRY_CODES` and `prisma/seed.ts`.
 * Values use Unicode escapes so the file stays valid regardless of editor encoding.
 */
export const COUNTRY_FLAG_EMOJI_BY_CODE: Record<CollectorCountryCode, string> = {
  AR: "\u{1F1E6}\u{1F1F7}",
  BR: "\u{1F1E7}\u{1F1F7}",
  CA: "\u{1F1E8}\u{1F1E6}",
  CL: "\u{1F1E8}\u{1F1F1}",
  CN: "\u{1F1E8}\u{1F1F3}",
  CO: "\u{1F1E8}\u{1F1F4}",
  DE: "\u{1F1E9}\u{1F1EA}",
  ES: "\u{1F1EA}\u{1F1F8}",
  FR: "\u{1F1EB}\u{1F1F7}",
  GB: "\u{1F1EC}\u{1F1E7}",
  IT: "\u{1F1EE}\u{1F1F9}",
  JP: "\u{1F1EF}\u{1F1F5}",
  KR: "\u{1F1F0}\u{1F1F7}",
  MX: "\u{1F1F2}\u{1F1FD}",
  PE: "\u{1F1F5}\u{1F1EA}",
  PT: "\u{1F1F5}\u{1F1F9}",
  US: "\u{1F1FA}\u{1F1F8}",
};

/**
 * One primary ISO 4217 currency per seeded country for MVP base-currency allowlisting.
 */
export const PRIMARY_CURRENCY_BY_COUNTRY: Record<CollectorCountryCode, string> = {
  AR: "ARS",
  BR: "BRL",
  CA: "CAD",
  CL: "CLP",
  CN: "CNY",
  CO: "COP",
  DE: "EUR",
  ES: "EUR",
  FR: "EUR",
  GB: "GBP",
  IT: "EUR",
  JP: "JPY",
  KR: "KRW",
  MX: "MXN",
  PE: "PEN",
  PT: "EUR",
  US: "USD",
};

const uniqueCurrencyCodes = [...new Set(Object.values(PRIMARY_CURRENCY_BY_COUNTRY))].sort();

/**
 * Sorted distinct ISO 4217 codes collectors may pick as base currency in MVP.
 */
export const ALLOWED_COLLECTOR_BASE_CURRENCY_CODES: readonly string[] = uniqueCurrencyCodes;

export function isCollectorCountryCode(value: string): value is CollectorCountryCode {
  return (COUNTRY_CODES as readonly string[]).includes(value);
}

/**
 * Returns the flag emoji for a collector country code, or an empty string when unknown.
 */
export function getCollectorCountryFlagEmoji(code: string): string {
  const upper = code.toUpperCase();
  if (!isCollectorCountryCode(upper)) {
    return "";
  }
  return COUNTRY_FLAG_EMOJI_BY_CODE[upper];
}

export function isAllowedCollectorBaseCurrency(value: string): boolean {
  return (ALLOWED_COLLECTOR_BASE_CURRENCY_CODES as readonly string[]).includes(value);
}
