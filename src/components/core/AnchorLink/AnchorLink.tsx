"use client";

import { cn } from "@/lib/styles";
import { AnchorHTMLAttributes, useCallback } from "react";

type AnchorLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /** Must be a same-page hash (e.g. "#waitlist"). Click always scrolls to the target, even when the URL already has that hash. */
  href: string;
};

/**
 * In-page anchor link that always scrolls to the target on click.
 * Fixes the case where the URL already contains the hash (e.g. #waitlist) and a second click would not scroll.
 */
export default function AnchorLink({ href, className, onClick, children, ...props }: AnchorLinkProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!href.startsWith("#")) return;
      e.preventDefault();
      onClick?.(e);
      const id = href.slice(1);
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
      const newUrl = `${window.location.pathname}${href}`;
      window.history.replaceState(null, "", newUrl);
    },
    [href, onClick],
  );

  return (
    <a href={href} className={cn(className)} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
