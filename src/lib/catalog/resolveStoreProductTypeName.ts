/** The localized display names an admin-authored catalog row persists (nullable for seeded rows). */
export type StoreProductTypeAuthoredName = {
  nameEs: string | null;
  nameEn: string | null;
};

/** Key -> authored DB names for admin-authored (non-seed) catalog types. */
export type AuthoredStoreProductTypeNameMap = Record<string, StoreProductTypeAuthoredName>;

/**
 * Picks the authored (DB-backed) name for a locale, or null when the row has no name for it.
 * A blank string counts as absent so the caller falls back to the i18n namespace.
 */
export function pickAuthoredStoreProductTypeName(
  authored: StoreProductTypeAuthoredName | null | undefined,
  locale: string,
): string | null {
  if (!authored) {
    return null;
  }
  const raw = locale.startsWith("en") ? authored.nameEn : authored.nameEs;
  const trimmed = raw?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolves a product-type display name under the hybrid catalog-names model: prefer the authored
 * DB name for the locale, and fall back to the seeded `storeProductTypes` i18n name otherwise. The
 * `fallback` is the caller-provided i18n value (from `useTranslations` / `getTranslations`), so this
 * helper stays free of any translation dependency and is usable on both server and client.
 */
export function resolveStoreProductTypeName(
  authored: StoreProductTypeAuthoredName | null | undefined,
  fallback: string,
  locale: string,
): string {
  return pickAuthoredStoreProductTypeName(authored, locale) ?? fallback;
}

/** Builds a key -> authored-name lookup from catalog rows, keeping only rows that carry a name. */
export function buildAuthoredStoreProductTypeNameMap(
  rows: readonly (StoreProductTypeAuthoredName & { key: string })[],
): AuthoredStoreProductTypeNameMap {
  const map: AuthoredStoreProductTypeNameMap = {};
  for (const row of rows) {
    if (row.nameEs !== null || row.nameEn !== null) {
      map[row.key] = { nameEs: row.nameEs, nameEn: row.nameEn };
    }
  }
  return map;
}
