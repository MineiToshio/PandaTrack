import Link, { type LinkProps } from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn } from "@/lib/styles";

export type BackNavLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
};

export default function BackNavLink({ children, className, ...linkProps }: BackNavLinkProps) {
  return (
    <Link
      {...linkProps}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "bg-background/70 inline-flex items-center gap-1.5 rounded-full shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}
