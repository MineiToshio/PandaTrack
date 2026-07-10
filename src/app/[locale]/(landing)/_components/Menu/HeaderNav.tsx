"use client";

import AnchorLink from "@/components/core/AnchorLink";
import { useTranslations } from "next-intl";
import { POSTHOG_EVENTS } from "@/lib/constants";

export type HeaderNavItem = {
  key: string;
  href: string;
};

type HeaderNavProps = {
  items: HeaderNavItem[];
};

/**
 * Marketing in-page nav (`.mk-nav`). Smooth-scrolls to landing sections; the
 * sticky-header offset comes from the global `scroll-padding-top` rule.
 */
export default function HeaderNav({ items }: HeaderNavProps) {
  const t = useTranslations("landing.header.nav");
  const tHeader = useTranslations("landing.header");

  return (
    <nav className="mk-nav" aria-label={tHeader("mainNavAriaLabel")}>
      {items.map((item) => (
        <AnchorLink
          key={item.href}
          href={item.href}
          posthogEvent={POSTHOG_EVENTS.LANDING.HEADER_NAV_CLICKED}
          posthogProps={{ destination: item.key }}
        >
          {t(item.key)}
        </AnchorLink>
      ))}
    </nav>
  );
}
