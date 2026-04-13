import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/styles";

/** Shared elevated surface for store routes (reviews card, detail sections, etc.). */
export const STORE_SURFACE_CARD_CLASSNAME =
  "bg-background/85 border-border/70 ring-primary/15 rounded-3xl border p-5 shadow-sm ring-1 ring-inset sm:p-6";

type StoreSurfaceCardProps = {
  as?: "section" | "div";
  children: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">;

export default function StoreSurfaceCard({ as, children, className, ...props }: StoreSurfaceCardProps) {
  const Component = as ?? "section";

  return (
    <Component className={cn(STORE_SURFACE_CARD_CLASSNAME, className)} {...props}>
      {children}
    </Component>
  );
}
