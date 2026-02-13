"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/styles";

export type HeaderNavItem = {
  key: string;
  href: string;
};

type HeaderNavProps = {
  items: HeaderNavItem[];
  className?: string;
  onNavigate?: () => void;
};

export default function HeaderNav({ items, className, onNavigate }: HeaderNavProps) {
  const t = useTranslations("landing.header.nav");

  return (
    <nav aria-label="Main" className={cn("font-secondary text-text-body flex items-center gap-6 text-sm", className)}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="hover:text-text-title transition-colors" onClick={onNavigate}>
          {t(item.key)}
        </Link>
      ))}
    </nav>
  );
}
