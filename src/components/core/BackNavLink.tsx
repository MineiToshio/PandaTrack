import Link, { type LinkProps } from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn } from "@/lib/styles";

export type BackNavLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
  /**
   * `pill`: page-level back control (default), distinct from primary actions.
   * `button`: same geometry and tokens as `Button` outline `md` for form footers next to submit.
   */
  appearance?: "pill" | "button";
};

export default function BackNavLink({ children, className, appearance = "pill", ...linkProps }: BackNavLinkProps) {
  const isButtonAppearance = appearance === "button";

  return (
    <Link
      {...linkProps}
      className={cn(
        buttonVariants({
          variant: isButtonAppearance ? "outline" : "ghost",
          size: isButtonAppearance ? "md" : "sm",
        }),
        isButtonAppearance ? "gap-1.5" : "bg-background/70 gap-1.5 rounded-full shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}
