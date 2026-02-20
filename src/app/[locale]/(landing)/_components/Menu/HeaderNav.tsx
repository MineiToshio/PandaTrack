"use client";

import AnchorLink from "@/components/core/AnchorLink";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/styles";

export type HeaderNavItem = {
  key: string;
  href: string;
};

type HeaderNavProps = {
  items: HeaderNavItem[];
  className?: string;
  itemClassName?: string;
  onNavigate?: () => void;
};

export default function HeaderNav({ items, className, itemClassName, onNavigate }: HeaderNavProps) {
  const t = useTranslations("landing.header.nav");

  return (
    <nav aria-label="Main" className={cn("font-secondary text-text-body flex items-center gap-6 text-sm", className)}>
      {items.map((item) => (
        <AnchorLink
          key={item.href}
          href={item.href}
          className={cn(
            "hover:text-text-title relative shrink-0 whitespace-nowrap transition-colors",
            "after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:origin-right after:scale-x-0 after:bg-current after:content-['']",
            "after:transition-transform after:duration-300 after:ease-out",
            "hover:after:origin-left hover:after:scale-x-100",
            itemClassName,
          )}
          onClick={onNavigate}
        >
          {t(item.key)}
        </AnchorLink>
      ))}
    </nav>
  );
}
