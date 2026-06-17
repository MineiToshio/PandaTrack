import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/styles";

export type FabAction = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type FABProps = {
  action: FabAction | null;
  position?: "fixed" | "elevated";
  className?: string;
};

export default function FAB({ action, position = "fixed", className }: FABProps) {
  if (!action) return null;

  const { href, label, icon: Icon } = action;

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring focus-visible:ring-offset-background flex items-center justify-center rounded-full shadow-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "h-[var(--fab-size)] w-[var(--fab-size)]",
        position === "fixed" && [
          "fixed right-[calc(env(safe-area-inset-right,0px)+var(--fab-offset))]",
          "bottom-[calc(env(safe-area-inset-bottom,0px)+var(--fab-offset))]",
          "z-[var(--z-fab)]",
          "lg:hidden",
        ],
        position === "elevated" && "z-[var(--z-fab)]",
        className,
      )}
    >
      <Icon className="h-6 w-6" aria-hidden />
    </Link>
  );
}
