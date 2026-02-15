"use client";

import { cn } from "@/lib/styles";
import { AnchorHTMLAttributes, useCallback } from "react";
import { getPosthogDataAttributes } from "@/lib/posthogDataAttributes";

type AnchorLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /** Must be a same-page hash (e.g. "#waitlist"). Click always scrolls to the target, even when the URL already has that hash. */
  href: string;
  /** Optional PostHog event name to be captured by the global click delegate. */
  posthogEvent?: string;
  /** Optional PostHog event properties to be captured by the global click delegate. */
  posthogProps?: Record<string, unknown>;
};

/**
 * In-page anchor link that always scrolls to the target on click.
 * Fixes the case where the URL already contains the hash (e.g. #waitlist) and a second click would not scroll.
 */
export default function AnchorLink({
  href,
  className,
  onClick,
  posthogEvent,
  posthogProps,
  children,
  ...props
}: AnchorLinkProps) {
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

  const posthogDataAttributes = getPosthogDataAttributes(posthogEvent, posthogProps);

  return (
    <a
      {...props}
      href={href}
      className={cn(
        "focus-visible:ring-ring focus-visible:ring-offset-background rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
      onClick={handleClick}
      {...posthogDataAttributes}
    >
      {children}
    </a>
  );
}
