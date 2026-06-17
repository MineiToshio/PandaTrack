"use client";

import { useStoreListingNavigation } from "./StoreListingPendingContext";
import { cn } from "@/lib/styles";

type PaginationLinkProps = {
  href: string;
  className?: string;
  "aria-label"?: string;
  "aria-current"?: "page" | undefined;
  children: React.ReactNode;
};

/**
 * Drop-in replacement for `<Link>` inside `StoreListingPagination`.
 * Routes the click through the shared `navigate()` so page changes trigger
 * the same `useTransition`-backed skeleton as filter and sort changes.
 * The `href` attribute is kept for right-click / open-in-new-tab.
 */
export default function PaginationLink({ href, className, children, ...rest }: PaginationLinkProps) {
  const { navigate } = useStoreListingNavigation();
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        navigate(href);
      }}
      className={cn(className)}
      {...rest}
    >
      {children}
    </a>
  );
}
