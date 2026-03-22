"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useHeaderTitle } from "@/app/[locale]/(app)/_components/AppLayout/HeaderTitleContext";
import { ROUTES } from "@/lib/constants";

type StoreSegmentContentHeaderProps = {
  locale: string;
  storeSlug: string;
  storeName: string;
};

function isStoreEditPath(pathname: string, locale: string, storeSlug: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return (
    segments.length === 4 &&
    segments[0] === locale &&
    segments[1] === "stores" &&
    segments[2] === storeSlug &&
    segments[3] === "edit"
  );
}

/**
 * Syncs the app shell header with store detail vs edit: detail shows the store name as title;
 * edit shows "Edit" as title and inserts the store name as a breadcrumb linking to the detail route.
 */
export default function StoreSegmentContentHeader({ locale, storeSlug, storeName }: StoreSegmentContentHeaderProps) {
  const pathname = usePathname() ?? "";
  const { setTitle, setBreadcrumbAfterStores } = useHeaderTitle();
  const storeDetailHref = `/${locale}${ROUTES.stores}/${storeSlug}`;

  useEffect(() => {
    if (isStoreEditPath(pathname, locale, storeSlug)) {
      setTitle(null);
      setBreadcrumbAfterStores({ label: storeName, href: storeDetailHref });
    } else {
      setTitle(storeName);
      setBreadcrumbAfterStores(null);
    }
  }, [pathname, locale, storeSlug, storeName, storeDetailHref, setTitle, setBreadcrumbAfterStores]);

  useEffect(() => {
    return () => {
      setTitle(null);
      setBreadcrumbAfterStores(null);
    };
  }, [setTitle, setBreadcrumbAfterStores]);

  return null;
}
