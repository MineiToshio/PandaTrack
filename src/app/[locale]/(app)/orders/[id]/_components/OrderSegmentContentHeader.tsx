"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useHeaderTitle } from "@/app/[locale]/(app)/_components/AppLayout/HeaderTitleContext";
import { ROUTES } from "@/lib/constants";

type OrderSegmentContentHeaderProps = {
  locale: string;
  orderId: string;
  humanReadableId: string;
};

function isOrderEditPath(pathname: string, locale: string, orderId: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return (
    segments.length === 4 &&
    segments[0] === locale &&
    segments[1] === "orders" &&
    segments[2] === orderId &&
    segments[3] === "edit"
  );
}

/**
 * Syncs the app shell header with order detail vs edit: detail shows the order's
 * human-readable id as title; edit shows "Edit" as title and inserts the id as a
 * breadcrumb linking back to the detail route. Mounted from the detail-segment
 * layout (above the detail-route Suspense boundary) so the title survives a hard
 * load / refresh, matching the store-detail pattern.
 */
export default function OrderSegmentContentHeader({
  locale,
  orderId,
  humanReadableId,
}: OrderSegmentContentHeaderProps) {
  const pathname = usePathname() ?? "";
  const { setTitle, setBreadcrumbMiddle } = useHeaderTitle();
  const detailHref = `/${locale}${ROUTES.orders}/${orderId}`;

  useEffect(() => {
    if (isOrderEditPath(pathname, locale, orderId)) {
      setTitle(null);
      setBreadcrumbMiddle({ label: humanReadableId, href: detailHref });
    } else {
      setTitle(humanReadableId);
      setBreadcrumbMiddle(null);
    }
  }, [pathname, locale, orderId, humanReadableId, detailHref, setTitle, setBreadcrumbMiddle]);

  useEffect(() => {
    return () => {
      setTitle(null);
      setBreadcrumbMiddle(null);
    };
  }, [setTitle, setBreadcrumbMiddle]);

  return null;
}
