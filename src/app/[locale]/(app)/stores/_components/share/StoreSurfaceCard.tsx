import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/styles";

type StoreSurfaceCardProps = {
  as?: "section" | "div";
  children: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">;

export default function StoreSurfaceCard({ as, children, className, ...props }: StoreSurfaceCardProps) {
  const Component = as ?? "section";

  return (
    <Component
      className={cn(
        "bg-background/80 border-border/60 ring-primary/10 rounded-3xl border p-5 shadow-sm ring-1 ring-inset sm:p-6",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
