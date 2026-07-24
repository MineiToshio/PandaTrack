"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  resolveStoreProductTypeName,
  type AuthoredStoreProductTypeNameMap,
} from "@/lib/catalog/resolveStoreProductTypeName";

const StoreProductTypeNamesContext = createContext<AuthoredStoreProductTypeNameMap>({});

/**
 * Provides the authored catalog-name map to client render sites so `useStoreProductTypeName` can
 * resolve admin-authored types. Mounted once in the private app shell; seeded types are absent from
 * the map and resolve through the `storeProductTypes` i18n namespace instead.
 */
export function StoreProductTypeNamesProvider({
  authoredNames,
  children,
}: {
  authoredNames: AuthoredStoreProductTypeNameMap;
  children: ReactNode;
}) {
  return (
    <StoreProductTypeNamesContext.Provider value={authoredNames}>{children}</StoreProductTypeNamesContext.Provider>
  );
}

/**
 * Returns a resolver mapping a product-type key to its display name under the hybrid catalog-names
 * model: prefer the admin-authored DB name for the active locale, and fall back to the seeded
 * `storeProductTypes` i18n name. Unknown keys render as themselves rather than throwing.
 */
export function useStoreProductTypeName(): (key: string) => string {
  const authoredNames = useContext(StoreProductTypeNamesContext);
  const locale = useLocale();
  const t = useTranslations("storeProductTypes");

  return useCallback(
    (key: string) => {
      const fallback = t.has(key) ? t(key) : key;
      return resolveStoreProductTypeName(authoredNames[key], fallback, locale);
    },
    [authoredNames, locale, t],
  );
}
