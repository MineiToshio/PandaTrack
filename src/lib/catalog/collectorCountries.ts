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

export function isAllowedCollectorBaseCurrency(value: string): boolean {
  return (ALLOWED_COLLECTOR_BASE_CURRENCY_CODES as readonly string[]).includes(value);
}
