"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/styles";
import MonoCode from "@/components/core/MonoCode";

export type BreadcrumbItem = {
  label: string;
  href?: string;
  isCode?: boolean;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  mobileMaxItems?: number;
  ariaLabel?: string;
  className?: string;
};

export default function Breadcrumbs({
  items,
  mobileMaxItems = 3,
  ariaLabel = "Breadcrumbs",
  className,
}: BreadcrumbsProps) {
  const [expanded, setExpanded] = useState(false);

  if (items.length <= 1) return null;

  const needsCollapse = !expanded && items.length > mobileMaxItems;
  const visibleItems: BreadcrumbItem[] = needsCollapse
    ? [items[0], { label: "…", href: undefined }, items[items.length - 1]]
    : items;

  const handleExpand = () => setExpanded(true);

  return (
    <nav aria-label={ariaLabel} className={cn("flex min-w-0 items-center", className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-0">
        {visibleItems.map((item, index) => {
          const isEllipsis = item.label === "…";
          const isLast = index === visibleItems.length - 1;
          const isCurrent = isLast && !item.href;

          return (
            <li key={`${item.href ?? item.label}-${index}`} className="flex min-w-0 items-center">
              {index > 0 && <ChevronRight className="text-text-muted mx-1 h-3.5 w-3.5 shrink-0" aria-hidden />}
              {isEllipsis ? (
                <button
                  type="button"
                  aria-label="Mostrar todos los niveles"
                  aria-expanded={expanded}
                  onClick={handleExpand}
                  className="text-text-muted hover:text-text-primary rounded px-1 text-sm transition-colors"
                >
                  …
                </button>
              ) : isCurrent ? (
                <span aria-current="page" className={cn("text-text-primary max-w-40 truncate text-sm font-medium")}>
                  {item.isCode ? <MonoCode>{item.label}</MonoCode> : item.label}
                </span>
              ) : (
                <Link
                  href={item.href!}
                  className="text-text-secondary hover:text-text-primary focus-visible:ring-ring focus-visible:ring-offset-background max-w-32 truncate rounded text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {item.isCode ? <MonoCode>{item.label}</MonoCode> : item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
