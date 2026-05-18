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
 * Syncs the shell topbar for order detail vs edit: edit inserts the order's
 * human-readable id as a middle breadcrumb linking back to the detail route.
 */
export default function OrderSegmentContentHeader({
  locale,
  orderId,
  humanReadableId,
}: OrderSegmentContentHeaderProps) {
  const pathname = usePathname() ?? "";
  const { setBreadcrumbMiddle } = useHeaderTitle();
  const detailHref = `/${locale}${ROUTES.orders}/${orderId}`;

  useEffect(() => {
    if (isOrderEditPath(pathname, locale, orderId)) {
      setBreadcrumbMiddle({ label: humanReadableId, href: detailHref });
    } else {
      setBreadcrumbMiddle(null);
    }
  }, [pathname, locale, orderId, humanReadableId, detailHref, setBreadcrumbMiddle]);

  useEffect(() => {
    return () => {
      setBreadcrumbMiddle(null);
    };
  }, [setBreadcrumbMiddle]);

  return null;
}
