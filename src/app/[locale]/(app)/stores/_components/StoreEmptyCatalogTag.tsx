import { CircleMinus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

/** Pill-style hint for catalog fields with no values (distinct icon from filled product-type / import-country tags). */
const EMPTY_CATALOG_TAG_CLASSNAME =
  "border-border/60 bg-muted/35 text-text-muted inline-flex max-w-full items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium";

type StoreEmptyCatalogTagProps = {
  children: ReactNode;
  className?: string;
};

export default function StoreEmptyCatalogTag({ children, className }: StoreEmptyCatalogTagProps) {
  return (
    <span className={cn(EMPTY_CATALOG_TAG_CLASSNAME, className)} role="status">
      <CircleMinus className="text-text-muted/90 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      <span className="min-w-0 leading-snug">{children}</span>
    </span>
  );
}
